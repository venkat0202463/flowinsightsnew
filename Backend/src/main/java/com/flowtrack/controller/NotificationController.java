package com.flowtrack.controller;

import com.flowtrack.model.Notification;
import com.flowtrack.model.User;
import com.flowtrack.repository.NotificationRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    private java.util.List<String> getUserIds(User user) {
        java.util.List<String> ids = new java.util.ArrayList<>();
        if (user.getEmpId() != null && !user.getEmpId().trim().isEmpty()) {
            ids.add(user.getEmpId().trim());
        }
        if (user.getEmail() != null && !user.getEmail().trim().isEmpty() && !ids.contains(user.getEmail().trim())) {
            ids.add(user.getEmail().trim());
        }
        if (user.getId() != null && !ids.contains(String.valueOf(user.getId()))) {
            ids.add(String.valueOf(user.getId()));
        }
        return ids;
    }

    private Optional<User> resolveCurrentUser() {
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmpId(identifier);
        }
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmailIgnoreCase(identifier);
        }
        return userOpt;
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount() {
        Optional<User> userOpt = resolveCurrentUser();
        
        if (userOpt.isPresent()) {
            long count = notificationRepository.countByUserIdInAndIsReadFalse(getUserIds(userOpt.get()));
            return ResponseEntity.ok(Map.of("count", count));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @GetMapping
    public ResponseEntity<?> getMyNotifications() {
        Optional<User> userOpt = resolveCurrentUser();
        
        if (userOpt.isPresent()) {
            List<Notification> notifications = notificationRepository.findByUserIdInOrderByCreatedAtDesc(getUserIds(userOpt.get()));
            return ResponseEntity.ok(notifications);
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id) {
        Optional<Notification> notificationOpt = notificationRepository.findById(id);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            notification.setRead(true);
            notificationRepository.save(notification);
            return ResponseEntity.ok(Map.of("message", "Marked as read"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "Notification not found"));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<?> markAllAsRead() {
        Optional<User> userOpt = resolveCurrentUser();
        
        if (userOpt.isPresent()) {
            List<Notification> notifications = notificationRepository.findByUserIdInOrderByCreatedAtDesc(getUserIds(userOpt.get()));
            for (Notification n : notifications) {
                n.setRead(true);
            }
            notificationRepository.saveAll(notifications);
            return ResponseEntity.ok(Map.of("message", "All marked as read"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @DeleteMapping("/clear-all")
    public ResponseEntity<?> clearAll() {
        Optional<User> userOpt = resolveCurrentUser();
        
        if (userOpt.isPresent()) {
            notificationRepository.deleteByUserIdIn(getUserIds(userOpt.get()));
            return ResponseEntity.ok(Map.of("message", "All notifications cleared"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }
}
