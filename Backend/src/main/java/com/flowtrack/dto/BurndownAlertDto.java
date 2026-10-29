package com.flowtrack.dto;

import java.time.LocalDate;
import java.util.List;

public class BurndownAlertDto {
    private String id;
    private String title;
    private String severity; // INFO, WARNING, CRITICAL
    private String type;     // LONG_FLAT_PERIOD, LARGE_UPWARD_SPIKE, LAST_DAY_COMPLETION_SPIKE, NO_PROGRESS_MULTIPLE_DAYS, UNEXPECTED_SCOPE_INCREASE
    private String description;
    private LocalDate detectionDate;
    private Integer affectedDays;
    private Integer affectedPoints;
    private String relatedTask;
    private List<String> potentialCauses;
    private String recommendedAction;

    public BurndownAlertDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getDetectionDate() { return detectionDate; }
    public void setDetectionDate(LocalDate detectionDate) { this.detectionDate = detectionDate; }

    public Integer getAffectedDays() { return affectedDays; }
    public void setAffectedDays(Integer affectedDays) { this.affectedDays = affectedDays; }

    public Integer getAffectedPoints() { return affectedPoints; }
    public void setAffectedPoints(Integer affectedPoints) { this.affectedPoints = affectedPoints; }

    public String getRelatedTask() { return relatedTask; }
    public void setRelatedTask(String relatedTask) { this.relatedTask = relatedTask; }

    public List<String> getPotentialCauses() { return potentialCauses; }
    public void setPotentialCauses(List<String> potentialCauses) { this.potentialCauses = potentialCauses; }

    public String getRecommendedAction() { return recommendedAction; }
    public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }
}
