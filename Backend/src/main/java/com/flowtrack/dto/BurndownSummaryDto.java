package com.flowtrack.dto;

import java.time.LocalDate;

public class BurndownSummaryDto {
    private Long sprintId;
    private String sprintName;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;

    private Integer initialCommitment;
    private Integer currentScope;
    private Integer addedPoints;
    private Integer removedPoints;
    private Integer completedPoints;
    private Integer remainingPoints;
    private Double scopeCreepIndex; // null if initialCommitment is 0
    private Double completionPercentage;
    private Integer activeAlertsCount;

    public BurndownSummaryDto() {}

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public String getSprintName() { return sprintName; }
    public void setSprintName(String sprintName) { this.sprintName = sprintName; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getInitialCommitment() { return initialCommitment; }
    public void setInitialCommitment(Integer initialCommitment) { this.initialCommitment = initialCommitment; }

    public Integer getCurrentScope() { return currentScope; }
    public void setCurrentScope(Integer currentScope) { this.currentScope = currentScope; }

    public Integer getAddedPoints() { return addedPoints; }
    public void setAddedPoints(Integer addedPoints) { this.addedPoints = addedPoints; }

    public Integer getRemovedPoints() { return removedPoints; }
    public void setRemovedPoints(Integer removedPoints) { this.removedPoints = removedPoints; }

    public Integer getCompletedPoints() { return completedPoints; }
    public void setCompletedPoints(Integer completedPoints) { this.completedPoints = completedPoints; }

    public Integer getRemainingPoints() { return remainingPoints; }
    public void setRemainingPoints(Integer remainingPoints) { this.remainingPoints = remainingPoints; }

    public Double getScopeCreepIndex() { return scopeCreepIndex; }
    public void setScopeCreepIndex(Double scopeCreepIndex) { this.scopeCreepIndex = scopeCreepIndex; }

    public Double getCompletionPercentage() { return completionPercentage; }
    public void setCompletionPercentage(Double completionPercentage) { this.completionPercentage = completionPercentage; }

    public Integer getActiveAlertsCount() { return activeAlertsCount; }
    public void setActiveAlertsCount(Integer activeAlertsCount) { this.activeAlertsCount = activeAlertsCount; }
}
