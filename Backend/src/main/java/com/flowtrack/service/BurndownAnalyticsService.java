package com.flowtrack.service;

import com.flowtrack.dto.BurndownDailyPointDto;
import com.flowtrack.dto.BurndownResponseDto;
import com.flowtrack.dto.BurndownSummaryDto;
import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.SprintScopeChange;
import com.flowtrack.model.Task;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.repository.SprintScopeChangeRepository;
import com.flowtrack.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class BurndownAnalyticsService {

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private SprintScopeChangeRepository scopeChangeRepository;

    @Autowired
    private SprintScopeChangeService scopeChangeService;

    @Autowired
    private BurndownAnomalyService anomalyService;

    @Autowired
    private com.flowtrack.repository.TaskHistoryRepository taskHistoryRepository;

    public BurndownResponseDto calculateBurndown(Long sprintId) {
        return getBurndownAnalytics(sprintId);
    }

    public BurndownResponseDto getBurndownAnalytics(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found: " + sprintId));

        List<Task> tasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(sprintId);
        List<SprintScopeChange> scopeChanges = scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(sprintId);

        // Date calculation
        LocalDate startDate = sprint.getStartDate() != null ? sprint.getStartDate() : LocalDate.now().minusDays(14);
        LocalDate endDate = sprint.getEndDate() != null ? sprint.getEndDate() : startDate.plusDays(14);
        if (endDate.isBefore(startDate)) {
            endDate = startDate.plusDays(14);
        }
        long totalDays = Math.max(1, ChronoUnit.DAYS.between(startDate, endDate));

        // Initial commitment resolution
        int currentTaskPointsSum = tasks.stream()
                .mapToInt(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                .sum();

        int initialCommitment;
        if (sprint.getInitialCommitmentPoints() != null) {
            initialCommitment = sprint.getInitialCommitmentPoints();
        } else if (!scopeChanges.isEmpty()) {
            // Reconstruct initial commitment from recorded scope changes
            int addedSoFar = scopeChanges.stream()
                    .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                    .mapToInt(c -> c.getPointsDiff() != null ? Math.max(0, c.getPointsDiff()) : 0)
                    .sum();
            int removedSoFar = scopeChanges.stream()
                    .filter(c -> "TASK_REMOVED".equalsIgnoreCase(c.getChangeType()) || "POINTS_DECREASED".equalsIgnoreCase(c.getChangeType()))
                    .mapToInt(c -> c.getPointsDiff() != null ? Math.abs(c.getPointsDiff()) : 0)
                    .sum();
            initialCommitment = Math.max(0, currentTaskPointsSum - addedSoFar + removedSoFar);
            sprint.setInitialCommitmentPoints(initialCommitment);
            sprintRepository.save(sprint);
        } else {
            initialCommitment = currentTaskPointsSum;
            sprint.setInitialCommitmentPoints(initialCommitment);
            if (sprint.getActivatedAt() == null && "ACTIVE".equalsIgnoreCase(sprint.getStatus())) {
                sprint.setActivatedAt(java.time.LocalDateTime.now());
            }
            sprintRepository.save(sprint);
        }

        // Scope change statistics
        int addedPoints = scopeChanges.stream()
                .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                .mapToInt(c -> c.getPointsDiff() != null ? Math.max(0, c.getPointsDiff()) : 0)
                .sum();

        int removedPoints = scopeChanges.stream()
                .filter(c -> "TASK_REMOVED".equalsIgnoreCase(c.getChangeType()) || "POINTS_DECREASED".equalsIgnoreCase(c.getChangeType()))
                .mapToInt(c -> c.getPointsDiff() != null ? Math.abs(c.getPointsDiff()) : 0)
                .sum();

        int currentScope = currentTaskPointsSum;

        // Completed points (do not count removed tasks)
        int completedPoints = tasks.stream()
                .filter(this::isTaskDone)
                .mapToInt(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                .sum();

        int remainingPoints = Math.max(0, currentScope - completedPoints);

        // Scope Creep Index (SCI) formula: (Added Points / Initial Commitment) * 100
        Double sci = null;
        if (initialCommitment > 0) {
            sci = Math.round(((double) addedPoints / (double) initialCommitment) * 1000.0) / 10.0;
        }

        // Completion percentage: (Completed / Current Scope) * 100
        Double completionPct = 0.0;
        if (currentScope > 0) {
            completionPct = Math.min(100.0, Math.round(((double) completedPoints / (double) currentScope) * 1000.0) / 10.0);
        } else if (completedPoints > 0) {
            completionPct = 100.0;
        }

        LocalDate today = LocalDate.now();

        // Build daily burndown points
        List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();
        Map<LocalDate, List<SprintScopeChange>> changesByDate = scopeChanges.stream()
                .collect(Collectors.groupingBy(c -> c.getChangedAt().toLocalDate()));

        for (int dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
            LocalDate date = startDate.plusDays(dayIndex);
            BurndownDailyPointDto pt = new BurndownDailyPointDto();
            pt.setDayIndex(dayIndex);
            pt.setDate(date);
            pt.setDayLabel("D" + dayIndex);

            // Ideal remaining burn line
            double ideal = Math.max(0.0, (double) initialCommitment - (((double) initialCommitment / totalDays) * dayIndex));
            pt.setIdealRemaining(Math.round(ideal * 10.0) / 10.0);
            pt.setOriginalCommitment((double) initialCommitment);

            // Scope changes on this date
            List<SprintScopeChange> dayChanges = changesByDate.getOrDefault(date, Collections.emptyList());
            List<SprintScopeChangeDto> dayEventDtos = dayChanges.stream()
                    .map(scopeChangeService::toDto)
                    .collect(Collectors.toList());
            pt.setEvents(dayEventDtos);

            double dayAdded = dayChanges.stream()
                    .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                    .mapToDouble(c -> c.getPointsDiff() != null ? Math.max(0, c.getPointsDiff()) : 0)
                    .sum();
            double dayRemoved = dayChanges.stream()
                    .filter(c -> "TASK_REMOVED".equalsIgnoreCase(c.getChangeType()) || "POINTS_DECREASED".equalsIgnoreCase(c.getChangeType()))
                    .mapToDouble(c -> c.getPointsDiff() != null ? Math.abs(c.getPointsDiff()) : 0)
                    .sum();
            pt.setAddedPoints(dayAdded);
            pt.setRemovedPoints(dayRemoved);

            // Task IDs already accounted for in TASK_ADDED scope changes on this day
            Set<Long> tasksAddedViaScopeChangeOnDate = dayChanges.stream()
                    .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) && c.getTaskId() != null)
                    .map(SprintScopeChange::getTaskId)
                    .collect(Collectors.toSet());

            // Tasks in this sprint that were created on this date
            double tasksCreatedOnDate = tasks.stream()
                    .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().toLocalDate().isEqual(date))
                    .filter(t -> !tasksAddedViaScopeChangeOnDate.contains(t.getId()))
                    .mapToDouble(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                    .sum();

            // Net scope changes on this date (task additions + points increases - points decreases/removals)
            double netScopeChanges = Math.max(0.0, dayAdded - dayRemoved);

            double dayCreated = Math.max(0.0, tasksCreatedOnDate + netScopeChanges);
            pt.setDailyCreated(Math.round(dayCreated * 10.0) / 10.0);

            double dayCompleted = 0.0;
            if (!date.isAfter(today) || !"ACTIVE".equalsIgnoreCase(sprint.getStatus())) {
                dayCompleted = tasks.stream()
                        .filter(this::isTaskDone)
                        .filter(t -> {
                            LocalDate compDate = getTaskCompletionDate(t, startDate);
                            if (date.isEqual(startDate)) {
                                return !compDate.isAfter(startDate);
                            } else {
                                return compDate.isEqual(date);
                            }
                        })
                        .mapToDouble(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                        .sum();
            }
            pt.setDailyCompleted(Math.round(dayCompleted * 10.0) / 10.0);

            // Calculate cumulative scope and completed work on or before this day
            if (date.isAfter(today) && "ACTIVE".equalsIgnoreCase(sprint.getStatus())) {
                pt.setActualRemaining(null);
                pt.setCurrentScope((double) currentScope);
                pt.setCompletedPoints(null);
            } else {
                // Compute cumulative completed work by `date`
                double cumulativeCompleted = tasks.stream()
                        .filter(this::isTaskDone)
                        .filter(t -> {
                            LocalDate compDate = getTaskCompletionDate(t, startDate);
                            return !compDate.isAfter(date);
                        })
                        .mapToDouble(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                        .sum();

                // Compute cumulative added and removed scope up to `date`
                double cumulativeAdded = scopeChanges.stream()
                        .filter(c -> !c.getChangedAt().toLocalDate().isAfter(date))
                        .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                        .mapToDouble(c -> c.getPointsDiff() != null ? Math.max(0, c.getPointsDiff()) : 0)
                        .sum();

                double cumulativeRemoved = scopeChanges.stream()
                        .filter(c -> !c.getChangedAt().toLocalDate().isAfter(date))
                        .filter(c -> "TASK_REMOVED".equalsIgnoreCase(c.getChangeType()) || "POINTS_DECREASED".equalsIgnoreCase(c.getChangeType()))
                        .mapToDouble(c -> c.getPointsDiff() != null ? Math.abs(c.getPointsDiff()) : 0)
                        .sum();

                double scopeAtDate;
                if (scopeChanges.isEmpty()) {
                    scopeAtDate = tasks.stream()
                            .filter(t -> {
                                if (t.getCreatedAt() == null) return true;
                                LocalDate cDate = t.getCreatedAt().toLocalDate();
                                return !cDate.isAfter(date);
                            })
                            .mapToDouble(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                            .sum();
                    if (dayIndex > 0 && !dailyPoints.isEmpty()) {
                        double prevScope = dailyPoints.get(dayIndex - 1).getCurrentScope() != null
                                ? dailyPoints.get(dayIndex - 1).getCurrentScope() : 0.0;
                        scopeAtDate = Math.max(scopeAtDate, prevScope);
                    }
                } else {
                    scopeAtDate = Math.max(0.0, initialCommitment + cumulativeAdded - cumulativeRemoved);
                }

                double actualRemainingAtDate = Math.max(0.0, scopeAtDate - cumulativeCompleted);
                pt.setActualRemaining(Math.round(actualRemainingAtDate * 10.0) / 10.0);
                pt.setCurrentScope(Math.round(scopeAtDate * 10.0) / 10.0);
                pt.setCompletedPoints(Math.round(cumulativeCompleted * 10.0) / 10.0);
            }

            dailyPoints.add(pt);
        }

        // Detect burndown anomalies
        List<BurndownAlertDto> anomalies = anomalyService.detectAnomalies(
                sprint, initialCommitment, currentScope, dailyPoints, scopeChanges, tasks
        );

        // Build Summary DTO
        BurndownSummaryDto summary = new BurndownSummaryDto();
        summary.setSprintId(sprint.getId());
        summary.setSprintName(sprint.getName());
        summary.setStartDate(startDate);
        summary.setEndDate(endDate);
        summary.setStatus(sprint.getStatus());
        summary.setInitialCommitment(initialCommitment);
        summary.setCurrentScope(currentScope);
        summary.setAddedPoints(addedPoints);
        summary.setRemovedPoints(removedPoints);
        summary.setCompletedPoints(completedPoints);
        summary.setRemainingPoints(remainingPoints);
        summary.setScopeCreepIndex(sci);
        summary.setCompletionPercentage(completionPct);
        summary.setActiveAlertsCount(anomalies.size());

        List<SprintScopeChangeDto> allScopeChangesDto = scopeChanges.stream()
                .sorted(Comparator.comparing(SprintScopeChange::getChangedAt).reversed())
                .map(scopeChangeService::toDto)
                .collect(Collectors.toList());

        return new BurndownResponseDto(summary, dailyPoints, anomalies, allScopeChangesDto);
    }

    public BurndownSummaryDto getBurndownSummary(Long sprintId) {
        return getBurndownAnalytics(sprintId).getSummary();
    }

    public List<SprintScopeChangeDto> getScopeChanges(Long sprintId) {
        return scopeChangeService.getScopeChangesForSprint(sprintId);
    }

    public List<BurndownAlertDto> getAnomalies(Long sprintId) {
        return getBurndownAnalytics(sprintId).getAnomalies();
    }

    private boolean isTaskDone(Task task) {
        if (task == null || task.getStatus() == null) return false;
        String s = task.getStatus().trim().toUpperCase();
        return s.equals("DONE") || s.equals("COMPLETED") || s.equals("FINISHED") || s.equals("CLOSED");
    }

    private LocalDate getTaskCompletionDate(Task task, LocalDate sprintStartDate) {
        if (task.getCompletedAt() != null) {
            return task.getCompletedAt().toLocalDate();
        }
        if (taskHistoryRepository != null && task.getId() != null) {
            try {
                List<com.flowtrack.model.TaskHistory> history = taskHistoryRepository.findByTaskIdOrderByCreatedAtDesc(task.getId());
                for (com.flowtrack.model.TaskHistory h : history) {
                    if ("STATUS_CHANGE".equalsIgnoreCase(h.getChangeType()) &&
                        h.getToValue() != null &&
                        ("DONE".equalsIgnoreCase(h.getToValue().trim()) || "COMPLETED".equalsIgnoreCase(h.getToValue().trim()))) {
                        if (h.getCreatedAt() != null) {
                            return h.getCreatedAt().toLocalDate();
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        if (task.getUpdatedAt() != null) {
            return task.getUpdatedAt().toLocalDate();
        }
        if (task.getCreatedAt() != null) {
            return task.getCreatedAt().toLocalDate();
        }
        return sprintStartDate;
    }
}
