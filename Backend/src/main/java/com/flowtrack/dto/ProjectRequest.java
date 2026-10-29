package com.flowtrack.dto;

import com.flowtrack.model.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public class ProjectRequest {
    private String name;
    private String description;
    private String objective;
    private Integer teamSize;
    private LocalDate deadline;
    private String projectType;
    private String category;
    private Set<User> teamMembers;
    private Long leadId;
    private BigDecimal totalBudget;
    private BigDecimal contingencyPercent;
    private BigDecimal defaultHourlyRate;
    private String budgetAllocationMethod;

    public Long getLeadId() {
        return leadId;
    }

    public void setLeadId(Long leadId) {
        this.leadId = leadId;
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

    public Set<User> getTeamMembers() {
        return teamMembers;
    }

    public void setTeamMembers(Set<User> teamMembers) {
        this.teamMembers = teamMembers;
    }

    public BigDecimal getTotalBudget() {
        return totalBudget;
    }

    public void setTotalBudget(BigDecimal totalBudget) {
        this.totalBudget = totalBudget;
    }

    public BigDecimal getContingencyPercent() {
        return contingencyPercent;
    }

    public void setContingencyPercent(BigDecimal contingencyPercent) {
        this.contingencyPercent = contingencyPercent;
    }

    public BigDecimal getDefaultHourlyRate() {
        return defaultHourlyRate;
    }

    public void setDefaultHourlyRate(BigDecimal defaultHourlyRate) {
        this.defaultHourlyRate = defaultHourlyRate;
    }

    public String getBudgetAllocationMethod() {
        return budgetAllocationMethod;
    }

    public void setBudgetAllocationMethod(String budgetAllocationMethod) {
        this.budgetAllocationMethod = budgetAllocationMethod;
    }
}
