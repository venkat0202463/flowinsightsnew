package com.flowtrack.repository;

import com.flowtrack.model.ProjectBudgetCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectBudgetCategoryRepository extends JpaRepository<ProjectBudgetCategory, Long> {
    List<ProjectBudgetCategory> findByProjectId(Long projectId);
    void deleteByProjectId(Long projectId);
}
