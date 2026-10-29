package com.flowtrack.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "project_budget_histories", indexes = {
    @Index(name = "idx_proj_budget_hist_proj_created", columnList = "project_id, created_at")
})
public class ProjectBudgetHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "previous_total_budget", precision = 15, scale = 2)
    private BigDecimal previousTotalBudget;

    @Column(name = "new_total_budget", precision = 15, scale = 2)
    private BigDecimal newTotalBudget;

    @Column(name = "previous_contingency_percent", precision = 5, scale = 2)
    private BigDecimal previousContingencyPercent;

    @Column(name = "new_contingency_percent", precision = 5, scale = 2)
    private BigDecimal newContingencyPercent;

    @Column(name = "previous_allocation_method")
    private String previousAllocationMethod;

    @Column(name = "new_allocation_method")
    private String newAllocationMethod;

    @Column(name = "previous_hourly_rate", precision = 10, scale = 2)
    private BigDecimal previousHourlyRate;

    @Column(name = "new_hourly_rate", precision = 10, scale = 2)
    private BigDecimal newHourlyRate;

    @Column(name = "previous_cost_per_sp", precision = 10, scale = 2)
    private BigDecimal previousCostPerStoryPoint;

    @Column(name = "new_cost_per_sp", precision = 10, scale = 2)
    private BigDecimal newCostPerStoryPoint;

    @Column(name = "change_summary", length = 1000)
    private String changeSummary;

    @Column(name = "comment", length = 1000)
    private String comment;

    @Column(name = "performed_by")
    private String performedBy;

    @Column(name = "performed_by_empid")
    private String performedByEmpId;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public ProjectBudgetHistory() {
    }

    public ProjectBudgetHistory(Long projectId, BigDecimal previousTotalBudget, BigDecimal newTotalBudget,
                                BigDecimal previousContingencyPercent, BigDecimal newContingencyPercent,
                                String previousAllocationMethod, String newAllocationMethod,
                                BigDecimal previousHourlyRate, BigDecimal newHourlyRate,
                                BigDecimal previousCostPerStoryPoint, BigDecimal newCostPerStoryPoint,
                                String changeSummary, String comment,
                                String performedBy, String performedByEmpId) {
        this.projectId = projectId;
        this.previousTotalBudget = previousTotalBudget;
        this.newTotalBudget = newTotalBudget;
        this.previousContingencyPercent = previousContingencyPercent;
        this.newContingencyPercent = newContingencyPercent;
        this.previousAllocationMethod = previousAllocationMethod;
        this.newAllocationMethod = newAllocationMethod;
        this.previousHourlyRate = previousHourlyRate;
        this.newHourlyRate = newHourlyRate;
        this.previousCostPerStoryPoint = previousCostPerStoryPoint;
        this.newCostPerStoryPoint = newCostPerStoryPoint;
        this.changeSummary = changeSummary;
        this.comment = comment;
        this.performedBy = performedBy;
        this.performedByEmpId = performedByEmpId;
        this.createdAt = LocalDateTime.now();
    }

    @JsonProperty("id")
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    @JsonProperty("projectId")
    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    @JsonProperty("previousTotalBudget")
    public BigDecimal getPreviousTotalBudget() {
        return previousTotalBudget;
    }

    public void setPreviousTotalBudget(BigDecimal previousTotalBudget) {
        this.previousTotalBudget = previousTotalBudget;
    }

    @JsonProperty("newTotalBudget")
    public BigDecimal getNewTotalBudget() {
        return newTotalBudget;
    }

    public void setNewTotalBudget(BigDecimal newTotalBudget) {
        this.newTotalBudget = newTotalBudget;
    }

    @JsonProperty("previousContingencyPercent")
    public BigDecimal getPreviousContingencyPercent() {
        return previousContingencyPercent;
    }

    public void setPreviousContingencyPercent(BigDecimal previousContingencyPercent) {
        this.previousContingencyPercent = previousContingencyPercent;
    }

    @JsonProperty("newContingencyPercent")
    public BigDecimal getNewContingencyPercent() {
        return newContingencyPercent;
    }

    public void setNewContingencyPercent(BigDecimal newContingencyPercent) {
        this.newContingencyPercent = newContingencyPercent;
    }

    @JsonProperty("previousAllocationMethod")
    public String getPreviousAllocationMethod() {
        return previousAllocationMethod;
    }

    public void setPreviousAllocationMethod(String previousAllocationMethod) {
        this.previousAllocationMethod = previousAllocationMethod;
    }

    @JsonProperty("newAllocationMethod")
    public String getNewAllocationMethod() {
        return newAllocationMethod;
    }

    public void setNewAllocationMethod(String newAllocationMethod) {
        this.newAllocationMethod = newAllocationMethod;
    }

    @JsonProperty("previousHourlyRate")
    public BigDecimal getPreviousHourlyRate() {
        return previousHourlyRate;
    }

    public void setPreviousHourlyRate(BigDecimal previousHourlyRate) {
        this.previousHourlyRate = previousHourlyRate;
    }

    @JsonProperty("newHourlyRate")
    public BigDecimal getNewHourlyRate() {
        return newHourlyRate;
    }

    public void setNewHourlyRate(BigDecimal newHourlyRate) {
        this.newHourlyRate = newHourlyRate;
    }

    @JsonProperty("previousCostPerStoryPoint")
    public BigDecimal getPreviousCostPerStoryPoint() {
        return previousCostPerStoryPoint;
    }

    public void setPreviousCostPerStoryPoint(BigDecimal previousCostPerStoryPoint) {
        this.previousCostPerStoryPoint = previousCostPerStoryPoint;
    }

    @JsonProperty("newCostPerStoryPoint")
    public BigDecimal getNewCostPerStoryPoint() {
        return newCostPerStoryPoint;
    }

    public void setNewCostPerStoryPoint(BigDecimal newCostPerStoryPoint) {
        this.newCostPerStoryPoint = newCostPerStoryPoint;
    }

    @JsonProperty("changeSummary")
    public String getChangeSummary() {
        return changeSummary;
    }

    public void setChangeSummary(String changeSummary) {
        this.changeSummary = changeSummary;
    }

    @JsonProperty("comment")
    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    @JsonProperty("performedBy")
    public String getPerformedBy() {
        return performedBy;
    }

    public void setPerformedBy(String performedBy) {
        this.performedBy = performedBy;
    }

    @JsonProperty("performedByEmpId")
    public String getPerformedByEmpId() {
        return performedByEmpId;
    }

    public void setPerformedByEmpId(String performedByEmpId) {
        this.performedByEmpId = performedByEmpId;
    }

    @JsonProperty("createdAt")
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
