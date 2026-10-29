package com.flowtrack.dto;

import java.math.BigDecimal;
import java.util.List;

public class ProjectBudgetSettingsRequest {
    private BigDecimal totalBudget;
    private BigDecimal contingencyPercent;
    private BigDecimal defaultHourlyRate;
    private BigDecimal costPerStoryPoint;
    private String budgetAllocationMethod; // STORY_POINT_WEIGHTED, CATEGORY_BASED, TIME_BASED
    private List<ProjectBudgetCategoryDTO> categories;
    private String changeReason;

    public ProjectBudgetSettingsRequest() {
    }

    public String getChangeReason() {
        return changeReason;
    }

    public void setChangeReason(String changeReason) {
        this.changeReason = changeReason;
    }

    public BigDecimal getTotalBudget() {
        return totalBudget != null ? totalBudget : BigDecimal.ZERO;
    }

    public void setTotalBudget(BigDecimal totalBudget) {
        this.totalBudget = totalBudget;
    }

    public BigDecimal getContingencyPercent() {
        return contingencyPercent != null ? contingencyPercent : BigDecimal.ZERO;
    }

    public void setContingencyPercent(BigDecimal contingencyPercent) {
        this.contingencyPercent = contingencyPercent;
    }

    public BigDecimal getDefaultHourlyRate() {
        return defaultHourlyRate != null ? defaultHourlyRate : BigDecimal.ZERO;
    }

    public void setDefaultHourlyRate(BigDecimal defaultHourlyRate) {
        this.defaultHourlyRate = defaultHourlyRate;
    }

    public BigDecimal getCostPerStoryPoint() {
        return costPerStoryPoint;
    }

    public void setCostPerStoryPoint(BigDecimal costPerStoryPoint) {
        this.costPerStoryPoint = costPerStoryPoint;
    }

    public String getBudgetAllocationMethod() {
        return budgetAllocationMethod != null ? budgetAllocationMethod : "STORY_POINT_WEIGHTED";
    }

    public void setBudgetAllocationMethod(String budgetAllocationMethod) {
        this.budgetAllocationMethod = budgetAllocationMethod;
    }

    public List<ProjectBudgetCategoryDTO> getCategories() {
        return categories;
    }

    public void setCategories(List<ProjectBudgetCategoryDTO> categories) {
        this.categories = categories;
    }
}
