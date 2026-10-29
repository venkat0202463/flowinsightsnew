package com.flowtrack.dto;

import java.time.LocalDate;

public class VelocitySprintDto {
    private Long sprintId;
    private String sprintName;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private int committedPoints;
    private int completedPoints;
    private int difference; // completed - committed
    private boolean isCompleted;

    public VelocitySprintDto() {}

    public VelocitySprintDto(Long sprintId, String sprintName, LocalDate startDate, LocalDate endDate,
                             String status, int committedPoints, int completedPoints, int difference,
                             boolean isCompleted) {
        this.sprintId = sprintId;
        this.sprintName = sprintName;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.committedPoints = committedPoints;
        this.completedPoints = completedPoints;
        this.difference = difference;
        this.isCompleted = isCompleted;
    }

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

    public int getCommittedPoints() { return committedPoints; }
    public void setCommittedPoints(int committedPoints) { this.committedPoints = committedPoints; }

    public int getCompletedPoints() { return completedPoints; }
    public void setCompletedPoints(int completedPoints) { this.completedPoints = completedPoints; }

    public int getDifference() { return difference; }
    public void setDifference(int difference) { this.difference = difference; }

    public boolean isCompleted() { return isCompleted; }
    public void setCompleted(boolean completed) { isCompleted = completed; }
}
