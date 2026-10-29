package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "projects")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String objective;

    private Integer teamSize = 0;

    @Column(name = "deadline")
    private LocalDate deadline;

    @Column(name = "project_type")
    private String projectType = "KANBAN";

    @Column(name = "category")
    private String category;

    @Column(name = "total_budget", precision = 15, scale = 2)
    private java.math.BigDecimal totalBudget = java.math.BigDecimal.ZERO;

    @Column(name = "contingency_percent", precision = 5, scale = 2)
    private java.math.BigDecimal contingencyPercent = java.math.BigDecimal.ZERO;

    @Column(name = "default_hourly_rate", precision = 10, scale = 2)
    private java.math.BigDecimal defaultHourlyRate = java.math.BigDecimal.ZERO;

    @Column(name = "cost_per_story_point", precision = 12, scale = 2)
    private java.math.BigDecimal costPerStoryPoint = java.math.BigDecimal.ZERO;

    @Column(name = "budget_allocation_method", length = 50)
    private String budgetAllocationMethod = "STORY_POINT_WEIGHTED"; // STORY_POINT_WEIGHTED, CATEGORY_BASED, TIME_BASED

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "project" })
    private java.util.List<ProjectBudgetCategory> budgetCategories = new java.util.ArrayList<>();

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by", referencedColumnName = "emp_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    private User createdBy;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "project_members", joinColumns = @JoinColumn(name = "project_id"), inverseJoinColumns = @JoinColumn(name = "user_id", referencedColumnName = "emp_id"))
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    @org.hibernate.annotations.BatchSize(size = 100)
    private Set<User> teamMembers = new HashSet<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Project() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getObjective() {
        return objective;
    }

    public void setObjective(String objective) {
        this.objective = objective;
    }

    public Integer getTeamSize() {
        return teamSize;
    }

    public void setTeamSize(Integer teamSize) {
        this.teamSize = teamSize;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getProjectType() {
        return projectType;
    }

    public void setProjectType(String projectType) {
        this.projectType = projectType;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public java.math.BigDecimal getTotalBudget() {
        return totalBudget != null ? totalBudget : java.math.BigDecimal.ZERO;
    }

    public void setTotalBudget(java.math.BigDecimal totalBudget) {
        this.totalBudget = totalBudget != null ? totalBudget : java.math.BigDecimal.ZERO;
    }

    public java.math.BigDecimal getContingencyPercent() {
        return contingencyPercent != null ? contingencyPercent : java.math.BigDecimal.ZERO;
    }

    public void setContingencyPercent(java.math.BigDecimal contingencyPercent) {
        this.contingencyPercent = contingencyPercent != null ? contingencyPercent : java.math.BigDecimal.ZERO;
    }

    public java.math.BigDecimal getDefaultHourlyRate() {
        return defaultHourlyRate != null ? defaultHourlyRate : java.math.BigDecimal.ZERO;
    }

    public void setDefaultHourlyRate(java.math.BigDecimal defaultHourlyRate) {
        this.defaultHourlyRate = defaultHourlyRate != null ? defaultHourlyRate : java.math.BigDecimal.ZERO;
    }

    public java.math.BigDecimal getCostPerStoryPoint() {
        return costPerStoryPoint != null ? costPerStoryPoint : java.math.BigDecimal.ZERO;
    }

    public void setCostPerStoryPoint(java.math.BigDecimal costPerStoryPoint) {
        this.costPerStoryPoint = costPerStoryPoint != null ? costPerStoryPoint : java.math.BigDecimal.ZERO;
    }

    public String getBudgetAllocationMethod() {
        return budgetAllocationMethod != null ? budgetAllocationMethod : "STORY_POINT_WEIGHTED";
    }

    public void setBudgetAllocationMethod(String budgetAllocationMethod) {
        this.budgetAllocationMethod = budgetAllocationMethod != null ? budgetAllocationMethod : "STORY_POINT_WEIGHTED";
    }

    public java.util.List<ProjectBudgetCategory> getBudgetCategories() {
        return budgetCategories;
    }

    public void setBudgetCategories(java.util.List<ProjectBudgetCategory> budgetCategories) {
        this.budgetCategories = budgetCategories;
    }

    public Set<User> getTeamMembers() {
        return teamMembers;
    }

    public void setTeamMembers(Set<User> teamMembers) {
        this.teamMembers = teamMembers;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        Project project = (Project) o;
        return id != null && id.equals(project.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
