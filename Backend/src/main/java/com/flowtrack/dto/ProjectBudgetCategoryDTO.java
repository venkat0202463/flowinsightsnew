package com.flowtrack.dto;

import java.math.BigDecimal;

public class ProjectBudgetCategoryDTO {
    private Long id;
    private String category;
    private BigDecimal allocationPercent = BigDecimal.ZERO;
    private BigDecimal allocatedAmount = BigDecimal.ZERO;

    public ProjectBudgetCategoryDTO() {
    }

    public ProjectBudgetCategoryDTO(Long id, String category, BigDecimal allocationPercent, BigDecimal allocatedAmount) {
        this.id = id;
        this.category = category;
        this.allocationPercent = allocationPercent;
        this.allocatedAmount = allocatedAmount;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getAllocationPercent() {
        return allocationPercent != null ? allocationPercent : BigDecimal.ZERO;
    }

    public void setAllocationPercent(BigDecimal allocationPercent) {
        this.allocationPercent = allocationPercent != null ? allocationPercent : BigDecimal.ZERO;
    }

    public BigDecimal getAllocatedAmount() {
        return allocatedAmount != null ? allocatedAmount : BigDecimal.ZERO;
    }

    public void setAllocatedAmount(BigDecimal allocatedAmount) {
        this.allocatedAmount = allocatedAmount != null ? allocatedAmount : BigDecimal.ZERO;
    }
}
