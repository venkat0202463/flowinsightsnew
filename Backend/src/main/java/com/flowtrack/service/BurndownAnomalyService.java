package com.flowtrack.service;

import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.dto.BurndownDailyPointDto;
import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.SprintScopeChange;
import com.flowtrack.model.Task;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BurndownAnomalyService {

    // Configurable thresholds
    private static final int FLAT_WORKING_DAYS_THRESHOLD = 3;
    private static final int PROLONGED_NO_PROGRESS_DAYS = 4;
    private static final double UPWARD_SPIKE_RATIO_THRESHOLD = 0.10; // 10% of initial commitment
    private static final double LAST_DAY_SPIKE_RATIO_THRESHOLD = 0.40; // 40% of initial commitment
    private static final double SCOPE_INCREASE_RATIO_THRESHOLD = 0.10; // 10% in one event
    private static final double CUMULATIVE_SCOPE_CREEP_THRESHOLD = 25.0; // 25% SCI

    public List<BurndownAlertDto> detectAnomalies(Sprint sprint,
                                                  int initialCommitment,
                                                  int currentScope,
                                                  List<BurndownDailyPointDto> dailyPoints,
                                                  List<SprintScopeChange> scopeChanges,
                                                  List<Task> tasks) {
        Map<String, BurndownAlertDto> alertsMap = new LinkedHashMap<>();

        if (initialCommitment <= 0 && currentScope <= 0) {
            return Collections.emptyList();
        }

        LocalDate today = LocalDate.now();
        List<BurndownDailyPointDto> historicalPoints = dailyPoints.stream()
                .filter(p -> p.getActualRemaining() != null)
                .collect(Collectors.toList());

        if (historicalPoints.isEmpty()) {
            return Collections.emptyList();
        }

        // =========================================================================
        // A. Detect Long Flat Periods (3 consecutive working days with 0 progress)
        // =========================================================================
        int consecutiveFlatWorkingDays = 0;
        LocalDate flatPeriodStartDate = null;

        for (int i = 1; i < historicalPoints.size(); i++) {
            BurndownDailyPointDto prev = historicalPoints.get(i - 1);
            BurndownDailyPointDto curr = historicalPoints.get(i);

            LocalDate date = curr.getDate();
            boolean isWorkingDay = isWorkingDay(date);

            if (isWorkingDay) {
                double completedDiff = (curr.getCompletedPoints() != null && prev.getCompletedPoints() != null)
                        ? curr.getCompletedPoints() - prev.getCompletedPoints()
                        : 0.0;
                double remainingDiff = prev.getActualRemaining() - curr.getActualRemaining();

                if (completedDiff <= 0.0 && remainingDiff <= 0.0) {
                    consecutiveFlatWorkingDays++;
                    if (flatPeriodStartDate == null) {
                        flatPeriodStartDate = prev.getDate();
                    }
                } else {
                    consecutiveFlatWorkingDays = 0;
                    flatPeriodStartDate = null;
                }
            }
        }

        if (consecutiveFlatWorkingDays >= FLAT_WORKING_DAYS_THRESHOLD) {
            BurndownAlertDto alert = new BurndownAlertDto();
            alert.setId("FLAT_PERIOD_" + sprint.getId());
            alert.setType("LONG_FLAT_PERIOD");
            alert.setSeverity("WARNING");
            alert.setTitle("Long Flat Period Detected");
            alert.setDescription(String.format("No meaningful progress detected for %d consecutive working days (since %s).",
                    consecutiveFlatWorkingDays, flatPeriodStartDate != null ? flatPeriodStartDate : "recent days"));
            alert.setDetectionDate(today);
            alert.setAffectedDays(consecutiveFlatWorkingDays);
            alert.setPotentialCauses(Arrays.asList(
                    "Blocked tasks awaiting resolution, approvals, or PR reviews",
                    "Bottlenecks in quality assurance (QA) or staging environments",
                    "Dependencies on external services, APIs, or cross-functional teams",
                    "Work items progressing offline but not updated in FlowTrack"
            ));
            alert.setRecommendedAction("Review blocked tasks, PRs awaiting review, and external dependencies with the sprint team during the next standup.");
            alertsMap.put(alert.getId(), alert);
        }

        // =========================================================================
        // B. Detect Large Upward Spikes (>= 10% increase in remaining points)
        // =========================================================================
        double spikeThreshold = initialCommitment > 0
                ? Math.max(1.0, initialCommitment * UPWARD_SPIKE_RATIO_THRESHOLD)
                : 2.0;

        for (int i = 1; i < historicalPoints.size(); i++) {
            BurndownDailyPointDto prev = historicalPoints.get(i - 1);
            BurndownDailyPointDto curr = historicalPoints.get(i);

            double remainingIncrease = curr.getActualRemaining() - prev.getActualRemaining();
            if (remainingIncrease >= spikeThreshold) {
                String alertId = "UPWARD_SPIKE_" + sprint.getId() + "_" + curr.getDate();
                BurndownAlertDto alert = new BurndownAlertDto();
                alert.setId(alertId);
                alert.setType("LARGE_UPWARD_SPIKE");
                alert.setSeverity("WARNING");
                alert.setTitle("Large Upward Spike in Remaining Work");
                alert.setDetectionDate(curr.getDate());
                alert.setAffectedPoints((int) Math.round(remainingIncrease));

                double pct = initialCommitment > 0 ? (remainingIncrease / initialCommitment) * 100.0 : 0.0;
                String taskKeyInfo = curr.getEvents().stream()
                        .map(SprintScopeChangeDto::getTaskKey)
                        .filter(Objects::nonNull)
                        .distinct()
                        .collect(Collectors.joining(", "));

                alert.setDescription(String.format("Remaining work increased by +%.0f SP (%.1f%% of commitment) on %s (%s).",
                        remainingIncrease, pct, curr.getDate(), curr.getDayLabel()));
                if (!taskKeyInfo.isBlank()) {
                    alert.setRelatedTask(taskKeyInfo);
                }

                alert.setPotentialCauses(Arrays.asList(
                        "Unanticipated technical complexity uncovered mid-sprint",
                        "New user stories or bugs injected into the active sprint",
                        "Story point estimation upward revisions on active tasks"
                ));
                alert.setRecommendedAction("Assess newly added work against sprint goals; consider deferring non-essential items to protect commitment.");
                alertsMap.put(alert.getId(), alert);
            }
        }

        // =========================================================================
        // C. Detect Last-Day Completion Spikes (>= 40% completed on final day)
        // =========================================================================
        if (historicalPoints.size() >= 2 && initialCommitment > 0) {
            BurndownDailyPointDto finalRecordedPoint = historicalPoints.get(historicalPoints.size() - 1);
            LocalDate sprintEndDate = sprint.getEndDate() != null ? sprint.getEndDate() : finalRecordedPoint.getDate();

            boolean isAtOrPastEnd = !today.isBefore(sprintEndDate) || "COMPLETED".equalsIgnoreCase(sprint.getStatus());
            if (isAtOrPastEnd) {
                BurndownDailyPointDto prevPoint = historicalPoints.get(historicalPoints.size() - 2);
                double lastDayCompleted = 0.0;
                if (finalRecordedPoint.getCompletedPoints() != null && prevPoint.getCompletedPoints() != null) {
                    lastDayCompleted = finalRecordedPoint.getCompletedPoints() - prevPoint.getCompletedPoints();
                }

                double lastDayRatio = lastDayCompleted / (double) initialCommitment;
                if (lastDayRatio >= LAST_DAY_SPIKE_RATIO_THRESHOLD) {
                    BurndownAlertDto alert = new BurndownAlertDto();
                    alert.setId("LAST_DAY_SPIKE_" + sprint.getId());
                    alert.setType("LAST_DAY_COMPLETION_SPIKE");
                    alert.setSeverity("INFO");
                    alert.setTitle("Last-Day Completion Spike");
                    alert.setDetectionDate(finalRecordedPoint.getDate());
                    alert.setAffectedPoints((int) Math.round(lastDayCompleted));
                    alert.setDescription(String.format("%.0f story points (%.1f%% of initial commitment) were marked complete on the final sprint day.",
                            lastDayCompleted, lastDayRatio * 100.0));
                    alert.setPotentialCauses(Arrays.asList(
                            "Batch closing of completed tasks at the end of the sprint",
                            "QA verification crunch clustered on the deadline date",
                            "Delayed task status transitions in tool until sprint completion"
                    ));
                    alert.setRecommendedAction("Promote continuous delivery and daily incremental status updates throughout the sprint cycle.");
                    alertsMap.put(alert.getId(), alert);
                }
            }
        }

        // =========================================================================
        // D. Detect No Progress for Multiple Days (Prolonged Stagnation)
        // =========================================================================
        if (historicalPoints.size() >= PROLONGED_NO_PROGRESS_DAYS) {
            double totalCompletedSoFar = historicalPoints.get(historicalPoints.size() - 1).getCompletedPoints() != null
                    ? historicalPoints.get(historicalPoints.size() - 1).getCompletedPoints()
                    : 0.0;

            if (totalCompletedSoFar == 0.0 && historicalPoints.size() >= PROLONGED_NO_PROGRESS_DAYS) {
                BurndownAlertDto alert = new BurndownAlertDto();
                alert.setId("PROLONGED_NO_PROGRESS_" + sprint.getId());
                alert.setType("NO_PROGRESS_MULTIPLE_DAYS");
                alert.setSeverity("CRITICAL");
                alert.setTitle("Prolonged Stagnation — Zero Completed Work");
                alert.setDetectionDate(today);
                alert.setAffectedDays(historicalPoints.size());
                alert.setDescription(String.format("Sprint has reached %d days with 0 completed story points out of %d total scope.",
                        historicalPoints.size(), currentScope));
                alert.setPotentialCauses(Arrays.asList(
                        "Critical blocker halting development or deployment across the team",
                        "Team members reassigned to urgent production hotfixes",
                        "User stories are too large or lack clear acceptance criteria"
                ));
                alert.setRecommendedAction("Conduct an emergency sprint alignment standup to decompose large stories and remove blockers.");
                alertsMap.put(alert.getId(), alert);
            }
        }

        // =========================================================================
        // E. Detect Unexpected Scope Increases (>= 10% in one event OR SCI > 25%)
        // =========================================================================
        int totalAddedPoints = scopeChanges.stream()
                .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                .mapToInt(c -> c.getPointsDiff() != null ? Math.max(0, c.getPointsDiff()) : 0)
                .sum();

        double singleEventThreshold = initialCommitment > 0
                ? Math.max(1.0, initialCommitment * SCOPE_INCREASE_RATIO_THRESHOLD)
                : 3.0;

        Optional<SprintScopeChange> largeSingleEvent = scopeChanges.stream()
                .filter(c -> "TASK_ADDED".equalsIgnoreCase(c.getChangeType()) || "POINTS_INCREASED".equalsIgnoreCase(c.getChangeType()))
                .filter(c -> c.getPointsDiff() != null && c.getPointsDiff() >= singleEventThreshold)
                .max(Comparator.comparingInt(c -> c.getPointsDiff() != null ? c.getPointsDiff() : 0));

        double sci = initialCommitment > 0 ? ((double) totalAddedPoints / (double) initialCommitment) * 100.0 : 0.0;

        if (largeSingleEvent.isPresent() || sci >= CUMULATIVE_SCOPE_CREEP_THRESHOLD) {
            BurndownAlertDto alert = new BurndownAlertDto();
            alert.setId("SCOPE_INCREASE_" + sprint.getId());
            alert.setType("UNEXPECTED_SCOPE_INCREASE");
            alert.setSeverity(sci > 40.0 ? "CRITICAL" : "WARNING");
            alert.setTitle("Unexpected Scope Increase (Scope Creep)");
            alert.setDetectionDate(today);
            alert.setAffectedPoints(totalAddedPoints);

            if (largeSingleEvent.isPresent()) {
                SprintScopeChange ev = largeSingleEvent.get();
                alert.setRelatedTask(ev.getTaskKey());
                alert.setDescription(String.format("Added scope has reached +%d SP (Scope Creep Index: %.1f%%). Single major addition: +%d SP on %s (%s).",
                        totalAddedPoints, sci, ev.getPointsDiff(), ev.getTaskKey() != null ? ev.getTaskKey() : "Task", ev.getTaskTitle()));
            } else {
                alert.setDescription(String.format("Added scope has reached +%d SP after sprint start (Scope Creep Index: %.1f%%).",
                        totalAddedPoints, sci));
            }

            alert.setPotentialCauses(Arrays.asList(
                    "Unplanned user stories or stakeholder requests added mid-sprint",
                    "Emergency defects or technical debt added without swapping scope",
                    "Insufficient backlog grooming prior to sprint commitment"
            ));
            alert.setRecommendedAction("Follow sprint change management principles: trade off lower-priority scope when accepting new work.");
            alertsMap.put(alert.getId(), alert);
        }

        // Return alerts sorted by severity: CRITICAL first, then WARNING, then INFO
        List<BurndownAlertDto> result = new ArrayList<>(alertsMap.values());
        result.sort((a, b) -> Integer.compare(getSeverityRank(a.getSeverity()), getSeverityRank(b.getSeverity())));
        return result;
    }

    private int getSeverityRank(String severity) {
        if ("CRITICAL".equalsIgnoreCase(severity)) return 1;
        if ("WARNING".equalsIgnoreCase(severity)) return 2;
        return 3;
    }

    private boolean isWorkingDay(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
    }
}
