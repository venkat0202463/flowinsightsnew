package com.flowtrack.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowtrack.dto.*;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.service.SprintCapacityService;
import com.flowtrack.service.VelocityAnalyticsService;
import com.flowtrack.service.VelocityPlanningRecommendationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class VelocityControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private VelocityAnalyticsService velocityAnalyticsService;

    @Mock
    private VelocityPlanningRecommendationService recommendationService;

    @Mock
    private SprintCapacityService sprintCapacityService;

    @Mock
    private SprintRepository sprintRepository;

    @InjectMocks
    private VelocityController velocityController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        mockMvc = MockMvcBuilders.standaloneSetup(velocityController).build();
    }

    @Test
    @DisplayName("GET /api/velocity/analytics returns 200 and structured response")
    void testGetVelocityAnalytics_Returns200() throws Exception {
        VelocityAnalyticsResponseDto dto = new VelocityAnalyticsResponseDto();
        dto.setProjectId(1L);
        dto.setSprintsAnalyzedCount(5);
        dto.setAverageVelocity(31.6);
        dto.setRoundedAverageVelocity(32L);
        dto.setLatestSprintVelocity(36);
        dto.setHighestSprintVelocity(36);
        dto.setLowestSprintVelocity(28);
        dto.setTotalCompletedPoints(158);
        dto.setSprints(Collections.emptyList());

        when(velocityAnalyticsService.getVelocityAnalytics(eq(1L), any())).thenReturn(dto);

        mockMvc.perform(get("/api/velocity/analytics")
                        .param("projectId", "1")
                        .param("sprintCount", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(1))
                .andExpect(jsonPath("$.averageVelocity").value(31.6))
                .andExpect(jsonPath("$.roundedAverageVelocity").value(32))
                .andExpect(jsonPath("$.latestSprintVelocity").value(36))
                .andExpect(jsonPath("$.highestSprintVelocity").value(36))
                .andExpect(jsonPath("$.lowestSprintVelocity").value(28))
                .andExpect(jsonPath("$.totalCompletedPoints").value(158));
    }

    @Test
    @DisplayName("GET /api/velocity/analytics returns 400 when projectId missing")
    void testGetVelocityAnalytics_MissingProjectId() throws Exception {
        mockMvc.perform(get("/api/velocity/analytics"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/velocity/stability returns 200 and stability metrics")
    void testGetVelocityStability_Returns200() throws Exception {
        VelocityStabilityDto stability = new VelocityStabilityDto();
        stability.setProjectId(1L);
        stability.setSprintsAnalyzedCount(5);
        stability.setAverageVelocity(31.6);
        stability.setRecentVelocity(33.0);
        stability.setStandardDeviation(3.01);
        stability.setCoefficientOfVariation(9.5);
        stability.setStabilityIndicator("STABLE");

        when(velocityAnalyticsService.getVelocityStability(eq(1L), any())).thenReturn(stability);

        mockMvc.perform(get("/api/velocity/stability")
                        .param("projectId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stabilityIndicator").value("STABLE"))
                .andExpect(jsonPath("$.standardDeviation").value(3.01))
                .andExpect(jsonPath("$.coefficientOfVariation").value(9.5));
    }

    @Test
    @DisplayName("GET /api/velocity/planning-recommendation returns 200 and baseline advice")
    void testGetPlanningRecommendation_Returns200() throws Exception {
        VelocityPlanningRecommendationDto rec = new VelocityPlanningRecommendationDto();
        rec.setProjectId(1L);
        rec.setHistoricalSprintsUsed(5);
        rec.setObservedRangeMin(28);
        rec.setObservedRangeMax(36);
        rec.setHistoricalAverage(31.6);
        rec.setCurrentTeamCapacity(30.0);
        rec.setSuggestedPlanningBaseline(30.0);
        rec.setAdvisoryNote(VelocityPlanningRecommendationService.ADVISORY_NOTE);

        when(recommendationService.getPlanningRecommendation(eq(1L), any(), any())).thenReturn(rec);

        mockMvc.perform(get("/api/velocity/planning-recommendation")
                        .param("projectId", "1")
                        .param("sprintWindow", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.observedRangeMin").value(28))
                .andExpect(jsonPath("$.observedRangeMax").value(36))
                .andExpect(jsonPath("$.suggestedPlanningBaseline").value(30.0))
                .andExpect(jsonPath("$.advisoryNote").isNotEmpty());
    }

    @Test
    @DisplayName("GET /api/sprints/{sprintId}/capacity returns 200")
    void testGetSprintCapacity_Returns200() throws Exception {
        Sprint s = new Sprint();
        s.setId(10L);
        Project p = new Project();
        p.setId(1L);
        s.setProject(p);

        when(sprintRepository.findById(10L)).thenReturn(Optional.of(s));

        TeamCapacityDto cap = new TeamCapacityDto();
        cap.setProjectId(1L);
        cap.setSprintId(10L);
        cap.setCapacityStoryPoints(32.0);
        cap.setTotalAvailableHours(240.0);

        when(sprintCapacityService.getTeamCapacity(1L, 10L)).thenReturn(cap);

        mockMvc.perform(get("/api/sprints/10/capacity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.capacityStoryPoints").value(32.0))
                .andExpect(jsonPath("$.totalAvailableHours").value(240.0));
    }

    @Test
    @DisplayName("POST /api/velocity/capacity updates capacity")
    void testSaveCapacity_Returns200() throws Exception {
        SprintCapacityRequestDto req = new SprintCapacityRequestDto();
        req.setProjectId(1L);
        req.setWorkingDays(10);
        req.setDailyHours(8.0);
        req.setStoryPointsCapacity(35.0);

        TeamCapacityDto res = new TeamCapacityDto();
        res.setProjectId(1L);
        res.setCapacityStoryPoints(35.0);

        when(sprintCapacityService.saveCapacity(any(SprintCapacityRequestDto.class))).thenReturn(res);

        mockMvc.perform(post("/api/velocity/capacity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.capacityStoryPoints").value(35.0));
    }
}
