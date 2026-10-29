package com.flowtrack.service;

import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.model.SprintScopeChange;
import com.flowtrack.model.Task;
import com.flowtrack.model.Project;
import com.flowtrack.repository.SprintScopeChangeRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class SprintScopeChangeService {

    @Autowired
    private SprintScopeChangeRepository scopeChangeRepository;

    @Autowired
    private UserRepository userRepository;

    public SprintScopeChange recordScopeChange(Long sprintId, Long taskId, String taskKey, String taskTitle,
                                              String changeType, Integer fromPoints, Integer toPoints,
                                              Integer pointsDiff, String comment) {
        if (sprintId == null) {
            return null;
        }

        String performedBy = "System";
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                String email = auth.getName();
                Optional<com.flowtrack.model.User> userOpt = userRepository.findByEmailIgnoreCase(email);
                if (userOpt.isPresent()) {
                    performedBy = userOpt.get().getName();
                } else if (email != null && !email.isBlank()) {
                    performedBy = email;
                }
            }
        } catch (Exception e) {
            // Fallback to "System" if non-interactive or testing context
        }

        SprintScopeChange change = new SprintScopeChange(
                sprintId, taskId, taskKey, taskTitle, changeType,
                fromPoints, toPoints, pointsDiff, performedBy, comment
        );
        return scopeChangeRepository.save(change);
    }

    public List<SprintScopeChangeDto> getScopeChangesForSprint(Long sprintId) {
        List<SprintScopeChange> changes = scopeChangeRepository.findBySprintIdOrderByChangedAtDesc(sprintId);
        return changes.stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<SprintScopeChange> getRawScopeChangesForSprintAsc(Long sprintId) {
        return scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(sprintId);
    }

    public SprintScopeChangeDto toDto(SprintScopeChange entity) {
        SprintScopeChangeDto dto = new SprintScopeChangeDto();
        dto.setId(entity.getId());
        dto.setSprintId(entity.getSprintId());
        dto.setTaskId(entity.getTaskId());
        dto.setTaskKey(entity.getTaskKey());
        dto.setTaskTitle(entity.getTaskTitle());
        dto.setChangeType(entity.getChangeType());
        dto.setFromPoints(entity.getFromPoints());
        dto.setToPoints(entity.getToPoints());
        dto.setPointsDiff(entity.getPointsDiff());
        dto.setChangedBy(entity.getChangedBy());
        dto.setChangedAt(entity.getChangedAt());
        dto.setComment(entity.getComment());
        return dto;
    }

    public static String formatTaskKey(Task task) {
        if (task == null) return "TASK";
        Project project = task.getProject();
        String prefix = "FT";
        if (project != null && project.getName() != null && !project.getName().trim().isEmpty()) {
            String clean = project.getName().trim();
            String[] words = clean.split("[\\s\\-_]+");
            if (words.length >= 2) {
                StringBuilder pfx = new StringBuilder();
                for (String w : words) {
                    if (!w.isEmpty()) pfx.append(Character.toUpperCase(w.charAt(0)));
                }
                prefix = pfx.length() > 3 ? pfx.substring(0, 3) : pfx.toString();
            } else if (clean.length() >= 2) {
                prefix = clean.substring(0, 2).toUpperCase();
            } else {
                prefix = clean.toUpperCase();
            }
        }
        Long seq = task.getProjectSequence() != null ? task.getProjectSequence() : task.getId();
        return prefix + "-" + (seq != null ? seq : "0");
    }
}
