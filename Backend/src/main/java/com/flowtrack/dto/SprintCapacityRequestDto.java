package com.flowtrack.dto;

import java.util.List;

public class SprintCapacityRequestDto {
    private Long projectId;
    private Long sprintId; // Optional: null for project-level default
    private Integer workingDays;
    private Double dailyHours;
    private Double storyPointsCapacity;
    private Double hoursPerStoryPoint;
    private Boolean isManual;
    private List<MemberCapacityDto> memberCapacities;

    public SprintCapacityRequestDto() {}

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public Integer getWorkingDays() { return workingDays; }
    public void setWorkingDays(Integer workingDays) { this.workingDays = workingDays; }

    public Double getDailyHours() { return dailyHours; }
    public void setDailyHours(Double dailyHours) { this.dailyHours = dailyHours; }

    public Double getStoryPointsCapacity() { return storyPointsCapacity; }
    public void setStoryPointsCapacity(Double storyPointsCapacity) { this.storyPointsCapacity = storyPointsCapacity; }

    public Double getHoursPerStoryPoint() { return hoursPerStoryPoint; }
    public void setHoursPerStoryPoint(Double hoursPerStoryPoint) { this.hoursPerStoryPoint = hoursPerStoryPoint; }

    public Boolean getIsManual() { return isManual; }
    public void setIsManual(Boolean manual) { isManual = manual; }

    public List<MemberCapacityDto> getMemberCapacities() { return memberCapacities; }
    public void setMemberCapacities(List<MemberCapacityDto> memberCapacities) { this.memberCapacities = memberCapacities; }
}
