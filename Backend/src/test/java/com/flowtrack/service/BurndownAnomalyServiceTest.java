package com.flowtrack.service;

import com.flowtrack.dto.BurndownAlertDto;
import com.flowtrack.dto.BurndownDailyPointDto;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.SprintScopeChange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BurndownAnomalyServiceTest {

    private BurndownAnomalyService anomalyService;
    private Sprint sprint;

    @BeforeEach
    void setUp() {
        anomalyService = new BurndownAnomalyService();
        sprint = new Sprint();
        sprint.setId(1L);
        sprint.setName("Sprint Alpha");
        sprint.setInitialCommitmentPoints(100);
        sprint.setStartDate(LocalDate.of(2026, 10, 1));
        sprint.setEndDate(LocalDate.of(2026, 10, 15));
    }

    @Test
    void testDetectLongFlatPeriods_TriggeredWhenThreeConsecutiveWorkingDaysNoProgress() {
        List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();
        // Monday Oct 5 to Thursday Oct 8: no work completed, remaining points remain unchanged
        LocalDate date = LocalDate.of(2026, 10, 5); // Monday
        for (int i = 0; i < 4; i++) {
            BurndownDailyPointDto pt = new BurndownDailyPointDto();
            pt.setDayIndex(i);
            pt.setDate(date.plusDays(i));
            pt.setActualRemaining(80.0);
            pt.setCompletedPoints(0.0);
            dailyPoints.add(pt);
        }

        List<BurndownAlertDto> alerts = anomalyService.detectAnomalies(sprint, 100, 100, dailyPoints, Collections.emptyList(), Collections.emptyList());

        assertTrue(alerts.stream().anyMatch(a -> a.getId().startsWith("FLAT_PERIOD")),
                "Expected FLAT_PERIOD alert when 3+ consecutive working days pass with 0 progress");
    }

    @Test
    void testDetectLargeUpwardSpikes_TriggeredWhenRemainingJumpsSignificantly() {
        List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();
        
        BurndownDailyPointDto day1 = new BurndownDailyPointDto();
        day1.setDayIndex(0);
        day1.setDate(LocalDate.of(2026, 10, 1));
        day1.setActualRemaining(80.0);
        dailyPoints.add(day1);

        BurndownDailyPointDto day2 = new BurndownDailyPointDto();
        day2.setDayIndex(1);
        day2.setDate(LocalDate.of(2026, 10, 2));
        day2.setActualRemaining(105.0); // Jump of 25 points (> 10% of 100)
        dailyPoints.add(day2);

        List<BurndownAlertDto> alerts = anomalyService.detectAnomalies(sprint, 100, 105, dailyPoints, Collections.emptyList(), Collections.emptyList());

        assertTrue(alerts.stream().anyMatch(a -> a.getId().startsWith("UPWARD_SPIKE")),
                "Expected UPWARD_SPIKE alert when remaining story points jump by >= 10%");
    }

    @Test
    void testDetectLastDayCompletionSpikes_TriggeredWhen40PercentCompletedOnFinalDay() {
        List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();

        BurndownDailyPointDto day1 = new BurndownDailyPointDto();
        day1.setDayIndex(0);
        day1.setDate(LocalDate.of(2026, 10, 1));
        day1.setActualRemaining(100.0);
        day1.setCompletedPoints(0.0);
        dailyPoints.add(day1);

        BurndownDailyPointDto finalDay = new BurndownDailyPointDto();
        finalDay.setDayIndex(1);
        finalDay.setDate(LocalDate.of(2026, 10, 15)); // Matching sprint end date
        finalDay.setActualRemaining(50.0);
        finalDay.setCompletedPoints(50.0); // 50 points completed on final day >= 40% of 100
        dailyPoints.add(finalDay);

        sprint.setStatus("COMPLETED");

        List<BurndownAlertDto> alerts = anomalyService.detectAnomalies(sprint, 100, 100, dailyPoints, Collections.emptyList(), Collections.emptyList());

        assertTrue(alerts.stream().anyMatch(a -> a.getId().startsWith("LAST_DAY_SPIKE")),
                "Expected LAST_DAY_SPIKE alert when 40%+ of initial commitment completed on final sprint day");
    }

    @Test
    void testDetectUnexpectedScopeIncreases_TriggeredWhenSingleScopeEventExceedsThreshold() {
        SprintScopeChange change = new SprintScopeChange();
        change.setId(101L);
        change.setSprintId(1L);
        change.setChangeType("TASK_ADDED");
        change.setPointsDiff(20); // 20 points >= 10% of 100
        change.setToPoints(20);
        change.setChangedAt(LocalDateTime.of(2026, 10, 4, 11, 0));
        change.setTaskKey("PROJ-99");
        change.setTaskTitle("Major New Subsystem");

        List<SprintScopeChange> changes = Collections.singletonList(change);

        BurndownDailyPointDto pt = new BurndownDailyPointDto();
        pt.setDayIndex(0);
        pt.setDate(LocalDate.of(2026, 10, 1));
        pt.setActualRemaining(120.0);

        List<BurndownAlertDto> alerts = anomalyService.detectAnomalies(sprint, 100, 120, Collections.singletonList(pt), changes, Collections.emptyList());

        assertTrue(alerts.stream().anyMatch(a -> a.getId().startsWith("SCOPE_INCREASE")),
                "Expected SCOPE_INCREASE alert when single event adds >= 10% of initial commitment");
        BurndownAlertDto alert = alerts.stream().filter(a -> a.getId().startsWith("SCOPE_INCREASE")).findFirst().get();
        assertEquals("PROJ-99", alert.getRelatedTask());
    }

    @Test
    void testAlertDeduplication_EnsuresUniqueAlertIds() {
        List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();
        LocalDate date = LocalDate.of(2026, 10, 5);
        for (int i = 0; i < 6; i++) {
            BurndownDailyPointDto pt = new BurndownDailyPointDto();
            pt.setDayIndex(i);
            pt.setDate(date.plusDays(i));
            pt.setActualRemaining(80.0);
            pt.setCompletedPoints(0.0);
            dailyPoints.add(pt);
        }

        List<BurndownAlertDto> alerts = anomalyService.detectAnomalies(sprint, 100, 100, dailyPoints, Collections.emptyList(), Collections.emptyList());

        // Deduplication should ensure no duplicate alert ids
        long distinctIds = alerts.stream().map(BurndownAlertDto::getId).distinct().count();
        assertEquals(alerts.size(), distinctIds);
    }
}
