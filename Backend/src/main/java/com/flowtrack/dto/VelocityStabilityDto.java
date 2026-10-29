package com.flowtrack.dto;

public class VelocityStabilityDto {
    private Long projectId;
    private int sprintsAnalyzedCount;
    private Double averageVelocity;
    private Long roundedAverageVelocity;
    private Double recentVelocity;
    private Long roundedRecentVelocity;
    private Double standardDeviation;
    private Long roundedStandardDeviation;
    private Double coefficientOfVariation;
    private String stabilityIndicator; // STABLE, MODERATELY_VARIABLE, HIGHLY_VARIABLE, N_A
    private String stabilityDescription;
    private Integer highestVelocity;
    private Integer lowestVelocity;

    public VelocityStabilityDto() {}

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public int getSprintsAnalyzedCount() { return sprintsAnalyzedCount; }
    public void setSprintsAnalyzedCount(int sprintsAnalyzedCount) { this.sprintsAnalyzedCount = sprintsAnalyzedCount; }

    public Double getAverageVelocity() { return averageVelocity; }
    public void setAverageVelocity(Double averageVelocity) { this.averageVelocity = averageVelocity; }

    public Long getRoundedAverageVelocity() { return roundedAverageVelocity; }
    public void setRoundedAverageVelocity(Long roundedAverageVelocity) { this.roundedAverageVelocity = roundedAverageVelocity; }

    public Double getRecentVelocity() { return recentVelocity; }
    public void setRecentVelocity(Double recentVelocity) { this.recentVelocity = recentVelocity; }

    public Long getRoundedRecentVelocity() { return roundedRecentVelocity; }
    public void setRoundedRecentVelocity(Long roundedRecentVelocity) { this.roundedRecentVelocity = roundedRecentVelocity; }

    public Double getStandardDeviation() { return standardDeviation; }
    public void setStandardDeviation(Double standardDeviation) { this.standardDeviation = standardDeviation; }

    public Long getRoundedStandardDeviation() { return roundedStandardDeviation; }
    public void setRoundedStandardDeviation(Long roundedStandardDeviation) { this.roundedStandardDeviation = roundedStandardDeviation; }

    public Double getCoefficientOfVariation() { return coefficientOfVariation; }
    public void setCoefficientOfVariation(Double coefficientOfVariation) { this.coefficientOfVariation = coefficientOfVariation; }

    public String getStabilityIndicator() { return stabilityIndicator; }
    public void setStabilityIndicator(String stabilityIndicator) { this.stabilityIndicator = stabilityIndicator; }

    public String getStabilityDescription() { return stabilityDescription; }
    public void setStabilityDescription(String stabilityDescription) { this.stabilityDescription = stabilityDescription; }

    public Integer getHighestVelocity() { return highestVelocity; }
    public void setHighestVelocity(Integer highestVelocity) { this.highestVelocity = highestVelocity; }

    public Integer getLowestVelocity() { return lowestVelocity; }
    public void setLowestVelocity(Integer lowestVelocity) { this.lowestVelocity = lowestVelocity; }
}
