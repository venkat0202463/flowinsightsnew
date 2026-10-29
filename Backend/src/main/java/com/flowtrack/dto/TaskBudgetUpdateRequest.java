package com.flowtrack.dto;

import java.math.BigDecimal;

public class TaskBudgetUpdateRequest {
    private BigDecimal allocatedBudget;
    private BigDecimal actualCost;
    private String budgetAllocationSource; // AUTOMATIC, MANUAL
    private String category;

    public TaskBudgetUpdateRequest() {
    }

    public BigDecimal getAllocatedBudget() {
        return allocatedBudget;
    }

    public void setAllocatedBudget(BigDecimal allocatedBudget) {
        this.allocatedBudget = allocatedBudget;
    }

    public BigDecimal getActualCost() {
        return actualCost;
    }

    public void setActualCost(BigDecimal actualCost) {
        this.actualCost = actualCost;
    }

    public String getBudgetAllocationSource() {
        return budgetAllocationSource;
    }

    public void setBudgetAllocationSource(String budgetAllocationSource) {
        this.budgetAllocationSource = budgetAllocationSource;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
