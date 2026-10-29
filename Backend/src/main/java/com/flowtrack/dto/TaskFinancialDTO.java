package com.flowtrack.dto;

import java.math.BigDecimal;

public class TaskFinancialDTO {
    private Long taskId;
    private String taskKey;
    private String taskName;
    private String category;
    private Integer storyPoints;
    private String originalEstimate;
    private Long originalEstimateSeconds;
    private String timeSpent;
    private Long timeSpentSeconds;
    private BigDecimal hourlyRate;
    private BigDecimal allocatedBudget;
    private BigDecimal actualCost;
    private BigDecimal costVariance;
    private BigDecimal budgetUtilization;
    private String budgetAllocationSource;
    private String status;
    private String issueType;
    private String priority;
    private String assigneeName;

    public TaskFinancialDTO() {
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public String getTaskKey() {
        return taskKey;
    }

    public void setTaskKey(String taskKey) {
        this.taskKey = taskKey;
    }

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getStoryPoints() {
        return storyPoints;
    }

    public void setStoryPoints(Integer storyPoints) {
        this.storyPoints = storyPoints;
    }

    public String getOriginalEstimate() {
        return originalEstimate;
    }

    public void setOriginalEstimate(String originalEstimate) {
        this.originalEstimate = originalEstimate;
    }

    public Long getOriginalEstimateSeconds() {
        return originalEstimateSeconds;
    }

    public void setOriginalEstimateSeconds(Long originalEstimateSeconds) {
        this.originalEstimateSeconds = originalEstimateSeconds;
    }

    public String getTimeSpent() {
        return timeSpent;
    }

    public void setTimeSpent(String timeSpent) {
        this.timeSpent = timeSpent;
    }

    public Long getTimeSpentSeconds() {
        return timeSpentSeconds;
    }

    public void setTimeSpentSeconds(Long timeSpentSeconds) {
        this.timeSpentSeconds = timeSpentSeconds;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate != null ? hourlyRate : BigDecimal.ZERO;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public BigDecimal getAllocatedBudget() {
        return allocatedBudget != null ? allocatedBudget : BigDecimal.ZERO;
    }

    public void setAllocatedBudget(BigDecimal allocatedBudget) {
        this.allocatedBudget = allocatedBudget;
    }

    public BigDecimal getActualCost() {
        return actualCost != null ? actualCost : BigDecimal.ZERO;
    }

    public void setActualCost(BigDecimal actualCost) {
        this.actualCost = actualCost;
    }

    public BigDecimal getCostVariance() {
        return costVariance != null ? costVariance : BigDecimal.ZERO;
    }

    public void setCostVariance(BigDecimal costVariance) {
        this.costVariance = costVariance;
    }

    public BigDecimal getBudgetUtilization() {
        return budgetUtilization != null ? budgetUtilization : BigDecimal.ZERO;
    }

    public void setBudgetUtilization(BigDecimal budgetUtilization) {
        this.budgetUtilization = budgetUtilization;
    }

    public String getBudgetAllocationSource() {
        return budgetAllocationSource != null ? budgetAllocationSource : "AUTOMATIC";
    }

    public void setBudgetAllocationSource(String budgetAllocationSource) {
        this.budgetAllocationSource = budgetAllocationSource;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getIssueType() {
        return issueType;
    }

    public void setIssueType(String issueType) {
        this.issueType = issueType;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getAssigneeName() {
        return assigneeName;
    }

    public void setAssigneeName(String assigneeName) {
        this.assigneeName = assigneeName;
    }
}
