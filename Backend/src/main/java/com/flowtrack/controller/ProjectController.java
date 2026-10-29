package com.flowtrack.controller;

import com.flowtrack.model.Project;
import com.flowtrack.security.UserDetailsImpl;
import com.flowtrack.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    @Autowired
    private ProjectService projectService;

    @GetMapping
    public List<Project> getAllProjects(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        String role = userDetails.getAuthorities().stream().findFirst().map(a -> a.getAuthority()).orElse("USER");
        return projectService.getAllProjects(userDetails.getId(), role);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long id) {
        return projectService.getProjectById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Project createProject(@RequestBody com.flowtrack.dto.ProjectRequest projectRequest, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        Project project = new Project();
        project.setName(projectRequest.getName());
        project.setDescription(projectRequest.getDescription());
        project.setObjective(projectRequest.getObjective());
        project.setTeamSize(projectRequest.getTeamSize());
        project.setDeadline(projectRequest.getDeadline());
        project.setProjectType(projectRequest.getProjectType());
        project.setCategory(projectRequest.getCategory());
        project.setTeamMembers(projectRequest.getTeamMembers());
        if (projectRequest.getTotalBudget() != null) project.setTotalBudget(projectRequest.getTotalBudget());
        if (projectRequest.getContingencyPercent() != null) project.setContingencyPercent(projectRequest.getContingencyPercent());
        if (projectRequest.getDefaultHourlyRate() != null) project.setDefaultHourlyRate(projectRequest.getDefaultHourlyRate());
        if (projectRequest.getBudgetAllocationMethod() != null) project.setBudgetAllocationMethod(projectRequest.getBudgetAllocationMethod());
        Long leadId = projectRequest.getLeadId() != null ? projectRequest.getLeadId() : userDetails.getId();
        return projectService.createProject(project, leadId);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Project> updateProject(@PathVariable Long id, @RequestBody com.flowtrack.dto.ProjectRequest projectRequest) {
        Project project = new Project();
        project.setName(projectRequest.getName());
        project.setDescription(projectRequest.getDescription());
        project.setObjective(projectRequest.getObjective());
        project.setTeamSize(projectRequest.getTeamSize());
        project.setDeadline(projectRequest.getDeadline());
        project.setProjectType(projectRequest.getProjectType());
        project.setCategory(projectRequest.getCategory());
        project.setTeamMembers(projectRequest.getTeamMembers());
        if (projectRequest.getTotalBudget() != null) project.setTotalBudget(projectRequest.getTotalBudget());
        if (projectRequest.getContingencyPercent() != null) project.setContingencyPercent(projectRequest.getContingencyPercent());
        if (projectRequest.getDefaultHourlyRate() != null) project.setDefaultHourlyRate(projectRequest.getDefaultHourlyRate());
        if (projectRequest.getBudgetAllocationMethod() != null) project.setBudgetAllocationMethod(projectRequest.getBudgetAllocationMethod());
        return ResponseEntity.ok(projectService.updateProject(id, project, projectRequest.getLeadId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable Long id) {
        projectService.deleteProject(id);
        return ResponseEntity.ok().build();
    }
}
