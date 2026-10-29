package com.flowtrack.repository;

import com.flowtrack.model.SprintScopeChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SprintScopeChangeRepository extends JpaRepository<SprintScopeChange, Long> {

    List<SprintScopeChange> findBySprintIdOrderByChangedAtAsc(Long sprintId);

    List<SprintScopeChange> findBySprintIdOrderByChangedAtDesc(Long sprintId);

    void deleteBySprintId(Long sprintId);
}
