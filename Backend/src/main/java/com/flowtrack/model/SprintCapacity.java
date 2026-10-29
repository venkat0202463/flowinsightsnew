package com.flowtrack.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sprint_capacities", indexes = {
    @Index(name = "idx_capacity_project_sprint", columnList = "project_id, sprint_id"),
    @Index(name = "idx_capacity_project", columnList = "project_id")
})
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class SprintCapacity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "teamMembers" })
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Sprint sprint;

    @Column(name = "member_emp_id")
    private String memberEmpId;

    @Column(name = "member_name")
    private String memberName;

    @Column(name = "working_days")
    private Integer workingDays = 10;

    @Column(name = "daily_hours")
    private Double dailyHours = 8.0;

    @Column(name = "availability_percentage")
    private Double availabilityPercentage = 100.0;

    @Column(name = "available_hours")
    private Double availableHours = 80.0;

    @Column(name = "available_days")
    private Double availableDays = 10.0;

    @Column(name = "story_points_capacity")
    private Double storyPointsCapacity;

    @Column(name = "is_manual")
    private Boolean isManual = false;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public SprintCapacity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    public Sprint getSprint() { return sprint; }
    public void setSprint(Sprint sprint) { this.sprint = sprint; }

    public String getMemberEmpId() { return memberEmpId; }
    public void setMemberEmpId(String memberEmpId) { this.memberEmpId = memberEmpId; }

    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }

    public Integer getWorkingDays() { return workingDays; }
    public void setWorkingDays(Integer workingDays) { this.workingDays = workingDays; }

    public Double getDailyHours() { return dailyHours; }
    public void setDailyHours(Double dailyHours) { this.dailyHours = dailyHours; }

    public Double getAvailabilityPercentage() { return availabilityPercentage; }
    public void setAvailabilityPercentage(Double availabilityPercentage) { this.availabilityPercentage = availabilityPercentage; }

    public Double getAvailableHours() { return availableHours; }
    public void setAvailableHours(Double availableHours) { this.availableHours = availableHours; }

    public Double getAvailableDays() { return availableDays; }
    public void setAvailableDays(Double availableDays) { this.availableDays = availableDays; }

    public Double getStoryPointsCapacity() { return storyPointsCapacity; }
    public void setStoryPointsCapacity(Double storyPointsCapacity) { this.storyPointsCapacity = storyPointsCapacity; }

    public Boolean getIsManual() { return isManual; }
    public void setIsManual(Boolean manual) { isManual = manual; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
