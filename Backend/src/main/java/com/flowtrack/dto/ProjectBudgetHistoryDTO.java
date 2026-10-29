package com.flowtrack.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProjectBudgetHistoryDTO {
    private Long id;
    private Long projectId;
    private BigDecimal previousTotalBudget;
    private BigDecimal newTotalBudget;
    private BigDecimal previousContingencyPercent;
    private BigDecimal newContingencyPercent;
    private String previousAllocationMethod;
    private String newAllocationMethod;
    private BigDecimal previousHourlyRate;
    private BigDecimal newHourlyRate;
    private BigDecimal previousCostPerStoryPoint;
    private BigDecimal newCostPerStoryPoint;
    private String changeSummary;
    private String comment;
    private String performedBy;
    private String performedByEmpId;
    private LocalDateTime createdAt;

    public ProjectBudgetHistoryDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public BigDecimal getPreviousTotalBudget() {
        return previousTotalBudget;
    }

    public void setPreviousTotalBudget(BigDecimal previousTotalBudget) {
        this.previousTotalBudget = previousTotalBudget;
    }

    public BigDecimal getNewTotalBudget() {
        return newTotalBudget;
    }

    public void setNewTotalBudget(BigDecimal newTotalBudget) {
        this.newTotalBudget = newTotalBudget;
    }

    public BigDecimal getPreviousContingencyPercent() {
        return previousContingencyPercent;
    }

    public void setPreviousContingencyPercent(BigDecimal previousContingencyPercent) {
        this.previousContingencyPercent = previousContingencyPercent;
    }

    public BigDecimal getNewContingencyPercent() {
        return newContingencyPercent;
    }

    public void setNewContingencyPercent(BigDecimal newContingencyPercent) {
        this.newContingencyPercent = newContingencyPercent;
    }

    public String getPreviousAllocationMethod() {
        return previousAllocationMethod;
    }

    public void setPreviousAllocationMethod(String previousAllocationMethod) {
        this.previousAllocationMethod = previousAllocationMethod;
    }

    public String getNewAllocationMethod() {
        return newAllocationMethod;
    }

    public void setNewAllocationMethod(String newAllocationMethod) {
        this.newAllocationMethod = newAllocationMethod;
    }

    public BigDecimal getPreviousHourlyRate() {
        return previousHourlyRate;
    }

    public void setPreviousHourlyRate(BigDecimal previousHourlyRate) {
        this.previousHourlyRate = previousHourlyRate;
    }

    public BigDecimal getNewHourlyRate() {
        return newHourlyRate;
    }

    public void setNewHourlyRate(BigDecimal newHourlyRate) {
        this.newHourlyRate = newHourlyRate;
    }

    public BigDecimal getPreviousCostPerStoryPoint() {
        return previousCostPerStoryPoint;
    }

    public void setPreviousCostPerStoryPoint(BigDecimal previousCostPerStoryPoint) {
        this.previousCostPerStoryPoint = previousCostPerStoryPoint;
    }

    public BigDecimal getNewCostPerStoryPoint() {
        return newCostPerStoryPoint;
    }

    public void setNewCostPerStoryPoint(BigDecimal newCostPerStoryPoint) {
        this.newCostPerStoryPoint = newCostPerStoryPoint;
    }

    public String getChangeSummary() {
        return changeSummary;
    }

    public void setChangeSummary(String changeSummary) {
        this.changeSummary = changeSummary;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public void setPerformedBy(String performedBy) {
        this.performedBy = performedBy;
    }

    public String getPerformedByEmpId() {
        return performedByEmpId;
    }

    public void setPerformedByEmpId(String performedByEmpId) {
        this.performedByEmpId = performedByEmpId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
