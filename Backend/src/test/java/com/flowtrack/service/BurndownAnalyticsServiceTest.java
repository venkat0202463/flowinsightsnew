package com.flowtrack.service;

import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.dto.BurndownResponseDto;
import com.flowtrack.dto.BurndownSummaryDto;
import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.SprintScopeChange;
import com.flowtrack.model.Task;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.repository.SprintScopeChangeRepository;
import com.flowtrack.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BurndownAnalyticsServiceTest {

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private SprintScopeChangeRepository scopeChangeRepository;

    @Mock
    private SprintScopeChangeService scopeChangeService;

    @Mock
    private BurndownAnomalyService anomalyService;

    @InjectMocks
    private BurndownAnalyticsService burndownAnalyticsService;

    private Sprint sprint;
    private Project project;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        project = new Project();
        project.setId(1L);
        project.setName("FlowTrack Engine");

        sprint = new Sprint();
        sprint.setId(10L);
        sprint.setName("Sprint 1");
        sprint.setStatus("ACTIVE");
        sprint.setProject(project);
        sprint.setStartDate(LocalDate.now().minusDays(5));
        sprint.setEndDate(LocalDate.now().plusDays(5));
        sprint.setInitialCommitmentPoints(100);
        sprint.setActivatedAt(LocalDateTime.now().minusDays(5));

        when(scopeChangeService.toDto(any())).thenAnswer(invocation -> {
            SprintScopeChange change = invocation.getArgument(0);
            SprintScopeChangeDto dto = new SprintScopeChangeDto();
            dto.setId(change.getId());
            dto.setSprintId(change.getSprintId());
            dto.setChangeType(change.getChangeType());
            dto.setFromPoints(change.getFromPoints());
            dto.setToPoints(change.getToPoints());
            dto.setPointsDiff(change.getPointsDiff());
            dto.setChangedAt(change.getChangedAt());
            dto.setTaskKey(change.getTaskKey());
            dto.setTaskTitle(change.getTaskTitle());
            dto.setChangedBy(change.getChangedBy());
            return dto;
        });

        when(anomalyService.detectAnomalies(any(), anyInt(), anyInt(), any(), any(), any()))
                .thenReturn(Collections.emptyList());
    }

    @Test
    void testCalculateBurndown_NormalSprint_Success() {
        Task task1 = new Task();
        task1.setId(101L);
        task1.setTitle("Authentication API");
        task1.setStoryPoints(30);
        task1.setStatus("DONE");
        task1.setCompletedAt(LocalDateTime.now().minusDays(2));

        Task task2 = new Task();
        task2.setId(102L);
        task2.setTitle("Dashboard Widget");
        task2.setStoryPoints(70);
        task2.setStatus("IN PROGRESS");

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Arrays.asList(task1, task2));
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Collections.emptyList());

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        assertNotNull(response);
        assertNotNull(response.getSummary());
        assertEquals(100, response.getSummary().getInitialCommitment());
        assertEquals(100, response.getSummary().getCurrentScope());
        assertEquals(30, response.getSummary().getCompletedPoints());
        assertEquals(70, response.getSummary().getRemainingPoints());
        assertEquals(0.0, response.getSummary().getScopeCreepIndex());
        assertEquals(30.0, response.getSummary().getCompletionPercentage());
        assertFalse(response.getDailyPoints().isEmpty());
    }

    @Test
    void testScopeCreepIndex_WithAddedAndRemovedScope() {
        // Initial commitment = 100, Added = 20, Removed = 10 -> SCI should be exactly 20.0%
        SprintScopeChange addChange = new SprintScopeChange();
        addChange.setSprintId(10L);
        addChange.setChangeType("TASK_ADDED");
        addChange.setPointsDiff(20);
        addChange.setToPoints(20);
        addChange.setChangedAt(LocalDateTime.now().minusDays(3));

        SprintScopeChange removeChange = new SprintScopeChange();
        removeChange.setSprintId(10L);
        removeChange.setChangeType("TASK_REMOVED");
        removeChange.setPointsDiff(-10);
        removeChange.setFromPoints(10);
        removeChange.setChangedAt(LocalDateTime.now().minusDays(2));

        Task t1 = new Task();
        t1.setId(201L);
        t1.setStoryPoints(110);
        t1.setStatus("TODO");

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Collections.singletonList(t1));
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Arrays.asList(addChange, removeChange));

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        BurndownSummaryDto summary = response.getSummary();
        assertEquals(100, summary.getInitialCommitment());
        assertEquals(20, summary.getAddedPoints());
        assertEquals(10, summary.getRemovedPoints());
        // SCI = (20 / 100) * 100 = 20.0
        assertEquals(20.0, summary.getScopeCreepIndex());
    }

    @Test
    void testZeroInitialCommitment_ReturnsNullSCIAndZeroFlag() {
        sprint.setInitialCommitmentPoints(0);

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Collections.emptyList());
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Collections.emptyList());

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        BurndownSummaryDto summary = response.getSummary();
        assertEquals(0, summary.getInitialCommitment());
        assertNull(summary.getScopeCreepIndex());
    }

    @Test
    void testEstimationChanges_TrackedSeparately() {
        // Story point increase
        SprintScopeChange spIncrease = new SprintScopeChange();
        spIncrease.setSprintId(10L);
        spIncrease.setChangeType("POINTS_INCREASED");
        spIncrease.setFromPoints(5);
        spIncrease.setToPoints(15);
        spIncrease.setPointsDiff(10);
        spIncrease.setChangedAt(LocalDateTime.now().minusDays(4));

        // Story point decrease
        SprintScopeChange spDecrease = new SprintScopeChange();
        spDecrease.setSprintId(10L);
        spDecrease.setChangeType("POINTS_DECREASED");
        spDecrease.setFromPoints(8);
        spDecrease.setToPoints(5);
        spDecrease.setPointsDiff(-3);
        spDecrease.setChangedAt(LocalDateTime.now().minusDays(3));

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Collections.emptyList());
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Arrays.asList(spIncrease, spDecrease));

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        BurndownSummaryDto summary = response.getSummary();
        assertEquals(10, summary.getAddedPoints());
        assertEquals(3, summary.getRemovedPoints());
        assertEquals(10.0, summary.getScopeCreepIndex());
    }

    @Test
    void testReconstructInitialCommitment_WhenSnapshotNull() {
        sprint.setInitialCommitmentPoints(null);

        Task t1 = new Task();
        t1.setId(301L);
        t1.setStoryPoints(50);
        t1.setStatus("TODO");

        // An added task change of 20 points after start
        SprintScopeChange addChange = new SprintScopeChange();
        addChange.setSprintId(10L);
        addChange.setChangeType("TASK_ADDED");
        addChange.setPointsDiff(20);
        addChange.setToPoints(20);
        addChange.setChangedAt(LocalDateTime.now().minusDays(1));

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Collections.singletonList(t1));
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Collections.singletonList(addChange));

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        // Current scope = 50. Added after start = 20. Reconstructed initial = 50 - 20 = 30.
        BurndownSummaryDto summary = response.getSummary();
        assertEquals(30, summary.getInitialCommitment());
        assertEquals(50, summary.getCurrentScope());
        assertEquals(20, summary.getAddedPoints());
    }

    @Test
    void testSprintDateBoundaries_InvalidOrNullDates_HandledGracefully() {
        sprint.setStartDate(null);
        sprint.setEndDate(null);

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findBySprintIdOrderByOrderIndexAsc(10L)).thenReturn(Collections.emptyList());
        when(scopeChangeRepository.findBySprintIdOrderByChangedAtAsc(10L)).thenReturn(Collections.emptyList());

        BurndownResponseDto response = burndownAnalyticsService.calculateBurndown(10L);

        assertNotNull(response);
        assertNotNull(response.getDailyPoints());
        // Default span is 14 days + 1 point
        assertEquals(15, response.getDailyPoints().size());
    }
}
