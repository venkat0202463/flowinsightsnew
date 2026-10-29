package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "sprints")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Sprint {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private String status = "PLANNED"; // PLANNED, ACTIVE, COMPLETED

    @Column(name = "type")
    private String type = "SPRINT"; // KANBAN, SPRINT

    @Column(name = "initial_commitment_points")
    private Integer initialCommitmentPoints;

    @Column(name = "activated_at")
    private java.time.LocalDateTime activatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Project project;

    public Sprint() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getInitialCommitmentPoints() { return initialCommitmentPoints; }
    public void setInitialCommitmentPoints(Integer initialCommitmentPoints) { this.initialCommitmentPoints = initialCommitmentPoints; }

    public java.time.LocalDateTime getActivatedAt() { return activatedAt; }
    public void setActivatedAt(java.time.LocalDateTime activatedAt) { this.activatedAt = activatedAt; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
}
