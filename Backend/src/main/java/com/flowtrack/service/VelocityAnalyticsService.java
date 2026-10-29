package com.flowtrack.service;

import com.flowtrack.dto.VelocityAnalyticsResponseDto;
import com.flowtrack.dto.VelocitySprintDto;
import com.flowtrack.dto.VelocityStabilityDto;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.Task;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class VelocityAnalyticsService {

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    /**
     * Retrieves velocity analytics for historical completed sprints.
     *
     * @param projectId   Target project ID
     * @param sprintCount Optional filter: 3, 5, 10, or null/0 for all available completed sprints
     * @return VelocityAnalyticsResponseDto with sprint bars, trend data, and metrics
     */
    public VelocityAnalyticsResponseDto getVelocityAnalytics(Long projectId, Integer sprintCount) {
        validateProject(projectId);

        List<VelocitySprintDto> allCompletedSprints = getHistoricalCompletedSprints(projectId);

        // Filter to recent N sprints if specified
        List<VelocitySprintDto> selectedSprints = filterRecentSprints(allCompletedSprints, sprintCount);

        VelocityAnalyticsResponseDto response = new VelocityAnalyticsResponseDto();
        response.setProjectId(projectId);
        response.setSprints(selectedSprints);
        response.setSprintsAnalyzedCount(selectedSprints.size());

        if (selectedSprints.isEmpty()) {
            response.setAverageVelocity(0.0);
            response.setRoundedAverageVelocity(0L);
            response.setLatestSprintVelocity(0);
            response.setHighestSprintVelocity(0);
            response.setLowestSprintVelocity(0);
            response.setTotalCompletedPoints(0);
            return response;
        }

        int totalCompleted = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).sum();
        double avgVelocity = (double) totalCompleted / selectedSprints.size();
        avgVelocity = Math.round(avgVelocity * 100.0) / 100.0;

        int latest = selectedSprints.get(selectedSprints.size() - 1).getCompletedPoints();
        int highest = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).max().orElse(0);
        int lowest = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).min().orElse(0);

        response.setTotalCompletedPoints(totalCompleted);
        response.setAverageVelocity(avgVelocity);
        response.setRoundedAverageVelocity(Math.round(avgVelocity));
        response.setLatestSprintVelocity(latest);
        response.setHighestSprintVelocity(highest);
        response.setLowestSprintVelocity(lowest);

        return response;
    }

    /**
     * Calculates velocity stability metrics including population standard deviation,
     * coefficient of variation, and stability classification.
     *
     * @param projectId   Target project ID
     * @param sprintCount Window of completed sprints to evaluate
     * @return VelocityStabilityDto
     */
    public VelocityStabilityDto getVelocityStability(Long projectId, Integer sprintCount) {
        validateProject(projectId);

        List<VelocitySprintDto> allCompletedSprints = getHistoricalCompletedSprints(projectId);
        List<VelocitySprintDto> selectedSprints = filterRecentSprints(allCompletedSprints, sprintCount);

        VelocityStabilityDto stability = new VelocityStabilityDto();
        stability.setProjectId(projectId);
        stability.setSprintsAnalyzedCount(selectedSprints.size());

        if (selectedSprints.isEmpty()) {
            stability.setAverageVelocity(0.0);
            stability.setRoundedAverageVelocity(0L);
            stability.setRecentVelocity(0.0);
            stability.setRoundedRecentVelocity(0L);
            stability.setStandardDeviation(0.0);
            stability.setRoundedStandardDeviation(0L);
            stability.setCoefficientOfVariation(0.0);
            stability.setStabilityIndicator("N_A");
            stability.setStabilityDescription("No completed sprints available for stability analysis.");
            stability.setHighestVelocity(0);
            stability.setLowestVelocity(0);
            return stability;
        }

        int totalCompleted = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).sum();
        double avgVelocity = (double) totalCompleted / selectedSprints.size();
        avgVelocity = Math.round(avgVelocity * 100.0) / 100.0;

        // Recent velocity = average of the most recent up to 3 valid completed sprints
        int recentCount = Math.min(3, selectedSprints.size());
        List<VelocitySprintDto> recentWindow = selectedSprints.subList(selectedSprints.size() - recentCount, selectedSprints.size());
        double recentSum = recentWindow.stream().mapToDouble(VelocitySprintDto::getCompletedPoints).sum();
        double recentVelocity = Math.round((recentSum / recentCount) * 100.0) / 100.0;

        int highest = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).max().orElse(0);
        int lowest = selectedSprints.stream().mapToInt(VelocitySprintDto::getCompletedPoints).min().orElse(0);

        stability.setAverageVelocity(avgVelocity);
        stability.setRoundedAverageVelocity(Math.round(avgVelocity));
        stability.setRecentVelocity(recentVelocity);
        stability.setRoundedRecentVelocity(Math.round(recentVelocity));
        stability.setHighestVelocity(highest);
        stability.setLowestVelocity(lowest);

        // Standard deviation and Coefficient of Variation
        if (selectedSprints.size() < 2) {
            stability.setStandardDeviation(0.0);
            stability.setRoundedStandardDeviation(0L);
            stability.setCoefficientOfVariation(0.0);
            stability.setStabilityIndicator("N_A");
            stability.setStabilityDescription("At least 2 completed sprints are required to measure velocity stability.");
            return stability;
        }

        // Population Standard Deviation: sqrt( sum( (x_i - mean)^2 ) / N )
        double sumSquaredDiffs = 0.0;
        for (VelocitySprintDto s : selectedSprints) {
            double diff = s.getCompletedPoints() - avgVelocity;
            sumSquaredDiffs += diff * diff;
        }
        double variance = sumSquaredDiffs / selectedSprints.size();
        double stdDev = Math.sqrt(variance);
        double roundedStdDevExact = Math.round(stdDev * 100.0) / 100.0;

        stability.setStandardDeviation(roundedStdDevExact);
        stability.setRoundedStandardDeviation(Math.round(stdDev));

        // Coefficient of Variation: (stdDev / avgVelocity) * 100
        if (avgVelocity <= 0.0) {
            stability.setCoefficientOfVariation(0.0);
            stability.setStabilityIndicator("N_A");
            stability.setStabilityDescription("Average velocity is zero; stability coefficient cannot be determined.");
            return stability;
        }

        double cv = (stdDev / avgVelocity) * 100.0;
        double roundedCv = Math.round(cv * 10.0) / 10.0;
        stability.setCoefficientOfVariation(roundedCv);

        // Classification thresholds:
        // 0–10%: Stable
        // Above 10% to 25%: Moderately Variable
        // Above 25%: Highly Variable
        if (cv <= 10.0) {
            stability.setStabilityIndicator("STABLE");
            stability.setStabilityDescription("Velocity is highly consistent across sprints (variation within ±10%). Sprint predictability is optimal.");
        } else if (cv <= 25.0) {
            stability.setStabilityIndicator("MODERATELY_VARIABLE");
            stability.setStabilityDescription("Velocity shows moderate sprint-to-sprint fluctuation (10%–25%). Planning baseline should buffer for variability.");
        } else {
            stability.setStabilityIndicator("HIGHLY_VARIABLE");
            stability.setStabilityDescription("Velocity exhibits high variance (>25%). Investigate scope volatility, impediments, or story sizing differences.");
        }

        return stability;
    }

    /**
     * Extracts and computes all completed historical sprints in chronological order.
     */
    public List<VelocitySprintDto> getHistoricalCompletedSprints(Long projectId) {
        List<Sprint> allSprints = sprintRepository.findByProjectId(projectId);

        // Include non-planned sprints (COMPLETED or ACTIVE per existing business rules)
        List<Sprint> validSprints = allSprints.stream()
                .filter(s -> s.getStatus() != null && isValidVelocitySprint(s.getStatus()))
                .sorted((a, b) -> {
                    LocalDate d1 = a.getStartDate() != null ? a.getStartDate() : LocalDate.MIN;
                    LocalDate d2 = b.getStartDate() != null ? b.getStartDate() : LocalDate.MIN;
                    int cmp = d1.compareTo(d2);
                    if (cmp != 0) return cmp;
                    return Long.compare(a.getId() != null ? a.getId() : 0, b.getId() != null ? b.getId() : 0);
                })
                .collect(Collectors.toList());

        List<VelocitySprintDto> result = new ArrayList<>();
        for (Sprint sprint : validSprints) {
            List<Task> tasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(sprint.getId());

            int completedPoints = tasks.stream()
                    .filter(this::isTaskDone)
                    .mapToInt(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                    .sum();

            int taskTotalPoints = tasks.stream()
                    .mapToInt(t -> t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                    .sum();

            boolean isCompleted = isSprintCompleted(sprint.getStatus());
            int committedPoints;
            if (isCompleted) {
                if (sprint.getInitialCommitmentPoints() != null && sprint.getInitialCommitmentPoints() > 0) {
                    committedPoints = sprint.getInitialCommitmentPoints();
                } else {
                    committedPoints = taskTotalPoints;
                }
            } else {
                // For active sprints, created points accurately reflect the sprint's tasks
                if (taskTotalPoints > 0) {
                    committedPoints = taskTotalPoints;
                } else if (sprint.getInitialCommitmentPoints() != null && sprint.getInitialCommitmentPoints() > 0) {
                    committedPoints = sprint.getInitialCommitmentPoints();
                } else {
                    committedPoints = 0;
                }
            }

            if (committedPoints < completedPoints) {
                committedPoints = completedPoints;
            }

            int difference = completedPoints - committedPoints;

            result.add(new VelocitySprintDto(
                    sprint.getId(),
                    sprint.getName(),
                    sprint.getStartDate(),
                    sprint.getEndDate(),
                    sprint.getStatus(),
                    committedPoints,
                    completedPoints,
                    difference,
                    isCompleted
            ));
        }

        return result;
    }

    public boolean isValidVelocitySprint(String status) {
        if (status == null) return false;
        String s = status.trim().toUpperCase();
        return !s.equals("PLANNED") && !s.equals("CANCELLED");
    }

    public boolean isSprintCompleted(String status) {
        if (status == null) return false;
        String s = status.trim().toUpperCase();
        return s.equals("COMPLETED") || s.equals("CLOSED") || s.equals("FINISHED");
    }

    private boolean isTaskDone(Task task) {
        if (task == null || task.getStatus() == null) return false;
        String s = task.getStatus().trim().toLowerCase();
        return s.startsWith("done") || s.startsWith("complete") || s.startsWith("closed") || s.startsWith("resolved") || s.equals("finish");
    }

    private List<VelocitySprintDto> filterRecentSprints(List<VelocitySprintDto> list, Integer sprintCount) {
        if (sprintCount == null || sprintCount <= 0 || sprintCount >= list.size()) {
            return list;
        }
        return list.subList(list.size() - sprintCount, list.size());
    }

    private void validateProject(Long projectId) {
        if (projectId == null || !projectRepository.existsById(projectId)) {
            throw new RuntimeException("Project not found: " + projectId);
        }
    }
}
