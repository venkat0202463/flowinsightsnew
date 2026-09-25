package com.flowtrack.controller;

import com.flowtrack.model.*;
import com.flowtrack.repository.*;
import com.flowtrack.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

        @Autowired
        private ProjectRepository projectRepository;

        @Autowired
        private TaskRepository taskRepository;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private ProjectService projectService;

        @Autowired
        private SprintRepository sprintRepository;

        @Autowired
        private com.flowtrack.service.BoardColumnService columnService;

        @GetMapping("/fix")
        public Map<String, String> fixCircular() {
                List<Task> tasks = taskRepository.findAll();
                for (Task t : tasks) {
                        if (t.getParentTask() != null && t.getParentTask().getParentTask() != null) {
                                if (t.getParentTask().getParentTask().getId().equals(t.getId())) {
                                        t.setParentTask(null);
                                        taskRepository.save(t);
                                }
                        }
                }
                return Map.of("status", "Fixed");
        }

        @GetMapping("/review-counts")
        public Map<String, Long> getReviewCounts(java.security.Principal principal) {
                String email = principal.getName();
                User user = userRepository.findByEmail(email).orElseThrow();
                Long userId = user.getId();

                Map<String, Long> counts = new HashMap<>();
                counts.put("pendingPMReview", taskRepository.countPmReviewTasksByUserIdAndStatus(userId, "Pending PM Review"));
                counts.put("rejected", taskRepository.countPmReviewTasksByUserIdAndStatus(userId, "Rejected"));
                counts.put("awaitingClarification", taskRepository.countPmReviewTasksByUserIdAndStatus(userId, "Awaiting Clarification"));
                counts.put("approvedAwaitingAssignment", taskRepository.countPmReviewTasksByUserIdAndStatus(userId, "Approved Awaiting Assignment"));
                return counts;
        }

        @GetMapping("/summary")
        public Map<String, Object> getSummary(java.security.Principal principal) {
                String email = principal.getName();
                User user = userRepository.findByEmail(email).orElseThrow();
                String role = user.getRole().name();

                Map<String, Object> stats = new HashMap<>();

                // Get all projects the user is involved in (synchronized with ProjectService
                // logic)
                List<Project> userProjects = projectService.getAllProjects(user.getId(), role);

                List<Long> projectIds = userProjects.stream().map(Project::getId).collect(Collectors.toList());

                // Get all tasks in those projects using targeted query
                List<Task> projectTasks = projectIds.isEmpty()
                                ? Collections.emptyList()
                                : taskRepository.findByProjectIdIn(projectIds);

                // Active Sprint Logic
                List<Sprint> activeSprints = projectIds.isEmpty()
                                ? Collections.emptyList()
                                : sprintRepository.findByProjectIdIn(projectIds).stream()
                                                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()))
                                                .sorted(Comparator.comparing(Sprint::getId).reversed())
                                                .collect(Collectors.toList());

                List<Long> activeSprintIds = activeSprints.stream().map(Sprint::getId).collect(Collectors.toList());

                // 1. Identify relevant user IDs based on RBAC to show team stats
                final Long currentUserId = user.getId();
                List<Long> targetUserIds = new ArrayList<>();
                if ("ADMIN".equalsIgnoreCase(role)) {
                        targetUserIds = userRepository.findAll().stream().map(User::getId).collect(Collectors.toList());
                } else {
                        targetUserIds.add(currentUserId);
                        if ("MANAGER".equalsIgnoreCase(role)) {
                                if (user.getTenant() != null) {
                                        List<Long> tenantUserIds = userRepository.findByTenant_Id(user.getTenant().getId()).stream()
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(tenantUserIds);
                                } else {
                                        List<Long> onboarded = userRepository.findAll().stream()
                                                        .filter(u -> u.getOnboardedBy() != null
                                                                        && u.getOnboardedBy().equals(currentUserId))
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(onboarded);
                                }
                        }
                }
                final List<Long> finalIds = targetUserIds;

                List<Task> teamTasks = projectTasks.stream()
                                .filter(t -> "ADMIN".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role) || (t.getAssignee() != null && finalIds.contains(t.getAssignee().getId())))
                                .collect(Collectors.toList());

                final String currentEmpId = user.getEmpId();
                List<Task> personalTasks = taskRepository.findAll().stream()
                                .filter(t -> isTaskAssignedToUser(t, currentUserId, currentEmpId, email))
                                .collect(Collectors.toList());

                // For system summary cards: count personal standalone tasks and standalone bugs (parentTask == null) assigned to or co-assigned to current user
                List<Task> summaryTasks = personalTasks.stream()
                                .filter(t -> t.getParentTask() == null)
                                .collect(Collectors.toList());

                long openTasks = summaryTasks.stream()
                                .filter(t -> t.getStatus() != null && !isDoneStatus(t.getStatus()) && !isReviewStatus(t.getStatus()))
                                .count();
                long completedTasks = summaryTasks.stream()
                                .filter(t -> t.getStatus() != null && isDoneStatus(t.getStatus()))
                                .count();
                long uatTasks = summaryTasks.stream().filter(t -> "UAT".equalsIgnoreCase(t.getStatus())).count();
                long activeProjectsCount = userProjects.size();
                long totalEpics = personalTasks.stream()
                                .filter(t -> "EPIC".equalsIgnoreCase(t.getIssueType())
                                                && t.getStatus() != null
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();

                long linkedIssuesCount = personalTasks.stream()
                                .filter(t -> t.getTags() != null && t.getTags().contains("_link"))
                                .count();

                stats.put("openTasks", openTasks);
                stats.put("tasksCompleted", completedTasks);
                stats.put("activeProjects", activeProjectsCount);
                stats.put("totalEpics", totalEpics);
                stats.put("linkedIssues", linkedIssuesCount);
                stats.put("uatTasks", uatTasks);

                // Calculate Trends
                LocalDateTime lastWeek = LocalDateTime.now().minusDays(7);
                LocalDateTime lastMonth = LocalDateTime.now().minusDays(30);

                long openTasksLastWeek = summaryTasks.stream()
                                .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().isAfter(lastWeek)
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();
                long completedTasksLastWeek = summaryTasks.stream()
                                .filter(t -> t.getUpdatedAt() != null && t.getUpdatedAt().isAfter(lastWeek)
                                                && isDoneStatus(t.getStatus()))
                                .count();
                long newProjectsLastMonth = userProjects.stream()
                                .filter(p -> p.getCreatedAt() != null && p.getCreatedAt().isAfter(lastMonth))
                                .count();

                stats.put("openTasksTrend", "+" + openTasksLastWeek + " this week");
                stats.put("tasksCompletedTrend", "+" + completedTasksLastWeek + " this week");
                stats.put("activeProjectsTrend", "+" + newProjectsLastMonth + " this month");

                long newEpicsLastMonth = personalTasks.stream()
                                .filter(t -> "EPIC".equalsIgnoreCase(t.getIssueType()) && t.getCreatedAt() != null
                                                && t.getCreatedAt().isAfter(lastMonth))
                                .count();
                stats.put("totalEpicsTrend", "+" + newEpicsLastMonth + " this month");

                // Active Sprint Logic (activeSprints already calculated above)

                if (!activeSprints.isEmpty()) {
                        Sprint s = activeSprints.get(0);
                        List<Task> sprintTasks = projectTasks.stream()
                                        .filter(t -> t.getSprint() != null && t.getSprint().getId().equals(s.getId()))
                                        .filter(t -> (t.getAssignee() != null && t.getAssignee().getId().equals(currentUserId))
                                                  || (t.getCoAssignee() != null && t.getCoAssignee().getId().equals(currentUserId)))
                                        .collect(Collectors.toList());

                        long sprintCompleted = sprintTasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getStatus()))
                                        .count();
                        int progress = sprintTasks.isEmpty() ? 0 : (int) ((sprintCompleted * 100) / sprintTasks.size());

                        Map<String, Object> sprintData = new HashMap<>();
                        sprintData.put("name", s.getName());
                        sprintData.put("progress", progress);
                        sprintData.put("projectId", s.getProject().getId());
                        stats.put("activeSprint", sprintData);
                } else {
                        stats.put("activeSprint", null);
                }

                long overdueCount = summaryTasks.stream()
                                .filter(t -> t.getDueDate() != null
                                                && t.getDueDate().isBefore(java.time.LocalDate.now())
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();
                stats.put("overdueTasks", overdueCount);

                // Count unique teammates in user's own projects (excluding the user themselves)
                long teamMembersCount = userProjects.stream()
                                .flatMap(p -> p.getTeamMembers().stream())
                                .map(User::getId)
                                .filter(id -> !id.equals(currentUserId))
                                .distinct()
                                .count();
                stats.put("teamMembers", teamMembersCount);

                // RBAC Workload Distribution - Real team members only (exclude unassigned)
                List<Map<String, Object>> workloadList = teamTasks.stream()
                                .filter(t -> t.getAssignee() != null)
                                .filter(t -> !"BUG".equalsIgnoreCase(t.getIssueType()))
                                .collect(Collectors.groupingBy(
                                                t -> t.getAssignee().getId() + "|||" + t.getAssignee().getName(),
                                                Collectors.counting()))
                                .entrySet().stream()
                                .map(entry -> {
                                        Map<String, Object> item = new HashMap<>();
                                        String[] parts = entry.getKey().split("\\|\\|\\|");
                                        item.put("assigneeId", parts[0]);
                                        item.put("name", parts.length > 1 ? parts[1] : entry.getKey());
                                        item.put("taskCount", entry.getValue());
                                        return item;
                                })
                                .sorted((a, b) -> ((Long) b.get("taskCount")).compareTo((Long) a.get("taskCount")))
                                .limit(10)
                                .collect(Collectors.toList());

                stats.put("workloadDistribution", workloadList);
                return stats;
        }

        @GetMapping("/dashboard-tasks")
        public List<Task> getDashboardTasks(java.security.Principal principal) {
                String email = principal.getName();
                User user = userRepository.findByEmail(email).orElseThrow();
                String role = user.getRole().name();

                List<Project> userProjects = projectService.getAllProjects(user.getId(), role);
                List<Long> projectIds = userProjects.stream().map(Project::getId).collect(Collectors.toList());

                List<Task> projectTasks = projectIds.isEmpty()
                                ? Collections.emptyList()
                                : taskRepository.findByProjectIdIn(projectIds);

                final Long currentUserId = user.getId();
                List<Long> targetUserIds = new ArrayList<>();
                if ("ADMIN".equalsIgnoreCase(role)) {
                        targetUserIds = userRepository.findAll().stream().map(User::getId).collect(Collectors.toList());
                } else {
                        targetUserIds.add(currentUserId);
                        if ("MANAGER".equalsIgnoreCase(role)) {
                                if (user.getTenant() != null) {
                                        List<Long> tenantUserIds = userRepository.findByTenant_Id(user.getTenant().getId()).stream()
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(tenantUserIds);
                                } else {
                                        List<Long> onboarded = userRepository.findAll().stream()
                                                        .filter(u -> u.getOnboardedBy() != null
                                                                        && u.getOnboardedBy().equals(currentUserId))
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(onboarded);
                                }
                        }
                }

                final String currentEmpId = user.getEmpId();
                List<Task> myTasks = taskRepository.findAll().stream()
                                .filter(t -> isTaskAssignedToUser(t, currentUserId, currentEmpId, email))
                                .filter(t -> t.getParentTask() == null)
                                .filter(t -> t.getStatus() != null && !isReviewStatus(t.getStatus()))
                                .collect(Collectors.toList());

                return myTasks;
        }

        private boolean isDoneStatus(String status) {
                if (status == null) return false;
                String norm = status.trim().toUpperCase();
                return "DONE".equals(norm) || "COMPLETED".equals(norm) || "CLOSED".equals(norm);
        }

        private boolean isReviewStatus(String status) {
                if (status == null) return false;
                String norm = status.trim().toUpperCase();
                return "PENDING PM REVIEW".equals(norm) || "AWAITING CLARIFICATION".equals(norm) || "REJECTED".equals(norm);
        }

        private boolean isTaskAssignedToUser(Task t, Long currentUserId, String userEmpId, String userEmail) {
                if (t == null) return false;
                boolean isAssignee = t.getAssignee() != null && (
                        (currentUserId != null && currentUserId.equals(t.getAssignee().getId())) ||
                        (userEmpId != null && !userEmpId.isEmpty() && userEmpId.equalsIgnoreCase(t.getAssignee().getEmpId())) ||
                        (userEmail != null && !userEmail.isEmpty() && userEmail.equalsIgnoreCase(t.getAssignee().getEmail()))
                );
                boolean isCoAssignee = t.getCoAssignee() != null && (
                        (currentUserId != null && currentUserId.equals(t.getCoAssignee().getId())) ||
                        (userEmpId != null && !userEmpId.isEmpty() && userEmpId.equalsIgnoreCase(t.getCoAssignee().getEmpId())) ||
                        (userEmail != null && !userEmail.isEmpty() && userEmail.equalsIgnoreCase(t.getCoAssignee().getEmail()))
                );
                return isAssignee || isCoAssignee;
        }

        @GetMapping("/project/{id}")
        public Map<String, Object> getProjectStats(@PathVariable Long id, java.security.Principal principal) {
                Project project = projectRepository.findById(id).orElseThrow();
                String email = principal.getName();

                User user = userRepository.findByEmail(email).orElseThrow();
                final Long currentUserId = user.getId();
                final String currentRole = user.getRole().name();

                List<Long> targetUserIds = new ArrayList<>();
                if ("ADMIN".equalsIgnoreCase(currentRole)) {
                        targetUserIds = userRepository.findAll().stream().map(User::getId).collect(Collectors.toList());
                } else {
                        targetUserIds.add(currentUserId);
                        if ("MANAGER".equalsIgnoreCase(currentRole)) {
                                if (user.getTenant() != null) {
                                        List<Long> tenantUserIds = userRepository.findByTenant_Id(user.getTenant().getId()).stream()
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(tenantUserIds);
                                } else {
                                        List<Long> onboarded = userRepository.findAll().stream()
                                                        .filter(u -> u.getOnboardedBy() != null
                                                                        && u.getOnboardedBy().equals(currentUserId))
                                                        .map(User::getId)
                                                        .collect(Collectors.toList());
                                        targetUserIds.addAll(onboarded);
                                }
                        }
                }
                final List<Long> finalIds = targetUserIds;

                List<Task> allTasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(id);

                long openTasks = allTasks.stream()
                                .filter(t -> t.getStatus() != null && !isDoneStatus(t.getStatus()) && !isReviewStatus(t.getStatus()))
                                .count();
                long completedTasks = allTasks.stream()
                                .filter(t -> t.getStatus() != null && isDoneStatus(t.getStatus()))
                                .count();
                long highPriorityTasks = allTasks.stream()
                                .filter(t -> "HIGH".equalsIgnoreCase(t.getPriority())
                                                && t.getStatus() != null
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();
                long overdueTasks = allTasks.stream()
                                .filter(t -> t.getDueDate() != null
                                                && t.getDueDate().isBefore(java.time.LocalDate.now())
                                                && t.getStatus() != null
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();
                long myOpenTasks = allTasks.stream().filter(t -> 
                                ((t.getAssignee() != null && t.getAssignee().getEmail().equalsIgnoreCase(email)) ||
                                 (t.getCoAssignee() != null && t.getCoAssignee().getEmail().equalsIgnoreCase(email)))
                                 && t.getStatus() != null
                                 && !isDoneStatus(t.getStatus())
                                 && !isReviewStatus(t.getStatus()))
                                .count();

                double completionRate = allTasks.isEmpty() ? 0 : (double) completedTasks / allTasks.size() * 100;

                List<Sprint> sprints = sprintRepository.findByProjectId(id);
                Sprint activeSprint = sprints.stream().filter(s -> "ACTIVE".equals(s.getStatus())).findFirst()
                                .orElse(null);

                Map<String, Object> stats = new HashMap<>();
                stats.put("projectName", project.getName());
                stats.put("openTasks", openTasks);
                stats.put("completedTasks", completedTasks);
                stats.put("totalTasks", allTasks.size());
                stats.put("highPriorityTasks", highPriorityTasks);
                stats.put("overdueTasks", overdueTasks);
                stats.put("myOpenTasks", myOpenTasks);
                stats.put("completionRate", Math.round(completionRate));
                stats.put("memberCount", project.getTeamMembers() != null ? project.getTeamMembers().size() : 0);

                long totalEpics = allTasks.stream()
                                .filter(t -> "EPIC".equalsIgnoreCase(t.getIssueType())
                                                && t.getStatus() != null
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();

                long linkedIssuesCount = allTasks.stream()
                                .filter(t -> t.getTags() != null && t.getTags().contains("_link"))
                                .count();

                stats.put("totalEpics", totalEpics);
                stats.put("linkedIssues", linkedIssuesCount);

                LocalDateTime lastWeek = LocalDateTime.now().minusDays(7);
                LocalDateTime lastMonth = LocalDateTime.now().minusDays(30);

                long openTasksLastWeek = allTasks.stream()
                                .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().isAfter(lastWeek)
                                                && t.getStatus() != null
                                                && !isDoneStatus(t.getStatus())
                                                && !isReviewStatus(t.getStatus()))
                                .count();
                long completedTasksLastWeek = allTasks.stream()
                                .filter(t -> t.getUpdatedAt() != null && t.getUpdatedAt().isAfter(lastWeek)
                                                && t.getStatus() != null
                                                && isDoneStatus(t.getStatus()))
                                .count();
                long newEpicsLastMonth = allTasks.stream()
                                .filter(t -> "EPIC".equalsIgnoreCase(t.getIssueType()) && t.getCreatedAt() != null
                                                && t.getCreatedAt().isAfter(lastMonth))
                                .count();

                stats.put("openTasksTrend", "+" + openTasksLastWeek + " this week");
                stats.put("tasksCompletedTrend", "+" + completedTasksLastWeek + " this week");
                stats.put("totalEpicsTrend", "+" + newEpicsLastMonth + " this month");

                if (activeSprint != null) {
                        Map<String, Object> sMap = new HashMap<>();
                        sMap.put("name", activeSprint.getName());
                        sMap.put("id", activeSprint.getId());

                        long sprintTasksCount = allTasks.stream()
                                        .filter(t -> t.getSprint() != null
                                                        && t.getSprint().getId().equals(activeSprint.getId()))
                                        .count();
                        long sprintDoneCount = allTasks.stream().filter(t -> t.getSprint() != null
                                        && t.getSprint().getId().equals(activeSprint.getId())
                                        && "DONE".equalsIgnoreCase(t.getStatus()))
                                        .count();

                        sMap.put("totalTasks", sprintTasksCount);
                        sMap.put("completedTasks", sprintDoneCount);

                        if (activeSprint.getEndDate() != null) {
                                long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(LocalDateTime.now(),
                                                activeSprint.getEndDate().atStartOfDay());
                                sMap.put("daysLeft", Math.max(0, daysLeft));
                        }
                        stats.put("activeSprint", sMap);
                } else {
                        stats.put("activeSprint", null);
                }

                // RBAC & Onboarding Filtered Workload - Refactored for Accuracy (all standalone tasks & standalone bugs)
                List<Map<String, Object>> workloadList = allTasks.stream()
                                .filter(t -> t.getAssignee() != null)
                                .filter(t -> !"BUG".equalsIgnoreCase(t.getIssueType()))
                                .filter(t -> "ADMIN".equalsIgnoreCase(currentRole) || "MANAGER".equalsIgnoreCase(currentRole) || finalIds.contains(t.getAssignee().getId()))
                                .collect(Collectors.groupingBy(
                                                 t -> t.getAssignee().getId() + "|||" + t.getAssignee().getName(),
                                                 Collectors.counting()))
                                .entrySet().stream()
                                .map(entry -> {
                                        Map<String, Object> item = new HashMap<>();
                                        String[] parts = entry.getKey().split("\\|\\|\\|");
                                        item.put("assigneeId", parts[0]);
                                        item.put("name", parts.length > 1 ? parts[1] : entry.getKey());
                                        item.put("taskCount", entry.getValue());
                                        return item;
                                })
                                .sorted((a, b) -> ((Long) b.get("taskCount")).compareTo((Long) a.get("taskCount")))
                                .limit(10)
                                .collect(Collectors.toList());

                stats.put("workloadDistribution", workloadList);
                return stats;
        }
}
