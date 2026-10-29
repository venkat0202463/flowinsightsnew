package com.flowtrack.service;

import com.flowtrack.dto.*;
import com.flowtrack.model.Project;
import com.flowtrack.model.ProjectBudgetCategory;
import com.flowtrack.model.ProjectBudgetHistory;
import com.flowtrack.model.Task;
import com.flowtrack.model.WorkLog;
import com.flowtrack.repository.ProjectBudgetCategoryRepository;
import com.flowtrack.repository.ProjectBudgetHistoryRepository;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.WorkLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class BudgetCalculationService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectBudgetCategoryRepository budgetCategoryRepository;

    @Autowired
    private WorkLogRepository workLogRepository;

    @Autowired(required = false)
    private ProjectBudgetHistoryRepository budgetHistoryRepository;

    @Autowired(required = false)
    private ActivityLogService activityLogService;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal SECONDS_PER_HOUR = BigDecimal.valueOf(3600);

    /**
     * Recalculates all budget and actual costs for a project.
     * @param projectId Project ID
     * @param resetManualOverrides if true, resets manual task budgets back to automatic calculation
     */
    public void recalculateProjectBudget(Long projectId, boolean resetManualOverrides) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found with id: " + projectId));

        BigDecimal totalBudget = project.getTotalBudget() != null ? project.getTotalBudget() : BigDecimal.ZERO;
        BigDecimal contingencyPercent = project.getContingencyPercent() != null ? project.getContingencyPercent() : BigDecimal.ZERO;
        BigDecimal defaultHourlyRate = project.getDefaultHourlyRate() != null ? project.getDefaultHourlyRate() : BigDecimal.ZERO;
        String allocationMethod = project.getBudgetAllocationMethod() != null ? project.getBudgetAllocationMethod() : "STORY_POINT_WEIGHTED";

        // Contingency Amount = Total Budget * (Contingency % / 100)
        BigDecimal contingencyAmount = totalBudget.multiply(contingencyPercent)
                .divide(HUNDRED, 2, RoundingMode.HALF_UP);

        // Available Work Budget = Total Budget - Contingency Amount
        BigDecimal availableWorkBudget = totalBudget.subtract(contingencyAmount);
        if (availableWorkBudget.compareTo(BigDecimal.ZERO) < 0) {
            availableWorkBudget = BigDecimal.ZERO;
        }

        List<Task> tasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(projectId);

        // Recalculate Allocated Budget & Actual Cost according to method
        if ("STORY_POINT_WEIGHTED".equalsIgnoreCase(allocationMethod)) {
            calculateStoryPointWeightedAllocation(project, tasks, availableWorkBudget, resetManualOverrides);
            // In Model A, Actual Cost = Story Points * Cost Per SP when status is DONE, otherwise 0
            for (Task task : tasks) {
                boolean isDone = task.getStatus() != null && (task.getStatus().equalsIgnoreCase("DONE") || task.getStatus().toLowerCase().contains("done"));
                if (isDone) {
                    task.setActualCost(task.getAllocatedBudget() != null ? task.getAllocatedBudget() : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                } else {
                    task.setActualCost(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                }
                if (resetManualOverrides) {
                    task.setBudgetAllocationSource("AUTOMATIC");
                }
            }
        } else if ("CATEGORY_BASED".equalsIgnoreCase(allocationMethod)) {
            for (Task task : tasks) {
                long timeSpentSec = task.getTimeSpentSeconds() != null ? task.getTimeSpentSeconds() : 0L;
                if (timeSpentSec > 0 && defaultHourlyRate.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal hours = BigDecimal.valueOf(timeSpentSec).divide(SECONDS_PER_HOUR, 4, RoundingMode.HALF_UP);
                    task.setActualCost(hours.multiply(defaultHourlyRate).setScale(2, RoundingMode.HALF_UP));
                } else {
                    task.setActualCost(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                }
                if (resetManualOverrides) {
                    task.setBudgetAllocationSource("AUTOMATIC");
                }
            }
            calculateCategoryBasedAllocation(project, tasks, availableWorkBudget, resetManualOverrides);
        } else if ("TIME_BASED".equalsIgnoreCase(allocationMethod)) {
            for (Task task : tasks) {
                long timeSpentSec = task.getTimeSpentSeconds() != null ? task.getTimeSpentSeconds() : 0L;
                if (timeSpentSec > 0 && defaultHourlyRate.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal hours = BigDecimal.valueOf(timeSpentSec).divide(SECONDS_PER_HOUR, 4, RoundingMode.HALF_UP);
                    task.setActualCost(hours.multiply(defaultHourlyRate).setScale(2, RoundingMode.HALF_UP));
                } else {
                    task.setActualCost(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                }
                if (resetManualOverrides) {
                    task.setBudgetAllocationSource("AUTOMATIC");
                }
            }
            calculateTimeBasedAllocation(tasks, defaultHourlyRate, resetManualOverrides);
        } else {
            calculateStoryPointWeightedAllocation(project, tasks, availableWorkBudget, resetManualOverrides);
            for (Task task : tasks) {
                boolean isDone = task.getStatus() != null && (task.getStatus().equalsIgnoreCase("DONE") || task.getStatus().toLowerCase().contains("done"));
                if (isDone) {
                    task.setActualCost(task.getAllocatedBudget() != null ? task.getAllocatedBudget() : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                } else {
                    task.setActualCost(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                }
                if (resetManualOverrides) {
                    task.setBudgetAllocationSource("AUTOMATIC");
                }
            }
        }

        taskRepository.saveAll(tasks);
    }

    private void calculateStoryPointWeightedAllocation(Project project, List<Task> tasks, BigDecimal availableWorkBudget, boolean resetManualOverrides) {
        int totalStoryPoints = 0;
        for (Task task : tasks) {
            int sp = task.getStoryPoints() != null ? Math.max(0, task.getStoryPoints()) : 0;
            totalStoryPoints += sp;
        }

        BigDecimal costPerStoryPoint = BigDecimal.ZERO;
        if (project.getCostPerStoryPoint() != null && project.getCostPerStoryPoint().compareTo(BigDecimal.ZERO) > 0) {
            costPerStoryPoint = project.getCostPerStoryPoint();
        } else if (totalStoryPoints > 0 && availableWorkBudget.compareTo(BigDecimal.ZERO) > 0) {
            costPerStoryPoint = availableWorkBudget.divide(BigDecimal.valueOf(totalStoryPoints), 6, RoundingMode.HALF_UP);
        }

        for (Task task : tasks) {
            if (resetManualOverrides || !"MANUAL".equalsIgnoreCase(task.getBudgetAllocationSource())) {
                int sp = task.getStoryPoints() != null ? Math.max(0, task.getStoryPoints()) : 0;
                BigDecimal allocated = costPerStoryPoint.multiply(BigDecimal.valueOf(sp)).setScale(2, RoundingMode.HALF_UP);
                task.setAllocatedBudget(allocated);
            }
        }
    }

    private void calculateCategoryBasedAllocation(Project project, List<Task> tasks, BigDecimal availableWorkBudget, boolean resetManualOverrides) {
        List<ProjectBudgetCategory> categories = budgetCategoryRepository.findByProjectId(project.getId());
        if (categories == null || categories.isEmpty()) {
            categories = initializeDefaultCategories(project);
        }

        // Map categories by name (lowercase for safe matching)
        Map<String, ProjectBudgetCategory> categoryMap = new HashMap<>();
        for (ProjectBudgetCategory cat : categories) {
            BigDecimal catPercent = cat.getAllocationPercent() != null ? cat.getAllocationPercent() : BigDecimal.ZERO;
            BigDecimal catAmount = availableWorkBudget.multiply(catPercent).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            cat.setAllocatedAmount(catAmount);
            categoryMap.put(cat.getCategory().toLowerCase().trim(), cat);
        }
        budgetCategoryRepository.saveAll(categories);

        // Group automatic tasks by category
        Map<String, List<Task>> tasksByCategory = new HashMap<>();
        for (Task task : tasks) {
            String catName = task.getCategory() != null && !task.getCategory().trim().isEmpty() 
                    ? task.getCategory().trim() 
                    : "Core Features";
            tasksByCategory.computeIfAbsent(catName.toLowerCase(), k -> new ArrayList<>()).add(task);
        }

        for (ProjectBudgetCategory cat : categories) {
            String key = cat.getCategory().toLowerCase().trim();
            List<Task> catTasks = tasksByCategory.getOrDefault(key, Collections.emptyList());
            BigDecimal catBudget = cat.getAllocatedAmount() != null ? cat.getAllocatedAmount() : BigDecimal.ZERO;

            if (catTasks.isEmpty() || catBudget.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            int totalSpInCat = 0;
            int autoTaskCount = 0;
            for (Task t : catTasks) {
                if (resetManualOverrides || !"MANUAL".equalsIgnoreCase(t.getBudgetAllocationSource())) {
                    autoTaskCount++;
                    int sp = t.getStoryPoints() != null ? Math.max(0, t.getStoryPoints()) : 0;
                    totalSpInCat += sp;
                }
            }

            if (autoTaskCount > 0) {
                if (totalSpInCat > 0) {
                    BigDecimal costPerSp = catBudget.divide(BigDecimal.valueOf(totalSpInCat), 6, RoundingMode.HALF_UP);
                    for (Task t : catTasks) {
                        if (resetManualOverrides || !"MANUAL".equalsIgnoreCase(t.getBudgetAllocationSource())) {
                            int sp = t.getStoryPoints() != null ? Math.max(0, t.getStoryPoints()) : 0;
                            t.setAllocatedBudget(costPerSp.multiply(BigDecimal.valueOf(sp)).setScale(2, RoundingMode.HALF_UP));
                        }
                    }
                } else {
                    BigDecimal perTaskAlloc = catBudget.divide(BigDecimal.valueOf(autoTaskCount), 2, RoundingMode.HALF_UP);
                    for (Task t : catTasks) {
                        if (resetManualOverrides || !"MANUAL".equalsIgnoreCase(t.getBudgetAllocationSource())) {
                            t.setAllocatedBudget(perTaskAlloc);
                        }
                    }
                }
            }
        }
    }

    private void calculateTimeBasedAllocation(List<Task> tasks, BigDecimal defaultHourlyRate, boolean resetManualOverrides) {
        for (Task task : tasks) {
            if (resetManualOverrides || !"MANUAL".equalsIgnoreCase(task.getBudgetAllocationSource())) {
                long estimateSec = task.getOriginalEstimateSeconds() != null ? task.getOriginalEstimateSeconds() : 0L;
                if (estimateSec > 0 && defaultHourlyRate.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal hours = BigDecimal.valueOf(estimateSec).divide(SECONDS_PER_HOUR, 4, RoundingMode.HALF_UP);
                    task.setAllocatedBudget(hours.multiply(defaultHourlyRate).setScale(2, RoundingMode.HALF_UP));
                } else {
                    task.setAllocatedBudget(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                }
            }
        }
    }

    public List<ProjectBudgetCategory> initializeDefaultCategories(Project project) {
        List<ProjectBudgetCategory> defaultList = new ArrayList<>();
        defaultList.add(new ProjectBudgetCategory(project, "Core Features", new BigDecimal("60.00")));
        defaultList.add(new ProjectBudgetCategory(project, "Technical Infrastructure", new BigDecimal("20.00")));
        defaultList.add(new ProjectBudgetCategory(project, "Bug/Maintenance", new BigDecimal("10.00")));
        defaultList.add(new ProjectBudgetCategory(project, "Contingency", new BigDecimal("10.00")));
        return budgetCategoryRepository.saveAll(defaultList);
    }

    /**
     * Returns full financial summary for a project.
     */
    @Transactional(readOnly = true)
    public ProjectFinancialSummaryDTO getProjectFinancialSummary(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found with id: " + projectId));

        List<Task> tasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        List<ProjectBudgetCategory> categories = budgetCategoryRepository.findByProjectId(projectId);
        if (categories == null || categories.isEmpty()) {
            categories = Collections.emptyList();
        }

        ProjectFinancialSummaryDTO summary = new ProjectFinancialSummaryDTO();
        summary.setProjectId(project.getId());
        summary.setProjectName(project.getName());

        BigDecimal totalBudget = project.getTotalBudget() != null ? project.getTotalBudget() : BigDecimal.ZERO;
        BigDecimal contingencyPercent = project.getContingencyPercent() != null ? project.getContingencyPercent() : BigDecimal.ZERO;
        BigDecimal defaultHourlyRate = project.getDefaultHourlyRate() != null ? project.getDefaultHourlyRate() : BigDecimal.ZERO;
        String allocationMethod = project.getBudgetAllocationMethod() != null ? project.getBudgetAllocationMethod() : "STORY_POINT_WEIGHTED";

        BigDecimal contingencyAmount = totalBudget.multiply(contingencyPercent).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal availableWorkBudget = totalBudget.subtract(contingencyAmount);
        if (availableWorkBudget.compareTo(BigDecimal.ZERO) < 0) {
            availableWorkBudget = BigDecimal.ZERO;
        }

        BigDecimal totalAllocatedBudget = BigDecimal.ZERO;
        BigDecimal totalActualCost = BigDecimal.ZERO;
        int totalStoryPoints = 0;
        long totalTimeSpentSeconds = 0L;

        Map<String, BigDecimal> catAllocMap = new HashMap<>();
        Map<String, BigDecimal> catCostMap = new HashMap<>();
        Map<String, Integer> catCountMap = new HashMap<>();

        for (Task t : tasks) {
            BigDecimal alloc = t.getAllocatedBudget() != null ? t.getAllocatedBudget() : BigDecimal.ZERO;
            BigDecimal cost = t.getActualCost() != null ? t.getActualCost() : BigDecimal.ZERO;
            int sp = t.getStoryPoints() != null ? Math.max(0, t.getStoryPoints()) : 0;
            long timeSpent = t.getTimeSpentSeconds() != null ? t.getTimeSpentSeconds() : 0L;

            totalAllocatedBudget = totalAllocatedBudget.add(alloc);
            totalActualCost = totalActualCost.add(cost);
            totalStoryPoints += sp;
            totalTimeSpentSeconds += timeSpent;

            String cat = t.getCategory() != null && !t.getCategory().trim().isEmpty() ? t.getCategory().trim() : "Core Features";
            catAllocMap.put(cat, catAllocMap.getOrDefault(cat, BigDecimal.ZERO).add(alloc));
            catCostMap.put(cat, catCostMap.getOrDefault(cat, BigDecimal.ZERO).add(cost));
            catCountMap.put(cat, catCountMap.getOrDefault(cat, 0) + 1);
        }

        if ("CATEGORY_BASED".equalsIgnoreCase(allocationMethod)) {
            totalAllocatedBudget = availableWorkBudget;
        }

        BigDecimal remainingBudget = availableWorkBudget.subtract(totalActualCost);
        BigDecimal budgetUtilizationPercent = BigDecimal.ZERO;
        if (availableWorkBudget.compareTo(BigDecimal.ZERO) > 0) {
            budgetUtilizationPercent = totalActualCost.multiply(HUNDRED).divide(availableWorkBudget, 2, RoundingMode.HALF_UP);
        }

        BigDecimal costVariance = totalAllocatedBudget.subtract(totalActualCost);
        BigDecimal costPerStoryPoint = BigDecimal.ZERO;
        if (project.getCostPerStoryPoint() != null && project.getCostPerStoryPoint().compareTo(BigDecimal.ZERO) > 0) {
            costPerStoryPoint = project.getCostPerStoryPoint();
        } else if (totalStoryPoints > 0 && availableWorkBudget.compareTo(BigDecimal.ZERO) > 0) {
            costPerStoryPoint = availableWorkBudget.divide(BigDecimal.valueOf(totalStoryPoints), 2, RoundingMode.HALF_UP);
        }

        summary.setTotalBudget(totalBudget.setScale(2, RoundingMode.HALF_UP));
        summary.setContingencyPercent(contingencyPercent.setScale(2, RoundingMode.HALF_UP));
        summary.setContingencyAmount(contingencyAmount.setScale(2, RoundingMode.HALF_UP));
        summary.setAvailableWorkBudget(availableWorkBudget.setScale(2, RoundingMode.HALF_UP));
        summary.setTotalAllocatedBudget(totalAllocatedBudget.setScale(2, RoundingMode.HALF_UP));
        summary.setTotalActualCost(totalActualCost.setScale(2, RoundingMode.HALF_UP));
        summary.setRemainingBudget(remainingBudget.setScale(2, RoundingMode.HALF_UP));
        summary.setBudgetUtilizationPercent(budgetUtilizationPercent);
        summary.setCostVariance(costVariance.setScale(2, RoundingMode.HALF_UP));
        summary.setTotalStoryPoints(totalStoryPoints);
        summary.setCostPerStoryPoint(costPerStoryPoint);
        summary.setTotalTimeSpentSeconds(totalTimeSpentSeconds);
        summary.setTotalTimeSpentFormatted(Task.formatSecondsToTime(totalTimeSpentSeconds));
        summary.setDefaultHourlyRate(defaultHourlyRate.setScale(2, RoundingMode.HALF_UP));
        summary.setBudgetAllocationMethod(allocationMethod);
        summary.setTaskCount(tasks.size());

        // Category DTOs
        List<ProjectBudgetCategoryDTO> catDtos = categories.stream()
                .map(c -> new ProjectBudgetCategoryDTO(c.getId(), c.getCategory(), c.getAllocationPercent(), c.getAllocatedAmount()))
                .collect(Collectors.toList());
        summary.setCategories(catDtos);

        // Category Summaries
        List<ProjectFinancialSummaryDTO.CategoryFinancialSummaryDTO> catSummaries = new ArrayList<>();
        Set<String> allCats = new HashSet<>(catAllocMap.keySet());
        for (ProjectBudgetCategory c : categories) {
            allCats.add(c.getCategory());
        }
        if (allCats.isEmpty()) {
            allCats.add("Core Features");
        }

        for (String cName : allCats) {
            BigDecimal catPercent = categories.stream()
                    .filter(c -> c.getCategory().equalsIgnoreCase(cName))
                    .findFirst()
                    .map(ProjectBudgetCategory::getAllocationPercent)
                    .orElse(BigDecimal.ZERO);

            BigDecimal alloc = catAllocMap.getOrDefault(cName, BigDecimal.ZERO);
            if ("CATEGORY_BASED".equalsIgnoreCase(allocationMethod)) {
                alloc = availableWorkBudget.multiply(catPercent).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            }
            BigDecimal cost = catCostMap.getOrDefault(cName, BigDecimal.ZERO);
            int count = catCountMap.getOrDefault(cName, 0);
            BigDecimal var = alloc.subtract(cost);
            BigDecimal util = alloc.compareTo(BigDecimal.ZERO) > 0 
                    ? cost.multiply(HUNDRED).divide(alloc, 2, RoundingMode.HALF_UP) 
                    : BigDecimal.ZERO;

            catSummaries.add(new ProjectFinancialSummaryDTO.CategoryFinancialSummaryDTO(
                    cName, catPercent, alloc.setScale(2, RoundingMode.HALF_UP), cost.setScale(2, RoundingMode.HALF_UP),
                    var.setScale(2, RoundingMode.HALF_UP), util, count
            ));
        }
        summary.setCategorySummaries(catSummaries);

        // Cost Trend from Worklogs
        List<WorkLog> workLogs = workLogRepository.findByProjectId(projectId);
        Map<String, Long> monthlyTimeSpent = new LinkedHashMap<>();
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");

        for (WorkLog wl : workLogs) {
            String monthKey;
            if (wl.getWorkDate() != null) {
                monthKey = wl.getWorkDate().format(monthFormatter);
            } else if (wl.getCreatedAt() != null) {
                monthKey = wl.getCreatedAt().format(monthFormatter);
            } else {
                continue;
            }
            long sec = wl.getTimeSpentSeconds() != null ? wl.getTimeSpentSeconds() : 0L;
            monthlyTimeSpent.put(monthKey, monthlyTimeSpent.getOrDefault(monthKey, 0L) + sec);
        }

        List<ProjectFinancialSummaryDTO.MonthlyCostDTO> trendList = new ArrayList<>();
        for (Map.Entry<String, Long> entry : monthlyTimeSpent.entrySet()) {
            BigDecimal hours = BigDecimal.valueOf(entry.getValue()).divide(SECONDS_PER_HOUR, 4, RoundingMode.HALF_UP);
            BigDecimal monthCost = hours.multiply(defaultHourlyRate).setScale(2, RoundingMode.HALF_UP);
            trendList.add(new ProjectFinancialSummaryDTO.MonthlyCostDTO(entry.getKey(), monthCost, entry.getValue()));
        }
        summary.setCostTrend(trendList);

        return summary;
    }

    /**
     * Returns task-level financials for all tasks in a project.
     */
    @Transactional(readOnly = true)
    public List<TaskFinancialDTO> getTaskFinancials(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found with id: " + projectId));

        List<Task> tasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        BigDecimal defaultHourlyRate = project.getDefaultHourlyRate() != null ? project.getDefaultHourlyRate() : BigDecimal.ZERO;

        String prefix = project.getName() != null && project.getName().length() >= 3
                ? project.getName().substring(0, Math.min(4, project.getName().length())).toUpperCase().replaceAll("[^A-Z0-9]", "")
                : "PROJ";
        if (prefix.isEmpty()) prefix = "PROJ";

        List<TaskFinancialDTO> dtoList = new ArrayList<>();
        for (Task t : tasks) {
            TaskFinancialDTO dto = new TaskFinancialDTO();
            dto.setTaskId(t.getId());
            dto.setTaskKey(prefix + "-" + (t.getProjectSequence() != null ? t.getProjectSequence() : t.getId()));
            dto.setTaskName(t.getTitle());
            dto.setCategory(t.getCategory() != null ? t.getCategory() : "Core Features");
            dto.setStoryPoints(t.getStoryPoints() != null ? t.getStoryPoints() : 0);
            dto.setOriginalEstimate(t.getOriginalEstimate());
            dto.setOriginalEstimateSeconds(t.getOriginalEstimateSeconds() != null ? t.getOriginalEstimateSeconds() : 0L);
            dto.setTimeSpent(Task.formatSecondsToTime(t.getTimeSpentSeconds() != null ? t.getTimeSpentSeconds() : 0L));
            dto.setTimeSpentSeconds(t.getTimeSpentSeconds() != null ? t.getTimeSpentSeconds() : 0L);
            dto.setHourlyRate(defaultHourlyRate);

            BigDecimal alloc = t.getAllocatedBudget() != null ? t.getAllocatedBudget().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            BigDecimal cost = t.getActualCost() != null ? t.getActualCost().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            BigDecimal variance = alloc.subtract(cost).setScale(2, RoundingMode.HALF_UP);
            BigDecimal util = alloc.compareTo(BigDecimal.ZERO) > 0
                    ? cost.multiply(HUNDRED).divide(alloc, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            dto.setAllocatedBudget(alloc);
            dto.setActualCost(cost);
            dto.setCostVariance(variance);
            dto.setBudgetUtilization(util);
            dto.setBudgetAllocationSource(t.getBudgetAllocationSource() != null ? t.getBudgetAllocationSource() : "AUTOMATIC");
            dto.setStatus(t.getStatus());
            dto.setIssueType(t.getIssueType());
            dto.setPriority(t.getPriority());
            dto.setAssigneeName(t.getAssignee() != null ? t.getAssignee().getName() : "Unassigned");

            dtoList.add(dto);
        }

        return dtoList;
    }

    /**
     * Get budget change history for a project
     */
    @Transactional(readOnly = true)
    public List<ProjectBudgetHistoryDTO> getProjectBudgetHistory(Long projectId) {
        if (budgetHistoryRepository == null) {
            return Collections.emptyList();
        }
        List<ProjectBudgetHistory> histories = budgetHistoryRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        return histories.stream().map(this::toBudgetHistoryDTO).collect(Collectors.toList());
    }

    private ProjectBudgetHistoryDTO toBudgetHistoryDTO(ProjectBudgetHistory entity) {
        ProjectBudgetHistoryDTO dto = new ProjectBudgetHistoryDTO();
        dto.setId(entity.getId());
        dto.setProjectId(entity.getProjectId());
        dto.setPreviousTotalBudget(entity.getPreviousTotalBudget());
        dto.setNewTotalBudget(entity.getNewTotalBudget());
        dto.setPreviousContingencyPercent(entity.getPreviousContingencyPercent());
        dto.setNewContingencyPercent(entity.getNewContingencyPercent());
        dto.setPreviousAllocationMethod(entity.getPreviousAllocationMethod());
        dto.setNewAllocationMethod(entity.getNewAllocationMethod());
        dto.setPreviousHourlyRate(entity.getPreviousHourlyRate());
        dto.setNewHourlyRate(entity.getNewHourlyRate());
        dto.setPreviousCostPerStoryPoint(entity.getPreviousCostPerStoryPoint());
        dto.setNewCostPerStoryPoint(entity.getNewCostPerStoryPoint());
        dto.setChangeSummary(entity.getChangeSummary());
        dto.setComment(entity.getComment());
        dto.setPerformedBy(entity.getPerformedBy());
        dto.setPerformedByEmpId(entity.getPerformedByEmpId());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

    /**
     * Updates project budget settings and recalculates (default system user).
     */
    public ProjectFinancialSummaryDTO updateProjectBudgetSettings(Long projectId, ProjectBudgetSettingsRequest request) {
        return updateProjectBudgetSettings(projectId, request, "System", null);
    }

    /**
     * Updates project budget settings with performer context and recalculates.
     */
    public ProjectFinancialSummaryDTO updateProjectBudgetSettings(Long projectId, ProjectBudgetSettingsRequest request, String performedBy, String empId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found with id: " + projectId));

        BigDecimal oldTotalBudget = project.getTotalBudget();
        BigDecimal oldContingency = project.getContingencyPercent();
        BigDecimal oldHourlyRate = project.getDefaultHourlyRate();
        BigDecimal oldCostPerSp = project.getCostPerStoryPoint();
        String oldMethod = project.getBudgetAllocationMethod();

        if (request.getTotalBudget() != null) {
            if (request.getTotalBudget().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Total budget must be non-negative");
            }
            project.setTotalBudget(request.getTotalBudget());
        }

        if (request.getContingencyPercent() != null) {
            if (request.getContingencyPercent().compareTo(BigDecimal.ZERO) < 0 || request.getContingencyPercent().compareTo(HUNDRED) > 0) {
                throw new IllegalArgumentException("Contingency percent must be between 0 and 100");
            }
            project.setContingencyPercent(request.getContingencyPercent());
        }

        if (request.getDefaultHourlyRate() != null) {
            if (request.getDefaultHourlyRate().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Default hourly rate must be non-negative");
            }
            project.setDefaultHourlyRate(request.getDefaultHourlyRate());
        }

        if (request.getCostPerStoryPoint() != null) {
            if (request.getCostPerStoryPoint().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Cost per story point must be non-negative");
            }
            project.setCostPerStoryPoint(request.getCostPerStoryPoint());
        }

        if (request.getBudgetAllocationMethod() != null) {
            project.setBudgetAllocationMethod(request.getBudgetAllocationMethod());
        }

        // Save categories if provided
        if (request.getCategories() != null && !request.getCategories().isEmpty()) {
            BigDecimal totalPercent = BigDecimal.ZERO;
            for (ProjectBudgetCategoryDTO catDTO : request.getCategories()) {
                if (catDTO.getAllocationPercent() == null || catDTO.getAllocationPercent().compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("Category allocation percent must be non-negative");
                }
                totalPercent = totalPercent.add(catDTO.getAllocationPercent());
            }

            if (totalPercent.compareTo(HUNDRED) != 0) {
                throw new IllegalArgumentException("Category allocation percentages must total 100% (currently " + totalPercent + "%)");
            }

            // Remove existing and replace
            budgetCategoryRepository.deleteByProjectId(projectId);
            List<ProjectBudgetCategory> newCategories = new ArrayList<>();
            for (ProjectBudgetCategoryDTO catDTO : request.getCategories()) {
                ProjectBudgetCategory cat = new ProjectBudgetCategory(project, catDTO.getCategory(), catDTO.getAllocationPercent());
                newCategories.add(cat);
            }
            budgetCategoryRepository.saveAll(newCategories);
        }

        projectRepository.save(project);
        recalculateProjectBudget(projectId, false);

        // Record budget change in history
        recordBudgetChangeHistory(
                projectId,
                oldTotalBudget, project.getTotalBudget(),
                oldContingency, project.getContingencyPercent(),
                oldMethod, project.getBudgetAllocationMethod(),
                oldHourlyRate, project.getDefaultHourlyRate(),
                oldCostPerSp, project.getCostPerStoryPoint(),
                request.getChangeReason(),
                performedBy,
                empId
        );

        return getProjectFinancialSummary(projectId);
    }

    /**
     * Record budget change history entry and log activity.
     */
    public void recordBudgetChangeHistory(Long projectId,
                                          BigDecimal oldTotalBudget, BigDecimal newTotalBudget,
                                          BigDecimal oldContingency, BigDecimal newContingency,
                                          String oldMethod, String newMethod,
                                          BigDecimal oldHourlyRate, BigDecimal newHourlyRate,
                                          BigDecimal oldCostPerSp, BigDecimal newCostPerSp,
                                          String comment, String performedBy, String empId) {
        if (budgetHistoryRepository == null) return;

        List<String> changes = new ArrayList<>();

        boolean totalBudgetChanged = isDifferent(oldTotalBudget, newTotalBudget);
        if (totalBudgetChanged) {
            changes.add(String.format("Total Budget: %s → %s", formatMoney(oldTotalBudget), formatMoney(newTotalBudget)));
        }

        boolean methodChanged = oldMethod != null && newMethod != null && !oldMethod.equalsIgnoreCase(newMethod);
        if (methodChanged) {
            changes.add(String.format("Method: %s → %s", formatMethod(oldMethod), formatMethod(newMethod)));
        }

        boolean contingencyChanged = isDifferent(oldContingency, newContingency);
        if (contingencyChanged) {
            changes.add(String.format("Contingency: %s%% → %s%%",
                    oldContingency != null ? oldContingency.stripTrailingZeros().toPlainString() : "0",
                    newContingency != null ? newContingency.stripTrailingZeros().toPlainString() : "0"));
        }

        boolean hourlyRateChanged = isDifferent(oldHourlyRate, newHourlyRate);
        if (hourlyRateChanged) {
            changes.add(String.format("Hourly Rate: %s/hr → %s/hr", formatMoney(oldHourlyRate), formatMoney(newHourlyRate)));
        }

        boolean costPerSpChanged = isDifferent(oldCostPerSp, newCostPerSp);
        if (costPerSpChanged) {
            changes.add(String.format("Cost per SP: %s/SP → %s/SP", formatMoney(oldCostPerSp), formatMoney(newCostPerSp)));
        }

        if (!changes.isEmpty() || (comment != null && !comment.trim().isEmpty())) {
            String summary = changes.isEmpty() ? "Budget settings updated" : String.join(" | ", changes);
            ProjectBudgetHistory history = new ProjectBudgetHistory(
                    projectId,
                    oldTotalBudget, newTotalBudget,
                    oldContingency, newContingency,
                    oldMethod, newMethod,
                    oldHourlyRate, newHourlyRate,
                    oldCostPerSp, newCostPerSp,
                    summary,
                    comment,
                    performedBy != null ? performedBy : "System",
                    empId
            );
            budgetHistoryRepository.save(history);

            if (activityLogService != null) {
                try {
                    activityLogService.log(
                            projectId,
                            empId,
                            "BUDGET_CHANGED",
                            "PROJECT",
                            projectId,
                            summary,
                            oldTotalBudget != null ? oldTotalBudget.toString() : null,
                            newTotalBudget != null ? newTotalBudget.toString() : null,
                            summary + (comment != null && !comment.trim().isEmpty() ? " (Note: " + comment + ")" : "")
                    );
                } catch (Exception ignored) {
                }
            }
        }
    }

    private boolean isDifferent(BigDecimal b1, BigDecimal b2) {
        if (b1 == null && b2 == null) return false;
        if (b1 == null || b2 == null) return true;
        return b1.compareTo(b2) != 0;
    }

    private String formatMoney(BigDecimal amount) {
        if (amount == null) return "₹0";
        return "₹" + amount.setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private String formatMethod(String method) {
        if (method == null) return "Model A (Story Point Weighted)";
        if ("STORY_POINT_WEIGHTED".equalsIgnoreCase(method)) return "Model A (Story Point Weighted)";
        if ("CATEGORY_BASED".equalsIgnoreCase(method)) return "Model B (Category Based)";
        if ("TIME_BASED".equalsIgnoreCase(method)) return "Model C (Time Based)";
        return method;
    }

    /**
     * Manually updates a task's budget/cost or category.
     */
    public TaskFinancialDTO updateTaskBudget(Long projectId, Long taskId, TaskBudgetUpdateRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found with id: " + taskId));

        if (!task.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("Task does not belong to project id: " + projectId);
        }

        boolean shouldRecalculate = false;

        if (request.getAllocatedBudget() != null) {
            if (request.getAllocatedBudget().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Allocated budget cannot be negative");
            }
            task.setAllocatedBudget(request.getAllocatedBudget());
            task.setBudgetAllocationSource("MANUAL");
        }

        if (request.getActualCost() != null) {
            if (request.getActualCost().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Actual cost cannot be negative");
            }
            task.setActualCost(request.getActualCost());
        }

        if (request.getBudgetAllocationSource() != null) {
            task.setBudgetAllocationSource(request.getBudgetAllocationSource());
            if ("AUTOMATIC".equalsIgnoreCase(request.getBudgetAllocationSource())) {
                shouldRecalculate = true;
            }
        }

        if (request.getCategory() != null && !request.getCategory().trim().isEmpty()) {
            task.setCategory(request.getCategory().trim());
            shouldRecalculate = true;
        }

        taskRepository.save(task);

        if (shouldRecalculate) {
            recalculateProjectBudget(projectId, false);
        }

        return getTaskFinancials(projectId).stream()
                .filter(dto -> dto.getTaskId().equals(taskId))
                .findFirst()
                .orElseThrow();
    }
}
