package com.flowtrack.dto;

import java.util.List;

public class VelocityAnalyticsResponseDto {
    private Long projectId;
    private int sprintsAnalyzedCount;
    private Double averageVelocity;
    private Long roundedAverageVelocity;
    private Integer latestSprintVelocity;
    private Integer highestSprintVelocity;
    private Integer lowestSprintVelocity;
    private int totalCompletedPoints;
    private List<VelocitySprintDto> sprints;

    public VelocityAnalyticsResponseDto() {}

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public int getSprintsAnalyzedCount() { return sprintsAnalyzedCount; }
    public void setSprintsAnalyzedCount(int sprintsAnalyzedCount) { this.sprintsAnalyzedCount = sprintsAnalyzedCount; }

    public Double getAverageVelocity() { return averageVelocity; }
    public void setAverageVelocity(Double averageVelocity) { this.averageVelocity = averageVelocity; }

    public Long getRoundedAverageVelocity() { return roundedAverageVelocity; }
    public void setRoundedAverageVelocity(Long roundedAverageVelocity) { this.roundedAverageVelocity = roundedAverageVelocity; }

    public Integer getLatestSprintVelocity() { return latestSprintVelocity; }
    public void setLatestSprintVelocity(Integer latestSprintVelocity) { this.latestSprintVelocity = latestSprintVelocity; }

    public Integer getHighestSprintVelocity() { return highestSprintVelocity; }
    public void setHighestSprintVelocity(Integer highestSprintVelocity) { this.highestSprintVelocity = highestSprintVelocity; }

    public Integer getLowestSprintVelocity() { return lowestSprintVelocity; }
    public void setLowestSprintVelocity(Integer lowestSprintVelocity) { this.lowestSprintVelocity = lowestSprintVelocity; }

    public int getTotalCompletedPoints() { return totalCompletedPoints; }
    public void setTotalCompletedPoints(int totalCompletedPoints) { this.totalCompletedPoints = totalCompletedPoints; }

    public List<VelocitySprintDto> getSprints() { return sprints; }
    public void setSprints(List<VelocitySprintDto> sprints) { this.sprints = sprints; }
}
