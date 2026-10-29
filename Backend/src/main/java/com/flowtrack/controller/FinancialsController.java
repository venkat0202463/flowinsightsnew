package com.flowtrack.controller;

import com.flowtrack.dto.*;
import com.flowtrack.security.UserDetailsImpl;
import com.flowtrack.service.BudgetCalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class FinancialsController {

    @Autowired
    private BudgetCalculationService budgetCalculationService;

    @Autowired(required = false)
    private com.flowtrack.repository.UserRepository userRepository;

    /**
     * Get financial summary for a project
     */
    @GetMapping("/financials")
    public ResponseEntity<ProjectFinancialSummaryDTO> getFinancialSummary(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        ProjectFinancialSummaryDTO summary = budgetCalculationService.getProjectFinancialSummary(projectId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Get project budget change history
     */
    @GetMapping("/budget/history")
    public ResponseEntity<List<ProjectBudgetHistoryDTO>> getBudgetHistory(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<ProjectBudgetHistoryDTO> history = budgetCalculationService.getProjectBudgetHistory(projectId);
        return ResponseEntity.ok(history);
    }

    /**
     * Get task-level financial analytics for a project
     */
    @GetMapping("/tasks/financials")
    public ResponseEntity<List<TaskFinancialDTO>> getTaskFinancials(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<TaskFinancialDTO> taskFinancials = budgetCalculationService.getTaskFinancials(projectId);
        return ResponseEntity.ok(taskFinancials);
    }

    /**
     * Update project budget settings and recalculate
     */
    @PutMapping("/budget")
    public ResponseEntity<?> updateProjectBudget(
            @PathVariable Long projectId,
            @RequestBody ProjectBudgetSettingsRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            String performedBy = userDetails != null ? (userDetails.getName() != null ? userDetails.getName() : userDetails.getUsername()) : "System";
            String empId = null;
            if (userDetails != null && userDetails.getId() != null && userRepository != null) {
                empId = userRepository.findById(userDetails.getId()).map(com.flowtrack.model.User::getEmpId).orElse(null);
            }
            ProjectFinancialSummaryDTO updated = budgetCalculationService.updateProjectBudgetSettings(projectId, request, performedBy, empId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Collections.singletonMap("message", e.getMessage()));
        }
    }

    /**
     * Trigger project budget recalculation
     */
    @PostMapping("/budget/calculate")
    public ResponseEntity<ProjectFinancialSummaryDTO> recalculateBudget(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "false") boolean resetManualOverrides,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        budgetCalculationService.recalculateProjectBudget(projectId, resetManualOverrides);
        ProjectFinancialSummaryDTO summary = budgetCalculationService.getProjectFinancialSummary(projectId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Update task-level budget override or actual cost
     */
    @PutMapping("/tasks/{taskId}/budget")
    public ResponseEntity<?> updateTaskBudget(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @RequestBody TaskBudgetUpdateRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            TaskFinancialDTO updated = budgetCalculationService.updateTaskBudget(projectId, taskId, request);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Collections.singletonMap("message", e.getMessage()));
        }
    }
}
