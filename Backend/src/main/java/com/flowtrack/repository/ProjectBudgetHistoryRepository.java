package com.flowtrack.repository;

import com.flowtrack.model.ProjectBudgetHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectBudgetHistoryRepository extends JpaRepository<ProjectBudgetHistory, Long> {
    List<ProjectBudgetHistory> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    void deleteByProjectId(Long projectId);
}
