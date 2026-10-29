package com.flowtrack.repository;

import com.flowtrack.model.WorkLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WorkLogRepository extends JpaRepository<WorkLog, Long> {
    List<WorkLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    @org.springframework.data.jpa.repository.Query("SELECT w FROM WorkLog w WHERE w.task.project.id = :projectId ORDER BY w.workDate ASC, w.createdAt ASC")
    List<WorkLog> findByProjectId(@org.springframework.data.repository.query.Param("projectId") Long projectId);
}
