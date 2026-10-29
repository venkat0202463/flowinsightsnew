package com.flowtrack.dto;

import java.util.List;

public class VelocityPlanningRecommendationDto {
    private Long projectId;
    private int historicalSprintsUsed;
    private Integer observedRangeMin;
    private Integer observedRangeMax;
    private Double historicalAverage;
    private Long roundedHistoricalAverage;
    private Double currentTeamCapacity; // In Story Points (comparable unit)
    private Double currentTeamCapacityHours;
    private Double currentTeamCapacityDays;
    private String capacityUnit;
    private boolean isCapacityConfigured;
    private boolean isCapacityManual;
    private Double suggestedPlanningBaseline;
    private Long roundedSuggestedPlanningBaseline;
    private boolean insufficientDataWarning;
    private boolean capacityConfigRequired;
    private String advisoryNote;
    private List<VelocitySprintDto> includedSprints;

    public VelocityPlanningRecommendationDto() {}

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public int getHistoricalSprintsUsed() { return historicalSprintsUsed; }
    public void setHistoricalSprintsUsed(int historicalSprintsUsed) { this.historicalSprintsUsed = historicalSprintsUsed; }

    public Integer getObservedRangeMin() { return observedRangeMin; }
    public void setObservedRangeMin(Integer observedRangeMin) { this.observedRangeMin = observedRangeMin; }

    public Integer getObservedRangeMax() { return observedRangeMax; }
    public void setObservedRangeMax(Integer observedRangeMax) { this.observedRangeMax = observedRangeMax; }

    public Double getHistoricalAverage() { return historicalAverage; }
    public void setHistoricalAverage(Double historicalAverage) { this.historicalAverage = historicalAverage; }

    public Long getRoundedHistoricalAverage() { return roundedHistoricalAverage; }
    public void setRoundedHistoricalAverage(Long roundedHistoricalAverage) { this.roundedHistoricalAverage = roundedHistoricalAverage; }

    public Double getCurrentTeamCapacity() { return currentTeamCapacity; }
    public void setCurrentTeamCapacity(Double currentTeamCapacity) { this.currentTeamCapacity = currentTeamCapacity; }

    public Double getCurrentTeamCapacityHours() { return currentTeamCapacityHours; }
    public void setCurrentTeamCapacityHours(Double currentTeamCapacityHours) { this.currentTeamCapacityHours = currentTeamCapacityHours; }

    public Double getCurrentTeamCapacityDays() { return currentTeamCapacityDays; }
    public void setCurrentTeamCapacityDays(Double currentTeamCapacityDays) { this.currentTeamCapacityDays = currentTeamCapacityDays; }

    public String getCapacityUnit() { return capacityUnit; }
    public void setCapacityUnit(String capacityUnit) { this.capacityUnit = capacityUnit; }

    public boolean isCapacityConfigured() { return isCapacityConfigured; }
    public void setCapacityConfigured(boolean capacityConfigured) { isCapacityConfigured = capacityConfigured; }

    public boolean isCapacityManual() { return isCapacityManual; }
    public void setCapacityManual(boolean capacityManual) { isCapacityManual = capacityManual; }

    public Double getSuggestedPlanningBaseline() { return suggestedPlanningBaseline; }
    public void setSuggestedPlanningBaseline(Double suggestedPlanningBaseline) { this.suggestedPlanningBaseline = suggestedPlanningBaseline; }

    public Long getRoundedSuggestedPlanningBaseline() { return roundedSuggestedPlanningBaseline; }
    public void setRoundedSuggestedPlanningBaseline(Long roundedSuggestedPlanningBaseline) { this.roundedSuggestedPlanningBaseline = roundedSuggestedPlanningBaseline; }

    public boolean isInsufficientDataWarning() { return insufficientDataWarning; }
    public void setInsufficientDataWarning(boolean insufficientDataWarning) { this.insufficientDataWarning = insufficientDataWarning; }

    public boolean isCapacityConfigRequired() { return capacityConfigRequired; }
    public void setCapacityConfigRequired(boolean capacityConfigRequired) { this.capacityConfigRequired = capacityConfigRequired; }

    public String getAdvisoryNote() { return advisoryNote; }
    public void setAdvisoryNote(String advisoryNote) { this.advisoryNote = advisoryNote; }

    public List<VelocitySprintDto> getIncludedSprints() { return includedSprints; }
    public void setIncludedSprints(List<VelocitySprintDto> includedSprints) { this.includedSprints = includedSprints; }
}
