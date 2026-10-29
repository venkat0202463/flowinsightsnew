package com.flowtrack.controller;

import com.flowtrack.dto.*;
import com.flowtrack.model.Sprint;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.service.SprintCapacityService;
import com.flowtrack.service.VelocityAnalyticsService;
import com.flowtrack.service.VelocityPlanningRecommendationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
public class VelocityController {

    @Autowired
    private VelocityAnalyticsService velocityAnalyticsService;

    @Autowired
    private VelocityPlanningRecommendationService recommendationService;

    @Autowired
    private SprintCapacityService sprintCapacityService;

    @Autowired
    private SprintRepository sprintRepository;

    /**
     * Historical sprint velocity analytics with committed/completed story points, trend, and team velocity.
     * GET /api/velocity/analytics?projectId={projectId}&sprintCount={sprintCount}
     */
    @GetMapping("/api/velocity/analytics")
    public ResponseEntity<?> getVelocityAnalytics(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Integer sprintCount) {
        if (projectId == null || projectId <= 0) {
            return ResponseEntity.badRequest().body("Valid projectId parameter is required.");
        }
        VelocityAnalyticsResponseDto response = velocityAnalyticsService.getVelocityAnalytics(projectId, sprintCount);
        return ResponseEntity.ok(response);
    }

    /**
     * Velocity stability analysis: standard deviation, coefficient of variation, and stability indicator.
     * GET /api/velocity/stability?projectId={projectId}&sprintCount={sprintCount}
     */
    @GetMapping("/api/velocity/stability")
    public ResponseEntity<?> getVelocityStability(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Integer sprintCount) {
        if (projectId == null || projectId <= 0) {
            return ResponseEntity.badRequest().body("Valid projectId parameter is required.");
        }
        VelocityStabilityDto response = velocityAnalyticsService.getVelocityStability(projectId, sprintCount);
        return ResponseEntity.ok(response);
    }

    /**
     * Capacity-based sprint planning recommendations.
     * GET /api/velocity/planning-recommendation?projectId={projectId}&sprintWindow={sprintWindow}&sprintId={sprintId}
     */
    @GetMapping("/api/velocity/planning-recommendation")
    public ResponseEntity<?> getPlanningRecommendation(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false, defaultValue = "5") Integer sprintWindow,
            @RequestParam(required = false) Long sprintId) {
        if (projectId == null || projectId <= 0) {
            return ResponseEntity.badRequest().body("Valid projectId parameter is required.");
        }
        VelocityPlanningRecommendationDto response = recommendationService.getPlanningRecommendation(projectId, sprintWindow, sprintId);
        return ResponseEntity.ok(response);
    }

    /**
     * Team capacity details for a project / sprint.
     * GET /api/velocity/capacity?projectId={projectId}&sprintId={sprintId}
     */
    @GetMapping("/api/velocity/capacity")
    public ResponseEntity<?> getCapacity(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long sprintId) {
        if (projectId == null || projectId <= 0) {
            return ResponseEntity.badRequest().body("Valid projectId parameter is required.");
        }
        TeamCapacityDto response = sprintCapacityService.getTeamCapacity(projectId, sprintId);
        return ResponseEntity.ok(response);
    }

    /**
     * Alias endpoint for sprint-specific capacity.
     * GET /api/sprints/{sprintId}/capacity
     */
    @GetMapping("/api/sprints/{sprintId}/capacity")
    public ResponseEntity<?> getSprintCapacity(@PathVariable Long sprintId) {
        if (sprintId == null || sprintId <= 0) {
            return ResponseEntity.badRequest().body("Valid sprintId path variable is required.");
        }
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint == null || sprint.getProject() == null) {
            return ResponseEntity.notFound().build();
        }
        TeamCapacityDto response = sprintCapacityService.getTeamCapacity(sprint.getProject().getId(), sprintId);
        return ResponseEntity.ok(response);
    }

    /**
     * Configure or update team/sprint capacity.
     * POST /api/velocity/capacity
     */
    @PostMapping("/api/velocity/capacity")
    public ResponseEntity<?> saveCapacity(@RequestBody SprintCapacityRequestDto request) {
        if (request.getProjectId() == null || request.getProjectId() <= 0) {
            return ResponseEntity.badRequest().body("Valid projectId is required in capacity request.");
        }
        TeamCapacityDto response = sprintCapacityService.saveCapacity(request);
        return ResponseEntity.ok(response);
    }
}
