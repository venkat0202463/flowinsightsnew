package com.flowtrack.service;

import com.flowtrack.dto.ProjectBudgetCategoryDTO;
import com.flowtrack.dto.ProjectBudgetSettingsRequest;
import com.flowtrack.dto.ProjectFinancialSummaryDTO;
import com.flowtrack.dto.TaskBudgetUpdateRequest;
import com.flowtrack.dto.TaskFinancialDTO;
import com.flowtrack.model.Project;
import com.flowtrack.model.ProjectBudgetCategory;
import com.flowtrack.model.Task;
import com.flowtrack.repository.ProjectBudgetCategoryRepository;
import com.flowtrack.repository.ProjectBudgetHistoryRepository;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.WorkLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BudgetCalculationServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectBudgetCategoryRepository budgetCategoryRepository;

    @Mock
    private WorkLogRepository workLogRepository;

    @InjectMocks
    private BudgetCalculationService budgetCalculationService;

    private Project sampleProject;
    private Task task1;
    private Task task2;

    @BeforeEach
    public void setUp() {
        sampleProject = new Project();
        sampleProject.setId(1L);
        sampleProject.setName("FlowTrack Alpha");
        sampleProject.setTotalBudget(new BigDecimal("100000.00"));
        sampleProject.setContingencyPercent(new BigDecimal("10.00"));
        sampleProject.setDefaultHourlyRate(new BigDecimal("500.00"));
        sampleProject.setBudgetAllocationMethod("STORY_POINT_WEIGHTED");

        task1 = new Task();
        task1.setId(101L);
        task1.setTitle("Build Auth");
        task1.setProject(sampleProject);
        task1.setStoryPoints(8);
        task1.setTimeSpentSeconds(12 * 3600L); // 12 hours
        task1.setOriginalEstimateSeconds(16 * 3600L); // 16 hours
        task1.setBudgetAllocationSource("AUTOMATIC");
        task1.setCategory("Core Features");

        task2 = new Task();
        task2.setId(102L);
        task2.setTitle("Build API");
        task2.setProject(sampleProject);
        task2.setStoryPoints(82);
        task2.setTimeSpentSeconds(6 * 3600L); // 6 hours
        task2.setOriginalEstimateSeconds(20 * 3600L);
        task2.setBudgetAllocationSource("AUTOMATIC");
        task2.setCategory("Technical Infrastructure");
    }

    @Mock
    private ProjectBudgetHistoryRepository budgetHistoryRepository;

    @Mock
    private ActivityLogService activityLogService;

    @Test
    public void testStoryPointWeightedBudgetCalculation() {
        // Total budget = 100,000, contingency = 10% -> Available = 90,000
        // Total SP = 8 + 82 = 90
        // Cost per SP = 90,000 / 90 = 1,000
        // Task1 (8 SP) alloc = 8,000
        // Task2 (82 SP) alloc = 82,000
        // In Model A: Task1 is DONE -> actual cost = 8,000; Task2 is IN_PROGRESS -> actual cost = 0
        task1.setStatus("DONE");
        task2.setStatus("IN_PROGRESS");

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));

        budgetCalculationService.recalculateProjectBudget(1L, false);

        assertEquals(new BigDecimal("8000.00"), task1.getAllocatedBudget());
        assertEquals(new BigDecimal("82000.00"), task2.getAllocatedBudget());
        assertEquals(new BigDecimal("8000.00"), task1.getActualCost());
        assertEquals(new BigDecimal("0.00"), task2.getActualCost());

        verify(taskRepository).saveAll(any());
    }

    @Test
    public void testStoryPointsZeroEdgeCase() {
        task1.setStoryPoints(0);
        task2.setStoryPoints(0);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));

        budgetCalculationService.recalculateProjectBudget(1L, false);

        assertEquals(new BigDecimal("0.00"), task1.getAllocatedBudget());
        assertEquals(new BigDecimal("0.00"), task2.getAllocatedBudget());
    }

    @Test
    public void testCategoryBasedAllocation() {
        sampleProject.setBudgetAllocationMethod("CATEGORY_BASED");
        List<ProjectBudgetCategory> categories = Arrays.asList(
                new ProjectBudgetCategory(sampleProject, "Core Features", new BigDecimal("60.00")),
                new ProjectBudgetCategory(sampleProject, "Technical Infrastructure", new BigDecimal("40.00"))
        );

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));
        when(budgetCategoryRepository.findByProjectId(1L)).thenReturn(categories);

        budgetCalculationService.recalculateProjectBudget(1L, false);

        // Available Work Budget = 90,000
        // Core Features (60%) = 54,000 -> assigned to task1 (only task in Core Features)
        // Tech Infra (40%) = 36,000 -> assigned to task2 (only task in Tech Infra)
        assertEquals(new BigDecimal("54000.00"), task1.getAllocatedBudget());
        assertEquals(new BigDecimal("36000.00"), task2.getAllocatedBudget());
    }

    @Test
    public void testTimeBasedAllocation() {
        sampleProject.setBudgetAllocationMethod("TIME_BASED");

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));

        budgetCalculationService.recalculateProjectBudget(1L, false);

        // task1 estimate = 16h * 500 = 8000
        // task2 estimate = 20h * 500 = 10000
        assertEquals(new BigDecimal("8000.00"), task1.getAllocatedBudget());
        assertEquals(new BigDecimal("10000.00"), task2.getAllocatedBudget());
    }

    @Test
    public void testManualBudgetOverridePreserved() {
        task1.setBudgetAllocationSource("MANUAL");
        task1.setAllocatedBudget(new BigDecimal("15000.00"));

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));

        budgetCalculationService.recalculateProjectBudget(1L, false);

        // task1 manual budget must NOT be changed
        assertEquals(new BigDecimal("15000.00"), task1.getAllocatedBudget());
    }

    @Test
    public void testManualBudgetOverrideResetWhenRequested() {
        task1.setBudgetAllocationSource("MANUAL");
        task1.setAllocatedBudget(new BigDecimal("15000.00"));

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));

        budgetCalculationService.recalculateProjectBudget(1L, true);

        // Reset to automatic: 8 SP * 1,000 = 8,000
        assertEquals(new BigDecimal("8000.00"), task1.getAllocatedBudget());
        assertEquals("AUTOMATIC", task1.getBudgetAllocationSource());
    }

    @Test
    public void testProjectFinancialSummaryCalculations() {
        task1.setAllocatedBudget(new BigDecimal("8000.00"));
        task1.setActualCost(new BigDecimal("6000.00"));
        task2.setAllocatedBudget(new BigDecimal("82000.00"));
        task2.setActualCost(new BigDecimal("3000.00"));

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Arrays.asList(task1, task2));
        when(budgetCategoryRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());
        when(workLogRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());

        ProjectFinancialSummaryDTO summary = budgetCalculationService.getProjectFinancialSummary(1L);

        assertEquals(new BigDecimal("100000.00"), summary.getTotalBudget());
        assertEquals(new BigDecimal("10000.00"), summary.getContingencyAmount());
        assertEquals(new BigDecimal("90000.00"), summary.getAvailableWorkBudget());
        assertEquals(new BigDecimal("90000.00"), summary.getTotalAllocatedBudget());
        assertEquals(new BigDecimal("9000.00"), summary.getTotalActualCost());
        assertEquals(new BigDecimal("81000.00"), summary.getRemainingBudget()); // 90,000 - 9,000
        assertEquals(new BigDecimal("10.00"), summary.getBudgetUtilizationPercent()); // 9,000 / 90,000 * 100 = 10%
        assertEquals(new BigDecimal("81000.00"), summary.getCostVariance()); // 90,000 - 9,000
        assertEquals(90, summary.getTotalStoryPoints());
    }

    @Test
    public void testInvalidCategoryPercentagesValidation() {
        ProjectBudgetSettingsRequest request = new ProjectBudgetSettingsRequest();
        request.setCategories(Arrays.asList(
                new ProjectBudgetCategoryDTO(null, "Core", new BigDecimal("50.00"), null),
                new ProjectBudgetCategoryDTO(null, "Infra", new BigDecimal("30.00"), null) // Sum = 80 != 100
        ));

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));

        assertThrows(IllegalArgumentException.class, () -> {
            budgetCalculationService.updateProjectBudgetSettings(1L, request);
        });
    }

    @Test
    public void testZeroHourlyRateAndEmptyTasks() {
        sampleProject.setDefaultHourlyRate(BigDecimal.ZERO);
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Collections.emptyList());
        when(budgetCategoryRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());
        when(workLogRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());

        ProjectFinancialSummaryDTO summary = budgetCalculationService.getProjectFinancialSummary(1L);

        assertNotNull(summary);
        assertEquals(new BigDecimal("0.00"), summary.getTotalActualCost());
        assertEquals(new BigDecimal("0.00"), summary.getBudgetUtilizationPercent());
        assertEquals(0, summary.getTotalStoryPoints());
    }

    @Test
    public void testProjectBudgetHistoryRecordsOnUpdate() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(taskRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(Collections.emptyList());
        when(budgetCategoryRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());
        when(workLogRepository.findByProjectId(1L)).thenReturn(Collections.emptyList());

        ProjectBudgetSettingsRequest request = new ProjectBudgetSettingsRequest();
        request.setTotalBudget(new BigDecimal("150000.00"));
        request.setContingencyPercent(new BigDecimal("15.00"));
        request.setChangeReason("Scope expansion");

        budgetCalculationService.updateProjectBudgetSettings(1L, request, "Admin User", "EMP001");

        verify(budgetHistoryRepository, times(1)).save(any(com.flowtrack.model.ProjectBudgetHistory.class));
    }
}
