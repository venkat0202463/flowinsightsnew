package com.flowtrack.service;

import com.flowtrack.dto.VelocityAnalyticsResponseDto;
import com.flowtrack.dto.VelocityStabilityDto;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.Task;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VelocityAnalyticsServiceTest {

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @InjectMocks
    private VelocityAnalyticsService velocityAnalyticsService;

    private Project project;
    private List<Sprint> sampleSprints;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        project = new Project();
        project.setId(1L);
        project.setName("Agile Project Alpha");

        when(projectRepository.existsById(1L)).thenReturn(true);
    }

    private void setupExampleDataset() {
        // Velocities: 28, 31, 34, 29, 36 SP
        int[] completedPoints = {28, 31, 34, 29, 36};
        int[] committedPoints = {30, 32, 35, 30, 35};
        sampleSprints = new ArrayList<>();

        for (int i = 0; i < completedPoints.length; i++) {
            long sprintId = 101L + i;
            Sprint s = new Sprint();
            s.setId(sprintId);
            s.setName("Sprint " + (i + 1));
            s.setStatus("COMPLETED");
            s.setProject(project);
            s.setStartDate(LocalDate.of(2026, 1, 1).plusWeeks(i * 2));
            s.setEndDate(LocalDate.of(2026, 1, 1).plusWeeks(i * 2 + 2));
            s.setInitialCommitmentPoints(committedPoints[i]);
            sampleSprints.add(s);

            // Mock tasks for this sprint totaling completedPoints[i]
            Task t = new Task();
            t.setId(1000L + i);
            t.setStoryPoints(completedPoints[i]);
            t.setStatus("DONE");
            t.setSprint(s);
            when(taskRepository.findBySprintIdOrderByOrderIndexAsc(sprintId)).thenReturn(Collections.singletonList(t));
        }

        when(sprintRepository.findByProjectId(1L)).thenReturn(sampleSprints);
    }

    @Test
    @DisplayName("Validate Example Dataset: 28, 31, 34, 29, 36 SP")
    void testExampleDataset_VelocityAnalytics() {
        setupExampleDataset();

        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(1L, null);

        assertNotNull(response);
        assertEquals(5, response.getSprintsAnalyzedCount());
        assertEquals(158, response.getTotalCompletedPoints());
        assertEquals(31.6, response.getAverageVelocity());
        assertEquals(32L, response.getRoundedAverageVelocity());
        assertEquals(36, response.getLatestSprintVelocity());
        assertEquals(36, response.getHighestSprintVelocity());
        assertEquals(28, response.getLowestSprintVelocity());
        assertEquals(5, response.getSprints().size());
    }

    @Test
    @DisplayName("Validate Population Standard Deviation, CV, and Stability for Example Dataset")
    void testExampleDataset_VelocityStability() {
        setupExampleDataset();

        VelocityStabilityDto stability = velocityAnalyticsService.getVelocityStability(1L, null);

        assertNotNull(stability);
        assertEquals(5, stability.getSprintsAnalyzedCount());
        assertEquals(31.6, stability.getAverageVelocity());
        assertEquals(32L, stability.getRoundedAverageVelocity());

        // Recent velocity is average of last 3 sprints: (34 + 29 + 36) / 3 = 99 / 3 = 33.0 SP
        assertEquals(33.0, stability.getRecentVelocity());
        assertEquals(33L, stability.getRoundedRecentVelocity());

        // Population Variance = 45.2 / 5 = 9.04 -> sqrt(9.04) ≈ 3.0066 -> 3.01
        assertEquals(3.01, stability.getStandardDeviation());
        assertEquals(3L, stability.getRoundedStandardDeviation());

        // CV = (3.006659 / 31.6) * 100 ≈ 9.51% -> rounded to 9.5%
        assertEquals(9.5, stability.getCoefficientOfVariation());
        // 9.5% <= 10.0% -> STABLE
        assertEquals("STABLE", stability.getStabilityIndicator());
        assertEquals(36, stability.getHighestVelocity());
        assertEquals(28, stability.getLowestVelocity());
    }

    @Test
    @DisplayName("Validate Filter Sprint Count: Last 3 Sprints")
    void testSprintCountFilter_Last3Sprints() {
        setupExampleDataset();

        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(1L, 3);

        assertEquals(3, response.getSprintsAnalyzedCount());
        // Last 3 are 34, 29, 36 -> Total = 99 -> Avg = 33.0
        assertEquals(99, response.getTotalCompletedPoints());
        assertEquals(33.0, response.getAverageVelocity());
        assertEquals(36, response.getLatestSprintVelocity());
        assertEquals(36, response.getHighestSprintVelocity());
        assertEquals(29, response.getLowestSprintVelocity());
    }

    @Test
    @DisplayName("Validate Stability Indicator Thresholds: Moderately Variable (10-25%)")
    void testStabilityClassification_ModeratelyVariable() {
        // Velocities: 20, 26, 30 -> Mean = 25.33, Var = 17.55, StdDev ≈ 4.19, CV ≈ 16.5% -> Moderately Variable
        int[] points = {20, 26, 30};
        List<Sprint> sprints = new ArrayList<>();
        for (int i = 0; i < points.length; i++) {
            long sprintId = 200L + i;
            Sprint s = new Sprint();
            s.setId(sprintId);
            s.setName("Sprint " + i);
            s.setStatus("COMPLETED");
            s.setProject(project);
            sprints.add(s);

            Task t = new Task();
            t.setId(2000L + i);
            t.setStoryPoints(points[i]);
            t.setStatus("DONE");
            when(taskRepository.findBySprintIdOrderByOrderIndexAsc(sprintId)).thenReturn(Collections.singletonList(t));
        }
        when(sprintRepository.findByProjectId(1L)).thenReturn(sprints);

        VelocityStabilityDto stability = velocityAnalyticsService.getVelocityStability(1L, null);
        assertEquals("MODERATELY_VARIABLE", stability.getStabilityIndicator());
        assertTrue(stability.getCoefficientOfVariation() > 10.0 && stability.getCoefficientOfVariation() <= 25.0);
    }

    @Test
    @DisplayName("Validate Stability Indicator Thresholds: Highly Variable (> 25%)")
    void testStabilityClassification_HighlyVariable() {
        // Velocities: 10, 40, 15 -> Mean = 21.67, high variance -> CV > 25%
        int[] points = {10, 40, 15};
        List<Sprint> sprints = new ArrayList<>();
        for (int i = 0; i < points.length; i++) {
            long sprintId = 300L + i;
            Sprint s = new Sprint();
            s.setId(sprintId);
            s.setName("Sprint " + i);
            s.setStatus("COMPLETED");
            s.setProject(project);
            sprints.add(s);

            Task t = new Task();
            t.setId(3000L + i);
            t.setStoryPoints(points[i]);
            t.setStatus("DONE");
            when(taskRepository.findBySprintIdOrderByOrderIndexAsc(sprintId)).thenReturn(Collections.singletonList(t));
        }
        when(sprintRepository.findByProjectId(1L)).thenReturn(sprints);

        VelocityStabilityDto stability = velocityAnalyticsService.getVelocityStability(1L, null);
        assertEquals("HIGHLY_VARIABLE", stability.getStabilityIndicator());
        assertTrue(stability.getCoefficientOfVariation() > 25.0);
    }

    @Test
    @DisplayName("Validate Edge Case: Zero Completed Sprints")
    void testEdgeCase_ZeroCompletedSprints() {
        when(sprintRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());

        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(1L, null);
        assertEquals(0, response.getSprintsAnalyzedCount());
        assertEquals(0.0, response.getAverageVelocity());

        VelocityStabilityDto stability = velocityAnalyticsService.getVelocityStability(1L, null);
        assertEquals(0, stability.getSprintsAnalyzedCount());
        assertEquals(0.0, stability.getAverageVelocity());
        assertEquals("N_A", stability.getStabilityIndicator());
    }

    @Test
    @DisplayName("Validate Edge Case: Single Completed Sprint (Insufficient for Stability)")
    void testEdgeCase_SingleCompletedSprint() {
        Sprint s = new Sprint();
        s.setId(401L);
        s.setName("Sprint 1");
        s.setStatus("COMPLETED");
        s.setProject(project);
        when(sprintRepository.findByProjectId(1L)).thenReturn(Collections.singletonList(s));

        Task t = new Task();
        t.setId(4001L);
        t.setStoryPoints(30);
        t.setStatus("DONE");
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(401L)).thenReturn(Collections.singletonList(t));

        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(1L, null);
        assertEquals(1, response.getSprintsAnalyzedCount());
        assertEquals(30.0, response.getAverageVelocity());

        VelocityStabilityDto stability = velocityAnalyticsService.getVelocityStability(1L, null);
        assertEquals(1, stability.getSprintsAnalyzedCount());
        assertEquals(30.0, stability.getAverageVelocity());
        assertEquals(0.0, stability.getStandardDeviation());
        assertEquals("N_A", stability.getStabilityIndicator());
    }

    @Test
    @DisplayName("Validate Planned and Cancelled Sprints are Excluded while Non-Planned Sprints are Tracked")
    void testIncompleteSprints_AreExcluded() {
        Sprint planned = new Sprint();
        planned.setId(501L);
        planned.setStatus("PLANNED");

        Sprint cancelled = new Sprint();
        cancelled.setId(502L);
        cancelled.setStatus("CANCELLED");

        Sprint active = new Sprint();
        active.setId(503L);
        active.setStatus("ACTIVE");

        Sprint completed = new Sprint();
        completed.setId(504L);
        completed.setStatus("COMPLETED");

        when(sprintRepository.findByProjectId(1L)).thenReturn(Arrays.asList(planned, cancelled, active, completed));

        Task t1 = new Task();
        t1.setStoryPoints(10);
        t1.setStatus("DONE");
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(503L)).thenReturn(Collections.singletonList(t1));

        Task t2 = new Task();
        t2.setStoryPoints(25);
        t2.setStatus("DONE");
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(504L)).thenReturn(Collections.singletonList(t2));

        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(1L, null);
        assertEquals(2, response.getSprintsAnalyzedCount());
        assertEquals(503L, response.getSprints().get(0).getSprintId());
        assertEquals(504L, response.getSprints().get(1).getSprintId());
    }
}
