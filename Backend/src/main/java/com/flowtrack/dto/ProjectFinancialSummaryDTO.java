package com.flowtrack.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ProjectFinancialSummaryDTO {
    private Long projectId;
    private String projectName;
    private BigDecimal totalBudget = BigDecimal.ZERO;
    private BigDecimal contingencyPercent = BigDecimal.ZERO;
    private BigDecimal contingencyAmount = BigDecimal.ZERO;
    private BigDecimal availableWorkBudget = BigDecimal.ZERO;
    private BigDecimal totalAllocatedBudget = BigDecimal.ZERO;
    private BigDecimal totalActualCost = BigDecimal.ZERO;
    private BigDecimal remainingBudget = BigDecimal.ZERO;
    private BigDecimal budgetUtilizationPercent = BigDecimal.ZERO;
    private BigDecimal costVariance = BigDecimal.ZERO;
    private Integer totalStoryPoints = 0;
    private BigDecimal costPerStoryPoint = BigDecimal.ZERO;
    private Long totalTimeSpentSeconds = 0L;
    private String totalTimeSpentFormatted = "0h";
    private BigDecimal defaultHourlyRate = BigDecimal.ZERO;
    private String budgetAllocationMethod = "STORY_POINT_WEIGHTED";
    private Integer taskCount = 0;
    private List<ProjectBudgetCategoryDTO> categories = new ArrayList<>();
    private List<CategoryFinancialSummaryDTO> categorySummaries = new ArrayList<>();
    private List<MonthlyCostDTO> costTrend = new ArrayList<>();

    public static class CategoryFinancialSummaryDTO {
        private String category;
        private BigDecimal allocationPercent = BigDecimal.ZERO;
        private BigDecimal allocatedBudget = BigDecimal.ZERO;
        private BigDecimal actualCost = BigDecimal.ZERO;
        private BigDecimal variance = BigDecimal.ZERO;
        private BigDecimal utilizationPercent = BigDecimal.ZERO;
        private int taskCount = 0;

        public CategoryFinancialSummaryDTO() {}

        public CategoryFinancialSummaryDTO(String category, BigDecimal allocationPercent, BigDecimal allocatedBudget, BigDecimal actualCost, BigDecimal variance, BigDecimal utilizationPercent, int taskCount) {
            this.category = category;
            this.allocationPercent = allocationPercent;
            this.allocatedBudget = allocatedBudget;
            this.actualCost = actualCost;
            this.variance = variance;
            this.utilizationPercent = utilizationPercent;
            this.taskCount = taskCount;
        }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public BigDecimal getAllocationPercent() { return allocationPercent; }
        public void setAllocationPercent(BigDecimal allocationPercent) { this.allocationPercent = allocationPercent; }
        public BigDecimal getAllocatedBudget() { return allocatedBudget; }
        public void setAllocatedBudget(BigDecimal allocatedBudget) { this.allocatedBudget = allocatedBudget; }
        public BigDecimal getActualCost() { return actualCost; }
        public void setActualCost(BigDecimal actualCost) { this.actualCost = actualCost; }
        public BigDecimal getVariance() { return variance; }
        public void setVariance(BigDecimal variance) { this.variance = variance; }
        public BigDecimal getUtilizationPercent() { return utilizationPercent; }
        public void setUtilizationPercent(BigDecimal utilizationPercent) { this.utilizationPercent = utilizationPercent; }
        public int getTaskCount() { return taskCount; }
        public void setTaskCount(int taskCount) { this.taskCount = taskCount; }
    }

    public static class MonthlyCostDTO {
        private String period; // e.g. "Jan 2026", "2026-01"
        private BigDecimal actualCost = BigDecimal.ZERO;
        private Long timeSpentSeconds = 0L;

        public MonthlyCostDTO() {}

        public MonthlyCostDTO(String period, BigDecimal actualCost, Long timeSpentSeconds) {
            this.period = period;
            this.actualCost = actualCost;
            this.timeSpentSeconds = timeSpentSeconds;
        }

        public String getPeriod() { return period; }
        public void setPeriod(String period) { this.period = period; }
        public BigDecimal getActualCost() { return actualCost; }
        public void setActualCost(BigDecimal actualCost) { this.actualCost = actualCost; }
        public Long getTimeSpentSeconds() { return timeSpentSeconds; }
        public void setTimeSpentSeconds(Long timeSpentSeconds) { this.timeSpentSeconds = timeSpentSeconds; }
    }

    public ProjectFinancialSummaryDTO() {
    }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public BigDecimal getTotalBudget() { return totalBudget != null ? totalBudget : BigDecimal.ZERO; }
    public void setTotalBudget(BigDecimal totalBudget) { this.totalBudget = totalBudget; }
    public BigDecimal getContingencyPercent() { return contingencyPercent != null ? contingencyPercent : BigDecimal.ZERO; }
    public void setContingencyPercent(BigDecimal contingencyPercent) { this.contingencyPercent = contingencyPercent; }
    public BigDecimal getContingencyAmount() { return contingencyAmount != null ? contingencyAmount : BigDecimal.ZERO; }
    public void setContingencyAmount(BigDecimal contingencyAmount) { this.contingencyAmount = contingencyAmount; }
    public BigDecimal getAvailableWorkBudget() { return availableWorkBudget != null ? availableWorkBudget : BigDecimal.ZERO; }
    public void setAvailableWorkBudget(BigDecimal availableWorkBudget) { this.availableWorkBudget = availableWorkBudget; }
    public BigDecimal getTotalAllocatedBudget() { return totalAllocatedBudget != null ? totalAllocatedBudget : BigDecimal.ZERO; }
    public void setTotalAllocatedBudget(BigDecimal totalAllocatedBudget) { this.totalAllocatedBudget = totalAllocatedBudget; }
    public BigDecimal getTotalActualCost() { return totalActualCost != null ? totalActualCost : BigDecimal.ZERO; }
    public void setTotalActualCost(BigDecimal totalActualCost) { this.totalActualCost = totalActualCost; }
    public BigDecimal getRemainingBudget() { return remainingBudget != null ? remainingBudget : BigDecimal.ZERO; }
    public void setRemainingBudget(BigDecimal remainingBudget) { this.remainingBudget = remainingBudget; }
    public BigDecimal getBudgetUtilizationPercent() { return budgetUtilizationPercent != null ? budgetUtilizationPercent : BigDecimal.ZERO; }
    public void setBudgetUtilizationPercent(BigDecimal budgetUtilizationPercent) { this.budgetUtilizationPercent = budgetUtilizationPercent; }
    public BigDecimal getCostVariance() { return costVariance != null ? costVariance : BigDecimal.ZERO; }
    public void setCostVariance(BigDecimal costVariance) { this.costVariance = costVariance; }
    public Integer getTotalStoryPoints() { return totalStoryPoints != null ? totalStoryPoints : 0; }
    public void setTotalStoryPoints(Integer totalStoryPoints) { this.totalStoryPoints = totalStoryPoints; }
    public BigDecimal getCostPerStoryPoint() { return costPerStoryPoint != null ? costPerStoryPoint : BigDecimal.ZERO; }
    public void setCostPerStoryPoint(BigDecimal costPerStoryPoint) { this.costPerStoryPoint = costPerStoryPoint; }
    public Long getTotalTimeSpentSeconds() { return totalTimeSpentSeconds != null ? totalTimeSpentSeconds : 0L; }
    public void setTotalTimeSpentSeconds(Long totalTimeSpentSeconds) { this.totalTimeSpentSeconds = totalTimeSpentSeconds; }
    public String getTotalTimeSpentFormatted() { return totalTimeSpentFormatted; }
    public void setTotalTimeSpentFormatted(String totalTimeSpentFormatted) { this.totalTimeSpentFormatted = totalTimeSpentFormatted; }
    public BigDecimal getDefaultHourlyRate() { return defaultHourlyRate != null ? defaultHourlyRate : BigDecimal.ZERO; }
    public void setDefaultHourlyRate(BigDecimal defaultHourlyRate) { this.defaultHourlyRate = defaultHourlyRate; }
    public String getBudgetAllocationMethod() { return budgetAllocationMethod != null ? budgetAllocationMethod : "STORY_POINT_WEIGHTED"; }
    public void setBudgetAllocationMethod(String budgetAllocationMethod) { this.budgetAllocationMethod = budgetAllocationMethod; }
    public Integer getTaskCount() { return taskCount != null ? taskCount : 0; }
    public void setTaskCount(Integer taskCount) { this.taskCount = taskCount; }
    public List<ProjectBudgetCategoryDTO> getCategories() { return categories; }
    public void setCategories(List<ProjectBudgetCategoryDTO> categories) { this.categories = categories; }
    public List<CategoryFinancialSummaryDTO> getCategorySummaries() { return categorySummaries; }
    public void setCategorySummaries(List<CategoryFinancialSummaryDTO> categorySummaries) { this.categorySummaries = categorySummaries; }
    public List<MonthlyCostDTO> getCostTrend() { return costTrend; }
    public void setCostTrend(List<MonthlyCostDTO> costTrend) { this.costTrend = costTrend; }
}
