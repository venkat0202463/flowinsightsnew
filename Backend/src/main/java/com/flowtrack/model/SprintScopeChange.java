package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "sprint_scope_changes", indexes = {
    @Index(name = "idx_scope_changes_sprint", columnList = "sprint_id"),
    @Index(name = "idx_scope_changes_sprint_changed", columnList = "sprint_id, changed_at")
})
public class SprintScopeChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sprint_id", nullable = false)
    private Long sprintId;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "task_key")
    private String taskKey;

    @Column(name = "task_title")
    private String taskTitle;

    /**
     * Types: TASK_ADDED, TASK_REMOVED, POINTS_INCREASED, POINTS_DECREASED, TASK_REOPENED, TASK_COMPLETED
     */
    @Column(name = "change_type", nullable = false, length = 50)
    private String changeType;

    @Column(name = "from_points")
    private Integer fromPoints;

    @Column(name = "to_points")
    private Integer toPoints;

    @Column(name = "points_diff")
    private Integer pointsDiff;

    @Column(name = "changed_by")
    private String changedBy = "System";

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt = LocalDateTime.now();

    @Column(name = "comment", length = 1000)
    private String comment;

    public SprintScopeChange() {
        this.changedAt = LocalDateTime.now();
    }

    public SprintScopeChange(Long sprintId, Long taskId, String taskKey, String taskTitle,
                             String changeType, Integer fromPoints, Integer toPoints,
                             Integer pointsDiff, String changedBy, String comment) {
        this.sprintId = sprintId;
        this.taskId = taskId;
        this.taskKey = taskKey;
        this.taskTitle = taskTitle;
        this.changeType = changeType;
        this.fromPoints = fromPoints;
        this.toPoints = toPoints;
        this.pointsDiff = pointsDiff;
        this.changedBy = changedBy != null ? changedBy : "System";
        this.comment = comment;
        this.changedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }

    public String getTaskKey() { return taskKey; }
    public void setTaskKey(String taskKey) { this.taskKey = taskKey; }

    public String getTaskTitle() { return taskTitle; }
    public void setTaskTitle(String taskTitle) { this.taskTitle = taskTitle; }

    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }

    public Integer getFromPoints() { return fromPoints; }
    public void setFromPoints(Integer fromPoints) { this.fromPoints = fromPoints; }

    public Integer getToPoints() { return toPoints; }
    public void setToPoints(Integer toPoints) { this.toPoints = toPoints; }

    public Integer getPointsDiff() { return pointsDiff; }
    public void setPointsDiff(Integer pointsDiff) { this.pointsDiff = pointsDiff; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
