package com.flowtrack.dto;

import java.util.List;

public class TeamCapacityDto {
    private Long projectId;
    private Long sprintId;
    private String sprintName;
    private int teamMemberCount;
    private int workingDays;
    private double totalAvailableHours;
    private double totalAvailablePersonDays;
    private Double capacityStoryPoints;
    private boolean isManuallyConfigured;
    private String capacityUnit; // STORY_POINTS, HOURS, PERSON_DAYS
    private Double hoursPerStoryPoint;
    private String calculationBasis;
    private List<MemberCapacityDto> memberCapacities;

    public TeamCapacityDto() {}

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public String getSprintName() { return sprintName; }
    public void setSprintName(String sprintName) { this.sprintName = sprintName; }

    public int getTeamMemberCount() { return teamMemberCount; }
    public void setTeamMemberCount(int teamMemberCount) { this.teamMemberCount = teamMemberCount; }

    public int getWorkingDays() { return workingDays; }
    public void setWorkingDays(int workingDays) { this.workingDays = workingDays; }

    public double getTotalAvailableHours() { return totalAvailableHours; }
    public void setTotalAvailableHours(double totalAvailableHours) { this.totalAvailableHours = totalAvailableHours; }

    public double getTotalAvailablePersonDays() { return totalAvailablePersonDays; }
    public void setTotalAvailablePersonDays(double totalAvailablePersonDays) { this.totalAvailablePersonDays = totalAvailablePersonDays; }

    public Double getCapacityStoryPoints() { return capacityStoryPoints; }
    public void setCapacityStoryPoints(Double capacityStoryPoints) { this.capacityStoryPoints = capacityStoryPoints; }

    public boolean isManuallyConfigured() { return isManuallyConfigured; }
    public void setManuallyConfigured(boolean manuallyConfigured) { isManuallyConfigured = manuallyConfigured; }

    public String getCapacityUnit() { return capacityUnit; }
    public void setCapacityUnit(String capacityUnit) { this.capacityUnit = capacityUnit; }

    public Double getHoursPerStoryPoint() { return hoursPerStoryPoint; }
    public void setHoursPerStoryPoint(Double hoursPerStoryPoint) { this.hoursPerStoryPoint = hoursPerStoryPoint; }

    public String getCalculationBasis() { return calculationBasis; }
    public void setCalculationBasis(String calculationBasis) { this.calculationBasis = calculationBasis; }

    public List<MemberCapacityDto> getMemberCapacities() { return memberCapacities; }
    public void setMemberCapacities(List<MemberCapacityDto> memberCapacities) { this.memberCapacities = memberCapacities; }
}
