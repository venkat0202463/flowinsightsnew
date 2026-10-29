package com.flowtrack.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class BurndownDailyPointDto {
    private int dayIndex;
    private LocalDate date;
    private String dayLabel;
    private Double idealRemaining;
    private Double actualRemaining; // null for dates after today
    private Double originalCommitment;
    private Double currentScope;
    private Double completedPoints;
    private Double addedPoints;
    private Double removedPoints;
    private Double dailyCreated = 0.0;
    private Double dailyCompleted = 0.0;
    private List<SprintScopeChangeDto> events = new ArrayList<>();

    public BurndownDailyPointDto() {}

    public int getDayIndex() { return dayIndex; }
    public void setDayIndex(int dayIndex) { this.dayIndex = dayIndex; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getDayLabel() { return dayLabel; }
    public void setDayLabel(String dayLabel) { this.dayLabel = dayLabel; }

    public Double getIdealRemaining() { return idealRemaining; }
    public void setIdealRemaining(Double idealRemaining) { this.idealRemaining = idealRemaining; }

    public Double getActualRemaining() { return actualRemaining; }
    public void setActualRemaining(Double actualRemaining) { this.actualRemaining = actualRemaining; }

    public Double getOriginalCommitment() { return originalCommitment; }
    public void setOriginalCommitment(Double originalCommitment) { this.originalCommitment = originalCommitment; }

    public Double getCurrentScope() { return currentScope; }
    public void setCurrentScope(Double currentScope) { this.currentScope = currentScope; }

    public Double getCompletedPoints() { return completedPoints; }
    public void setCompletedPoints(Double completedPoints) { this.completedPoints = completedPoints; }

    public Double getAddedPoints() { return addedPoints; }
    public void setAddedPoints(Double addedPoints) { this.addedPoints = addedPoints; }

    public Double getRemovedPoints() { return removedPoints; }
    public void setRemovedPoints(Double removedPoints) { this.removedPoints = removedPoints; }

    public Double getDailyCreated() { return dailyCreated; }
    public void setDailyCreated(Double dailyCreated) { this.dailyCreated = dailyCreated; }

    public Double getDailyCompleted() { return dailyCompleted; }
    public void setDailyCompleted(Double dailyCompleted) { this.dailyCompleted = dailyCompleted; }

    public List<SprintScopeChangeDto> getEvents() { return events; }
    public void setEvents(List<SprintScopeChangeDto> events) { this.events = events; }
}
