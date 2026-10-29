package com.flowtrack.dto;

import java.util.ArrayList;
import java.util.List;

public class BurndownResponseDto {
    private BurndownSummaryDto summary;
    private List<BurndownDailyPointDto> dailyPoints = new ArrayList<>();
    private List<BurndownAlertDto> anomalies = new ArrayList<>();
    private List<SprintScopeChangeDto> scopeChanges = new ArrayList<>();

    public BurndownResponseDto() {}

    public BurndownResponseDto(BurndownSummaryDto summary,
                               List<BurndownDailyPointDto> dailyPoints,
                               List<BurndownAlertDto> anomalies,
                               List<SprintScopeChangeDto> scopeChanges) {
        this.summary = summary;
        this.dailyPoints = dailyPoints;
        this.anomalies = anomalies;
        this.scopeChanges = scopeChanges;
    }

    public BurndownSummaryDto getSummary() { return summary; }
    public void setSummary(BurndownSummaryDto summary) { this.summary = summary; }

    public List<BurndownDailyPointDto> getDailyPoints() { return dailyPoints; }
    public void setDailyPoints(List<BurndownDailyPointDto> dailyPoints) { this.dailyPoints = dailyPoints; }

    public List<BurndownAlertDto> getAnomalies() { return anomalies; }
    public void setAnomalies(List<BurndownAlertDto> anomalies) { this.anomalies = anomalies; }

    public List<SprintScopeChangeDto> getScopeChanges() { return scopeChanges; }
    public void setScopeChanges(List<SprintScopeChangeDto> scopeChanges) { this.scopeChanges = scopeChanges; }
}
