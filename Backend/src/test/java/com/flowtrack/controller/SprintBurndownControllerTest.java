package com.flowtrack.controller;

import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.dto.BurndownDailyPointDto;
import com.flowtrack.dto.BurndownResponseDto;
import com.flowtrack.dto.BurndownSummaryDto;
import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.service.BurndownAnalyticsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SprintBurndownControllerTest {

    private MockMvc mockMvc;

    @Mock
    private BurndownAnalyticsService burndownAnalyticsService;

    @InjectMocks
    private SprintBurndownController sprintBurndownController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        mockMvc = MockMvcBuilders.standaloneSetup(sprintBurndownController).build();
    }

    @Test
    void testGetBurndownEndpoint_Returns200AndJson() throws Exception {
        BurndownSummaryDto summary = new BurndownSummaryDto();
        summary.setSprintId(5L);
        summary.setSprintName("Sprint 5");
        summary.setInitialCommitment(100);
        summary.setCurrentScope(120);
        summary.setAddedPoints(20);
        summary.setRemovedPoints(0);
        summary.setCompletedPoints(40);
        summary.setRemainingPoints(80);
        summary.setScopeCreepIndex(20.0);
        summary.setCompletionPercentage(33.3);
        summary.setActiveAlertsCount(0);

        BurndownDailyPointDto pt = new BurndownDailyPointDto();
        pt.setDayIndex(0);
        pt.setDate(LocalDate.of(2026, 10, 1));
        pt.setActualRemaining(120.0);
        pt.setIdealRemaining(100.0);

        BurndownResponseDto response = new BurndownResponseDto(
                summary,
                Collections.singletonList(pt),
                Collections.emptyList(),
                Collections.emptyList()
        );

        when(burndownAnalyticsService.calculateBurndown(eq(5L))).thenReturn(response);

        mockMvc.perform(get("/api/sprints/5/burndown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.sprintId").value(5))
                .andExpect(jsonPath("$.summary.initialCommitment").value(100))
                .andExpect(jsonPath("$.summary.scopeCreepIndex").value(20.0))
                .andExpect(jsonPath("$.dailyPoints[0].dayIndex").value(0));
    }

    @Test
    void testGetBurndownSummaryEndpoint_Returns200AndSummaryJson() throws Exception {
        BurndownSummaryDto summary = new BurndownSummaryDto();
        summary.setSprintId(5L);
        summary.setInitialCommitment(100);
        summary.setScopeCreepIndex(15.0);

        when(burndownAnalyticsService.getBurndownSummary(eq(5L))).thenReturn(summary);

        mockMvc.perform(get("/api/sprints/5/burndown/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sprintId").value(5))
                .andExpect(jsonPath("$.scopeCreepIndex").value(15.0));
    }

    @Test
    void testGetScopeChangesEndpoint_Returns200AndList() throws Exception {
        SprintScopeChangeDto change = new SprintScopeChangeDto();
        change.setId(101L);
        change.setSprintId(5L);
        change.setChangeType("TASK_ADDED");
        change.setPointsDiff(5);
        change.setTaskKey("PROJ-12");

        when(burndownAnalyticsService.getScopeChanges(eq(5L)))
                .thenReturn(Collections.singletonList(change));

        mockMvc.perform(get("/api/sprints/5/burndown/scope-changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].taskKey").value("PROJ-12"))
                .andExpect(jsonPath("$[0].pointsDiff").value(5));
    }

    @Test
    void testGetAnomaliesEndpoint_Returns200AndAlertsList() throws Exception {
        BurndownAlertDto alert = new BurndownAlertDto();
        alert.setId("FLAT_PERIOD_5");
        alert.setTitle("No Meaningful Progress");
        alert.setSeverity("WARNING");
        alert.setAffectedDays(3);

        when(burndownAnalyticsService.getAnomalies(eq(5L)))
                .thenReturn(Collections.singletonList(alert));

        mockMvc.perform(get("/api/sprints/5/burndown/anomalies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("FLAT_PERIOD_5"))
                .andExpect(jsonPath("$[0].severity").value("WARNING"))
                .andExpect(jsonPath("$[0].affectedDays").value(3));
    }
}
