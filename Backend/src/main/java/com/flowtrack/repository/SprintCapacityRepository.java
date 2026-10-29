package com.flowtrack.repository;

import com.flowtrack.model.SprintCapacity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SprintCapacityRepository extends JpaRepository<SprintCapacity, Long> {
    List<SprintCapacity> findByProjectId(Long projectId);
    List<SprintCapacity> findBySprintId(Long sprintId);
    List<SprintCapacity> findByProjectIdAndSprintId(Long projectId, Long sprintId);
    List<SprintCapacity> findByProjectIdAndSprintIdIsNull(Long projectId);
    Optional<SprintCapacity> findByProjectIdAndSprintIdAndMemberEmpId(Long projectId, Long sprintId, String memberEmpId);
    Optional<SprintCapacity> findByProjectIdAndSprintIdIsNullAndMemberEmpId(Long projectId, String memberEmpId);
}
