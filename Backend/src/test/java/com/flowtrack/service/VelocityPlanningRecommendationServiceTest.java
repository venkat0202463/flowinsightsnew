package com.flowtrack.service;

import com.flowtrack.dto.TeamCapacityDto;
import com.flowtrack.dto.VelocityPlanningRecommendationDto;
import com.flowtrack.dto.VelocitySprintDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VelocityPlanningRecommendationServiceTest {

    @Mock
    private VelocityAnalyticsService velocityAnalyticsService;

    @Mock
    private SprintCapacityService sprintCapacityService;

    @InjectMocks
    private VelocityPlanningRecommendationService recommendationService;

    private List<VelocitySprintDto> exampleSprintDtos;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        // Example Dataset: 28, 31, 34, 29, 36 SP
        int[] completedPoints = {28, 31, 34, 29, 36};
        exampleSprintDtos = new ArrayList<>();
        for (int i = 0; i < completedPoints.length; i++) {
            VelocitySprintDto dto = new VelocitySprintDto();
            dto.setSprintId(10L + i);
            dto.setSprintName("Sprint " + (i + 1));
            dto.setCompletedPoints(completedPoints[i]);
            dto.setCommittedPoints(30);
            dto.setDifference(completedPoints[i] - 30);
            dto.setCompleted(true);
            dto.setStartDate(LocalDate.of(2026, 1, 1).plusWeeks(i * 2));
            dto.setEndDate(LocalDate.of(2026, 1, 1).plusWeeks(i * 2 + 2));
            exampleSprintDtos.add(dto);
        }
    }

    @Test
    @DisplayName("Validate Capacity-Based Planning with Example Dataset & 30 SP Capacity")
    void testPlanningRecommendation_ExampleDataset() {
        when(velocityAnalyticsService.getHistoricalCompletedSprints(1L)).thenReturn(exampleSprintDtos);

        TeamCapacityDto capacity = new TeamCapacityDto();
        capacity.setProjectId(1L);
        capacity.setTeamMemberCount(3);
        capacity.setWorkingDays(10);
        capacity.setTotalAvailableHours(240.0);
        capacity.setCapacityStoryPoints(30.0);
        capacity.setManuallyConfigured(false);
        when(sprintCapacityService.getTeamCapacity(1L, null)).thenReturn(capacity);

        VelocityPlanningRecommendationDto rec = recommendationService.getPlanningRecommendation(1L, 5, null);

        assertNotNull(rec);
        assertEquals(5, rec.getHistoricalSprintsUsed());
        assertFalse(rec.isInsufficientDataWarning());

        // Observed Range: [28, 36]
        assertEquals(28, rec.getObservedRangeMin());
        assertEquals(36, rec.getObservedRangeMax());

        // Historical Average: 158 / 5 = 31.6 SP
        assertEquals(31.6, rec.getHistoricalAverage());
        assertEquals(32L, rec.getRoundedHistoricalAverage());

        // Current Team Capacity: 30 SP
        assertEquals(30.0, rec.getCurrentTeamCapacity());

        // Suggested Planning Baseline = MIN(31.6, 30.0) = 30.0 SP
        assertEquals(30.0, rec.getSuggestedPlanningBaseline());
        assertEquals(30L, rec.getRoundedSuggestedPlanningBaseline());

        // Advisory Note
        assertTrue(rec.getAdvisoryNote().contains("Use this range as a planning reference"));
    }

    @Test
    @DisplayName("Validate Moving Average: Last 3 Sprints Window")
    void testMovingAverage_Last3Sprints() {
        when(velocityAnalyticsService.getHistoricalCompletedSprints(1L)).thenReturn(exampleSprintDtos);

        TeamCapacityDto capacity = new TeamCapacityDto();
        capacity.setCapacityStoryPoints(40.0);
        capacity.setTotalAvailableHours(320.0);
        when(sprintCapacityService.getTeamCapacity(1L, null)).thenReturn(capacity);

        VelocityPlanningRecommendationDto rec = recommendationService.getPlanningRecommendation(1L, 3, null);

        assertEquals(3, rec.getHistoricalSprintsUsed());
        // Last 3 sprints: 34, 29, 36 -> sum = 99 -> avg = 33.0 SP
        assertEquals(33.0, rec.getHistoricalAverage());
        assertEquals(33L, rec.getRoundedHistoricalAverage());
        assertEquals(29, rec.getObservedRangeMin());
        assertEquals(36, rec.getObservedRangeMax());

        // Suggested Baseline = MIN(33.0, 40.0) = 33.0 SP
        assertEquals(33.0, rec.getSuggestedPlanningBaseline());
        assertEquals(33L, rec.getRoundedSuggestedPlanningBaseline());
    }

    @Test
    @DisplayName("Validate Insufficient Data Warning when Fewer than 3 Sprints")
    void testInsufficientDataWarning_LessThan3Sprints() {
        List<VelocitySprintDto> twoSprints = exampleSprintDtos.subList(0, 2);
        when(velocityAnalyticsService.getHistoricalCompletedSprints(1L)).thenReturn(twoSprints);

        TeamCapacityDto capacity = new TeamCapacityDto();
        capacity.setCapacityStoryPoints(25.0);
        capacity.setTotalAvailableHours(200.0);
        when(sprintCapacityService.getTeamCapacity(1L, null)).thenReturn(capacity);

        VelocityPlanningRecommendationDto rec = recommendationService.getPlanningRecommendation(1L, 5, null);

        assertEquals(2, rec.getHistoricalSprintsUsed());
        assertTrue(rec.isInsufficientDataWarning(), "Should flag warning when fewer than 3 completed sprints exist");
    }

    @Test
    @DisplayName("Validate Missing Capacity Information Handling")
    void testMissingCapacityInformation() {
        when(velocityAnalyticsService.getHistoricalCompletedSprints(1L)).thenReturn(exampleSprintDtos);

        TeamCapacityDto emptyCapacity = new TeamCapacityDto();
        emptyCapacity.setTeamMemberCount(0);
        emptyCapacity.setTotalAvailableHours(0.0);
        emptyCapacity.setCapacityStoryPoints(null);
        when(sprintCapacityService.getTeamCapacity(1L, null)).thenReturn(emptyCapacity);

        VelocityPlanningRecommendationDto rec = recommendationService.getPlanningRecommendation(1L, 5, null);

        assertTrue(rec.isCapacityConfigRequired());
        // Baseline should fallback to historical average (31.6) without crashing
        assertEquals(31.6, rec.getHistoricalAverage());
        assertEquals(31.6, rec.getSuggestedPlanningBaseline());
    }
}
