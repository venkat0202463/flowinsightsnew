package com.flowtrack.controller;

import com.flowtrack.model.Comment;
import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.dto.CommentRequest;
import com.flowtrack.repository.CommentRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {
    @Autowired
    CommentRepository commentRepository;

    @Autowired
    TaskRepository taskRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    private com.flowtrack.service.TaskEmailService taskEmailService;

    @Autowired
    private com.flowtrack.repository.NotificationRepository notificationRepository;

    @GetMapping("/task/{taskId}")
    public List<Comment> getCommentsByTask(@PathVariable Long taskId) {
        return commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    @PostMapping
    public ResponseEntity<Comment> addComment(@RequestBody CommentRequest request) {
        Task task = taskRepository.findById(request.getTaskId()).orElseThrow();
        User user = userRepository.findById(request.getUserId()).orElseThrow();

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setTask(task);
        comment.setUser(user);

        Comment savedComment = commentRepository.save(comment);

        try {
            String content = request.getContent();
            java.util.Set<User> mentionedUsers = new java.util.HashSet<>();
            if (content != null && !content.trim().isEmpty()) {
                java.util.List<User> allUsers = userRepository.findAll();

                // 1. Extract from data-user-id attribute in mention spans
                java.util.regex.Matcher mUserId = java.util.regex.Pattern.compile("data-user-id=[\"'](\\d+)[\"']").matcher(content);
                while (mUserId.find()) {
                    try {
                        Long uid = Long.parseLong(mUserId.group(1));
                        allUsers.stream().filter(u -> u.getId().equals(uid)).findFirst().ifPresent(mentionedUsers::add);
                    } catch (Exception ignored) {}
                }

                // 2. Extract from data-emp-id attribute in mention spans
                java.util.regex.Matcher mEmpId = java.util.regex.Pattern.compile("data-emp-id=[\"']([^\"']+)[\"']").matcher(content);
                while (mEmpId.find()) {
                    String emp = mEmpId.group(1).trim();
                    allUsers.stream().filter(u -> emp.equalsIgnoreCase(u.getEmpId()) || (u.getEmpId() != null && u.getEmpId().endsWith("_" + emp))).findFirst().ifPresent(mentionedUsers::add);
                }

                // 3. Extract from data-email attribute in mention spans
                java.util.regex.Matcher mEmail = java.util.regex.Pattern.compile("data-email=[\"']([^\"']+)[\"']").matcher(content);
                while (mEmail.find()) {
                    String em = mEmail.group(1).trim();
                    allUsers.stream().filter(u -> em.equalsIgnoreCase(u.getEmail())).findFirst().ifPresent(mentionedUsers::add);
                }

                // 4. Extract from names, emails, and empIds with '@' prefix in HTML or plain text
                String cleanContent = content.replaceAll("<[^>]*>", " ");
                for (User u : allUsers) {
                    // Check by full name (e.g. @mani mani or @Admin User)
                    if (u.getName() != null && !u.getName().trim().isEmpty()) {
                        String name = u.getName().trim();
                        if (content.toLowerCase().contains("@" + name.toLowerCase()) || 
                            cleanContent.toLowerCase().contains("@" + name.toLowerCase())) {
                            mentionedUsers.add(u);
                        }
                    }
                    // Check by email with @ prefix (e.g. @pvkrp111@gmail.com)
                    if (u.getEmail() != null && !u.getEmail().trim().isEmpty()) {
                        if (content.toLowerCase().contains("@" + u.getEmail().toLowerCase()) ||
                            cleanContent.toLowerCase().contains("@" + u.getEmail().toLowerCase())) {
                            mentionedUsers.add(u);
                        }
                    }
                    // Check by employee ID with @ prefix (e.g. @flow123_emp3)
                    if (u.getEmpId() != null && !u.getEmpId().trim().isEmpty()) {
                        if (content.toLowerCase().contains("@" + u.getEmpId().toLowerCase()) ||
                            cleanContent.toLowerCase().contains("@" + u.getEmpId().toLowerCase())) {
                            mentionedUsers.add(u);
                        }
                    }
                }
            }

            String taskKey = task.getProject() != null && task.getProject().getName() != null ? 
                task.getProject().getName().toUpperCase().replaceAll("[^A-Z0-9]", "") : "TASK";
            if (taskKey.length() > 4) taskKey = taskKey.substring(0, 4);
            Long seq = task.getProjectSequence() != null ? task.getProjectSequence() : task.getId();
            String taskDisplayKey = taskKey + "-" + seq;

            System.out.println("Comment added by user " + user.getName() + " (ID: " + user.getId() + "). Mentioned users count: " + mentionedUsers.size());
            if (!mentionedUsers.isEmpty()) {
                System.out.println("Mentioned users found: " + mentionedUsers.stream().map(u -> u.getName() + "(" + u.getEmail() + ")").toList());
                for (User mentioned : mentionedUsers) {
                    System.out.println("Dispatching mention email & notification to: " + mentioned.getName() + " <" + mentioned.getEmail() + ">");
                    // 1. Email Notification
                    try {
                        taskEmailService.sendUserMentionedEmail(mentioned, user, task, content);
                    } catch (Exception ex) {
                        System.err.println("Failed to send mention email: " + ex.getMessage());
                    }

                    // 2. In-App Notification
                    try {
                        String targetEmpId = (mentioned.getEmpId() != null && !mentioned.getEmpId().trim().isEmpty()) 
                            ? mentioned.getEmpId() 
                            : mentioned.getEmail();
                        if (targetEmpId != null) {
                            notificationRepository.save(new com.flowtrack.model.Notification(
                                targetEmpId,
                                "TASK MENTION",
                                user.getName() + " mentioned you in task " + taskDisplayKey + " (" + task.getTitle() + ")",
                                "mention"
                            ));
                        }
                    } catch (Exception ex) {
                        System.err.println("Failed to save mention in-app notification: " + ex.getMessage());
                    }
                }
            } else {
                System.out.println("No mentions found in comment. Sending general comment notification to task stakeholders.");
                // If NO ONE is mentioned, send general comment notifications to task stakeholders
                java.util.Set<User> recipients = new java.util.HashSet<>();
                if (task.getAssignee() != null) recipients.add(task.getAssignee());
                if (task.getReporter() != null) recipients.add(task.getReporter());
                if (task.getProject() != null && task.getProject().getCreatedBy() != null) {
                    recipients.add(task.getProject().getCreatedBy());
                }

                for (User recipient : recipients) {
                    if (!recipient.getId().equals(user.getId())) {
                        // 1. Email Notification
                        try {
                            taskEmailService.sendCommentAddedEmail(recipient, user, task, content);
                        } catch (Exception ex) {
                            System.err.println("Failed to send comment email: " + ex.getMessage());
                        }

                        // 2. In-App Notification
                        try {
                            String recipientEmpId = (recipient.getEmpId() != null && !recipient.getEmpId().trim().isEmpty()) 
                                ? recipient.getEmpId() 
                                : recipient.getEmail();
                            if (recipientEmpId != null) {
                                notificationRepository.save(new com.flowtrack.model.Notification(
                                    recipientEmpId,
                                    "NEW COMMENT",
                                    user.getName() + " commented on task " + taskDisplayKey + " (" + task.getTitle() + ")",
                                    "comment"
                                ));
                            }
                        } catch (Exception ex) {
                            System.err.println("Failed to save comment in-app notification: " + ex.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to trigger comment/mention notifications: " + e.getMessage());
            e.printStackTrace();
        }

        return ResponseEntity.ok(savedComment);
    }
}
