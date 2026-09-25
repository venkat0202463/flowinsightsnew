package com.flowtrack.service;

import com.flowtrack.model.Comment;
import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.repository.CommentRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CommentService {
    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    public List<Comment> getCommentsByTaskId(Long taskId) {
        return commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public Comment createComment(Long taskId, Long userId, String content) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();

        Comment comment = new Comment();
        comment.setTask(task);
        comment.setUser(user);
        comment.setContent(content);

        Comment saved = commentRepository.save(comment);

        // Notify Task Assignee
        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            notificationService.createNotification(
                task.getAssignee().getEmpId(),
                "New Comment",
                user.getName() + " commented on your task: " + task.getTitle(),
                "COMMENT_ADD",
                task.getId(),
                task.getProject() != null ? task.getProject().getId() : null,
                task.getIssueType() != null ? task.getIssueType() : "TASK"
            );
        }

        // Notify Project Manager
        if (task.getProject() != null && task.getProject().getCreatedBy() != null
                && !task.getProject().getCreatedBy().getId().equals(userId)) {
            notificationService.createNotification(
                task.getProject().getCreatedBy().getEmpId(),
                "New Comment",
                user.getName() + " commented on a task in Project " + task.getProject().getName(),
                "COMMENT_ADD",
                task.getId(),
                task.getProject().getId(),
                task.getIssueType() != null ? task.getIssueType() : "TASK"
            );
        }

        return saved;
    }
}
