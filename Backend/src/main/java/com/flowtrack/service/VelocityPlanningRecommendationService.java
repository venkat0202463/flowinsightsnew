package com.flowtrack.service;

import com.flowtrack.dto.TeamCapacityDto;
import com.flowtrack.dto.VelocityPlanningRecommendationDto;
import com.flowtrack.dto.VelocitySprintDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class VelocityPlanningRecommendationService {

    @Autowired
    private VelocityAnalyticsService velocityAnalyticsService;

    @Autowired
    private SprintCapacityService sprintCapacityService;

    public static final String ADVISORY_NOTE =
            "Planning recommendations are based on historical completed story points and available team capacity. " +
            "Use this range as a planning reference during sprint planning; it does not automatically commit work to a sprint.";

    /**
     * Generates analytical planning recommendation for upcoming sprint planning.
     *
     * @param projectId    Target project ID
     * @param sprintWindow Number of recent completed sprints to use (3, 4, or 5; default 5)
     * @param sprintId     Optional sprint ID to evaluate capacity against
     * @return VelocityPlanningRecommendationDto
     */
    public VelocityPlanningRecommendationDto getPlanningRecommendation(Long projectId, Integer sprintWindow, Long sprintId) {
        int window = (sprintWindow != null && (sprintWindow == 3 || sprintWindow == 4 || sprintWindow == 5))
                ? sprintWindow : 5;

        List<VelocitySprintDto> allHistorical = velocityAnalyticsService.getHistoricalCompletedSprints(projectId);

        VelocityPlanningRecommendationDto dto = new VelocityPlanningRecommendationDto();
        dto.setProjectId(projectId);
        dto.setAdvisoryNote(ADVISORY_NOTE);
        dto.setCapacityUnit("STORY_POINTS");

        // Take last 'window' completed sprints
        List<VelocitySprintDto> included;
        if (allHistorical.size() <= window) {
            included = allHistorical;
        } else {
            included = allHistorical.subList(allHistorical.size() - window, allHistorical.size());
        }
        dto.setIncludedSprints(included);
        dto.setHistoricalSprintsUsed(included.size());

        // Check if fewer than 3 completed sprints exist
        if (included.size() < 3) {
            dto.setInsufficientDataWarning(true);
        } else {
            dto.setInsufficientDataWarning(false);
        }

        // Observed Velocity Range: [Min, Max]
        if (!included.isEmpty()) {
            int minCompleted = included.stream().mapToInt(VelocitySprintDto::getCompletedPoints).min().orElse(0);
            int maxCompleted = included.stream().mapToInt(VelocitySprintDto::getCompletedPoints).max().orElse(0);
            dto.setObservedRangeMin(minCompleted);
            dto.setObservedRangeMax(maxCompleted);

            // Historical Moving Average over selected window
            int totalPoints = included.stream().mapToInt(VelocitySprintDto::getCompletedPoints).sum();
            double histAvg = (double) totalPoints / included.size();
            histAvg = Math.round(histAvg * 100.0) / 100.0;
            dto.setHistoricalAverage(histAvg);
            dto.setRoundedHistoricalAverage(Math.round(histAvg));
        } else {
            dto.setObservedRangeMin(0);
            dto.setObservedRangeMax(0);
            dto.setHistoricalAverage(0.0);
            dto.setRoundedHistoricalAverage(0L);
        }

        // Fetch team capacity
        TeamCapacityDto capacity = sprintCapacityService.getTeamCapacity(projectId, sprintId);
        if (capacity != null) {
            dto.setCurrentTeamCapacity(capacity.getCapacityStoryPoints());
            dto.setCurrentTeamCapacityHours(capacity.getTotalAvailableHours());
            dto.setCurrentTeamCapacityDays(capacity.getTotalAvailablePersonDays());
            dto.setCapacityConfigured(capacity.getTotalAvailableHours() > 0);
            dto.setCapacityManual(capacity.isManuallyConfigured());
            dto.setCapacityConfigRequired(capacity.getTeamMemberCount() == 0 || capacity.getTotalAvailableHours() <= 0);
        } else {
            dto.setCapacityConfigured(false);
            dto.setCapacityConfigRequired(true);
            dto.setCurrentTeamCapacity(0.0);
            dto.setCurrentTeamCapacityHours(0.0);
            dto.setCurrentTeamCapacityDays(0.0);
        }

        // Suggested Planning Baseline = MIN(Historical Average Velocity, Current Capacity in Story Points)
        if (dto.getHistoricalAverage() != null && dto.getCurrentTeamCapacity() != null && dto.getCurrentTeamCapacity() > 0) {
            double baseline = Math.min(dto.getHistoricalAverage(), dto.getCurrentTeamCapacity());
            baseline = Math.round(baseline * 100.0) / 100.0;
            dto.setSuggestedPlanningBaseline(baseline);
            dto.setRoundedSuggestedPlanningBaseline(Math.round(baseline));
        } else if (dto.getHistoricalAverage() != null && dto.getHistoricalAverage() > 0) {
            // Capacity not configured or 0, fallback baseline to historical average
            dto.setSuggestedPlanningBaseline(dto.getHistoricalAverage());
            dto.setRoundedSuggestedPlanningBaseline(dto.getRoundedHistoricalAverage());
        } else if (dto.getCurrentTeamCapacity() != null && dto.getCurrentTeamCapacity() > 0) {
            // No historical velocity, use current capacity
            dto.setSuggestedPlanningBaseline(dto.getCurrentTeamCapacity());
            dto.setRoundedSuggestedPlanningBaseline(Math.round(dto.getCurrentTeamCapacity()));
        } else {
            dto.setSuggestedPlanningBaseline(0.0);
            dto.setRoundedSuggestedPlanningBaseline(0L);
        }

        return dto;
    }
}
