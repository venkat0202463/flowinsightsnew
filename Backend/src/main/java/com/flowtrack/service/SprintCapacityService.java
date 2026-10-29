package com.flowtrack.service;

import com.flowtrack.dto.MemberCapacityDto;
import com.flowtrack.dto.SprintCapacityRequestDto;
import com.flowtrack.dto.TeamCapacityDto;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.SprintCapacity;
import com.flowtrack.model.User;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.SprintCapacityRepository;
import com.flowtrack.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class SprintCapacityService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private SprintCapacityRepository sprintCapacityRepository;

    public TeamCapacityDto getTeamCapacity(Long projectId, Long sprintId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        Sprint sprint = null;
        if (sprintId != null) {
            sprint = sprintRepository.findById(sprintId).orElse(null);
        }

        // Determine working days from sprint dates if available
        int workingDays = 10;
        if (sprint != null && sprint.getStartDate() != null && sprint.getEndDate() != null) {
            workingDays = calculateWorkingDays(sprint.getStartDate(), sprint.getEndDate());
        }

        // Check if configured capacities exist for (project, sprint) or fallback to (project, default)
        List<SprintCapacity> capacities = Collections.emptyList();
        if (sprintId != null) {
            capacities = sprintCapacityRepository.findByProjectIdAndSprintId(projectId, sprintId);
        }
        if (capacities.isEmpty()) {
            capacities = sprintCapacityRepository.findByProjectIdAndSprintIdIsNull(projectId);
        }

        List<MemberCapacityDto> memberDtos = new ArrayList<>();
        boolean isManual = false;
        Double customSpCapacity = null;
        double defaultDailyHours = 8.0;
        double defaultHoursPerSp = 8.0;

        if (!capacities.isEmpty()) {
            for (SprintCapacity sc : capacities) {
                if (sc.getMemberEmpId() == null) {
                    // Overall capacity header record
                    if (sc.getWorkingDays() != null) workingDays = sc.getWorkingDays();
                    if (sc.getDailyHours() != null) defaultDailyHours = sc.getDailyHours();
                    if (sc.getStoryPointsCapacity() != null) customSpCapacity = sc.getStoryPointsCapacity();
                    if (Boolean.TRUE.equals(sc.getIsManual())) isManual = true;
                } else {
                    int mDays = sc.getWorkingDays() != null ? sc.getWorkingDays() : workingDays;
                    double mDailyHours = sc.getDailyHours() != null ? sc.getDailyHours() : defaultDailyHours;
                    double mAvailPct = sc.getAvailabilityPercentage() != null ? sc.getAvailabilityPercentage() : 100.0;
                    double mHours = sc.getAvailableHours() != null ? sc.getAvailableHours()
                            : (mDays * mDailyHours * (mAvailPct / 100.0));
                    double mPersonDays = sc.getAvailableDays() != null ? sc.getAvailableDays()
                            : (mDailyHours > 0 ? (mHours / mDailyHours) : 0);

                    memberDtos.add(new MemberCapacityDto(
                            sc.getMemberEmpId(),
                            sc.getMemberName(),
                            mDays,
                            mDailyHours,
                            mAvailPct,
                            Math.round(mHours * 10.0) / 10.0,
                            Math.round(mPersonDays * 10.0) / 10.0,
                            sc.getStoryPointsCapacity(),
                            Boolean.TRUE.equals(sc.getIsManual())
                    ));
                    if (Boolean.TRUE.equals(sc.getIsManual())) isManual = true;
                }
            }
        }

        // If no member records configured yet, auto-populate from project team members
        if (memberDtos.isEmpty()) {
            Set<User> members = new HashSet<>(project.getTeamMembers());
            if (project.getCreatedBy() != null) {
                members.add(project.getCreatedBy());
            }

            if (!members.isEmpty()) {
                for (User u : members) {
                    double hours = workingDays * defaultDailyHours;
                    memberDtos.add(new MemberCapacityDto(
                            u.getEmpId(),
                            u.getName(),
                            workingDays,
                            defaultDailyHours,
                            100.0,
                            hours,
                            workingDays,
                            null,
                            false
                    ));
                }
            } else {
                int teamCount = project.getTeamSize() != null && project.getTeamSize() > 0 ? project.getTeamSize() : 3;
                for (int i = 1; i <= teamCount; i++) {
                    double hours = workingDays * defaultDailyHours;
                    memberDtos.add(new MemberCapacityDto(
                            "EMP-00" + i,
                            "Team Member " + i,
                            workingDays,
                            defaultDailyHours,
                            100.0,
                            hours,
                            workingDays,
                            null,
                            false
                    ));
                }
            }
        }

        double totalHours = memberDtos.stream().mapToDouble(MemberCapacityDto::getAvailableHours).sum();
        double totalPersonDays = defaultDailyHours > 0 ? (totalHours / defaultDailyHours) : (totalHours / 8.0);

        Double finalSpCapacity;
        String calculationBasis;
        if (customSpCapacity != null && customSpCapacity > 0) {
            finalSpCapacity = customSpCapacity;
            calculationBasis = "Manually configured team capacity (" + customSpCapacity + " SP)";
            isManual = true;
        } else {
            // Calculated from hours: standard agile guideline 8 hours per story point
            finalSpCapacity = Math.round((totalHours / defaultHoursPerSp) * 10.0) / 10.0;
            calculationBasis = "Auto-calculated from " + memberDtos.size() + " team members × " + workingDays + " working days (" + defaultHoursPerSp + " hrs/SP)";
        }

        TeamCapacityDto dto = new TeamCapacityDto();
        dto.setProjectId(projectId);
        dto.setSprintId(sprintId);
        dto.setSprintName(sprint != null ? sprint.getName() : "Upcoming Sprint");
        dto.setTeamMemberCount(memberDtos.size());
        dto.setWorkingDays(workingDays);
        dto.setTotalAvailableHours(Math.round(totalHours * 10.0) / 10.0);
        dto.setTotalAvailablePersonDays(Math.round(totalPersonDays * 10.0) / 10.0);
        dto.setCapacityStoryPoints(finalSpCapacity);
        dto.setManuallyConfigured(isManual);
        dto.setCapacityUnit("STORY_POINTS");
        dto.setHoursPerStoryPoint(defaultHoursPerSp);
        dto.setCalculationBasis(calculationBasis);
        dto.setMemberCapacities(memberDtos);

        return dto;
    }

    public TeamCapacityDto saveCapacity(SprintCapacityRequestDto request) {
        Long projectId = request.getProjectId();
        Long sprintId = request.getSprintId();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        Sprint sprint = null;
        if (sprintId != null) {
            sprint = sprintRepository.findById(sprintId).orElse(null);
        }

        // Clean existing records for this project & sprint
        List<SprintCapacity> existing;
        if (sprintId != null) {
            existing = sprintCapacityRepository.findByProjectIdAndSprintId(projectId, sprintId);
        } else {
            existing = sprintCapacityRepository.findByProjectIdAndSprintIdIsNull(projectId);
        }
        if (!existing.isEmpty()) {
            sprintCapacityRepository.deleteAll(existing);
            sprintCapacityRepository.flush();
        }

        int workingDays = request.getWorkingDays() != null && request.getWorkingDays() > 0 ? request.getWorkingDays() : 10;
        double dailyHours = request.getDailyHours() != null && request.getDailyHours() > 0 ? request.getDailyHours() : 8.0;
        boolean isManual = Boolean.TRUE.equals(request.getIsManual()) || (request.getStoryPointsCapacity() != null && request.getStoryPointsCapacity() > 0);

        // Header record
        SprintCapacity header = new SprintCapacity();
        header.setProject(project);
        header.setSprint(sprint);
        header.setMemberEmpId(null);
        header.setMemberName("Team Overall");
        header.setWorkingDays(workingDays);
        header.setDailyHours(dailyHours);
        header.setStoryPointsCapacity(request.getStoryPointsCapacity());
        header.setIsManual(isManual);
        sprintCapacityRepository.save(header);

        // Member records if provided
        if (request.getMemberCapacities() != null && !request.getMemberCapacities().isEmpty()) {
            for (MemberCapacityDto m : request.getMemberCapacities()) {
                SprintCapacity sc = new SprintCapacity();
                sc.setProject(project);
                sc.setSprint(sprint);
                sc.setMemberEmpId(m.getEmpId());
                sc.setMemberName(m.getMemberName());
                sc.setWorkingDays(m.getWorkingDays() > 0 ? m.getWorkingDays() : workingDays);
                sc.setDailyHours(m.getDailyHours() > 0 ? m.getDailyHours() : dailyHours);
                sc.setAvailabilityPercentage(m.getAvailabilityPercentage() >= 0 ? m.getAvailabilityPercentage() : 100.0);
                double hrs = sc.getWorkingDays() * sc.getDailyHours() * (sc.getAvailabilityPercentage() / 100.0);
                sc.setAvailableHours(Math.round(hrs * 10.0) / 10.0);
                sc.setAvailableDays(dailyHours > 0 ? Math.round((hrs / dailyHours) * 10.0) / 10.0 : sc.getWorkingDays());
                sc.setStoryPointsCapacity(m.getStoryPointsCapacity());
                sc.setIsManual(isManual);
                sprintCapacityRepository.save(sc);
            }
        }

        return getTeamCapacity(projectId, sprintId);
    }

    public int calculateWorkingDays(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) return 10;
        int days = 0;
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                days++;
            }
            cur = cur.plusDays(1);
        }
        return Math.max(1, days);
    }
}
