package com.flowtrack.controller;

import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.dto.BurndownResponseDto;
import com.flowtrack.dto.BurndownSummaryDto;
import com.flowtrack.dto.SprintScopeChangeDto;
import com.flowtrack.service.BurndownAnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
public class SprintBurndownController {

    @Autowired
    private BurndownAnalyticsService burndownAnalyticsService;

    @GetMapping({"/api/sprints/{sprintId}/burndown", "/api/projects/{projectId}/sprints/{sprintId}/burndown"})
    public ResponseEntity<BurndownResponseDto> getBurndown(@PathVariable Long sprintId) {
        return ResponseEntity.ok(burndownAnalyticsService.calculateBurndown(sprintId));
    }

    @GetMapping({"/api/sprints/{sprintId}/burndown/summary", "/api/projects/{projectId}/sprints/{sprintId}/burndown/summary"})
    public ResponseEntity<BurndownSummaryDto> getBurndownSummary(@PathVariable Long sprintId) {
        return ResponseEntity.ok(burndownAnalyticsService.getBurndownSummary(sprintId));
    }

    @GetMapping({"/api/sprints/{sprintId}/burndown/scope-changes", "/api/projects/{projectId}/sprints/{sprintId}/burndown/scope-changes"})
    public ResponseEntity<List<SprintScopeChangeDto>> getScopeChanges(@PathVariable Long sprintId) {
        return ResponseEntity.ok(burndownAnalyticsService.getScopeChanges(sprintId));
    }

    @GetMapping({"/api/sprints/{sprintId}/burndown/anomalies", "/api/projects/{projectId}/sprints/{sprintId}/burndown/anomalies"})
    public ResponseEntity<List<BurndownAlertDto>> getAnomalies(@PathVariable Long sprintId) {
        return ResponseEntity.ok(burndownAnalyticsService.getAnomalies(sprintId));
    }
}
