package com.flowtrack.dto;

public class MemberCapacityDto {
    private String empId;
    private String memberName;
    private int workingDays;
    private double dailyHours;
    private double availabilityPercentage;
    private double availableHours;
    private double availableDays;
    private Double storyPointsCapacity;
    private boolean isManual;

    public MemberCapacityDto() {}

    public MemberCapacityDto(String empId, String memberName, int workingDays, double dailyHours,
                             double availabilityPercentage, double availableHours, double availableDays,
                             Double storyPointsCapacity, boolean isManual) {
        this.empId = empId;
        this.memberName = memberName;
        this.workingDays = workingDays;
        this.dailyHours = dailyHours;
        this.availabilityPercentage = availabilityPercentage;
        this.availableHours = availableHours;
        this.availableDays = availableDays;
        this.storyPointsCapacity = storyPointsCapacity;
        this.isManual = isManual;
    }

    public String getEmpId() { return empId; }
    public void setEmpId(String empId) { this.empId = empId; }

    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }

    public int getWorkingDays() { return workingDays; }
    public void setWorkingDays(int workingDays) { this.workingDays = workingDays; }

    public double getDailyHours() { return dailyHours; }
    public void setDailyHours(double dailyHours) { this.dailyHours = dailyHours; }

    public double getAvailabilityPercentage() { return availabilityPercentage; }
    public void setAvailabilityPercentage(double availabilityPercentage) { this.availabilityPercentage = availabilityPercentage; }

    public double getAvailableHours() { return availableHours; }
    public void setAvailableHours(double availableHours) { this.availableHours = availableHours; }

    public double getAvailableDays() { return availableDays; }
    public void setAvailableDays(double availableDays) { this.availableDays = availableDays; }

    public Double getStoryPointsCapacity() { return storyPointsCapacity; }
    public void setStoryPointsCapacity(Double storyPointsCapacity) { this.storyPointsCapacity = storyPointsCapacity; }

    public boolean getIsManual() { return isManual; }
    public void setIsManual(boolean manual) { isManual = manual; }
}
