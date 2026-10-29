package com.flowtrack.dto;

import java.time.LocalDateTime;

public class SprintScopeChangeDto {
    private Long id;
    private Long sprintId;
    private Long taskId;
    private String taskKey;
    private String taskTitle;
    private String changeType;
    private Integer fromPoints;
    private Integer toPoints;
    private Integer pointsDiff;
    private String changedBy;
    private LocalDateTime changedAt;
    private String comment;

    public SprintScopeChangeDto() {}

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
