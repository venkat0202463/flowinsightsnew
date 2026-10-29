import type { Task, Sprint, User, Project } from '../types';

export type KPIStatus = 'On Track' | 'At Risk' | 'Critical';
export type TrendDirection = 'positive' | 'negative' | 'neutral';

export interface KPICardData {
  id: string;
  title: string;
  currentValue: string | number;
  previousValue: string | number;
  trendText: string;
  trendDirection: TrendDirection;
  status: KPIStatus;
  statusColor: string;
  category: string;
  description: string;
  detailsData: any;
}

export interface KPIOverviewResult {
  projectHealth: KPICardData;
  scheduleStatus: KPICardData;
  budgetStatus: KPICardData;
  completionRate: KPICardData;
  velocity: KPICardData;
  cycleTime: KPICardData;
  openBlockers: KPICardData;
  overdueWork: KPICardData;
  scopeChange: KPICardData;
  resourceUtilization: KPICardData;
  allCards: KPICardData[];
}

const isDone = (statusOrTask?: string | Task | any): boolean => {
  if (!statusOrTask) return false;
  if (typeof statusOrTask === 'object') {
    if (statusOrTask.completed === true || Boolean(statusOrTask.completedAt)) return true;
    const s = (statusOrTask.status || '').toUpperCase().replace(/_/g, ' ').trim();
    return s === 'DONE' || s === 'COMPLETED' || s === 'CLOSED' || s === 'RESOLVED' || s === 'FINISHED';
  }
  const s = String(statusOrTask).toUpperCase().replace(/_/g, ' ').trim();
  return s === 'DONE' || s === 'COMPLETED' || s === 'CLOSED' || s === 'RESOLVED' || s === 'FINISHED';
};

const isBlockedTask = (t: Task): boolean => {
  if (isDone(t)) return false;
  const tags = t.tags || [];
  const hasBlockerTag = tags.some(tag => {
    const l = tag.toLowerCase();
    return l.includes('block') || l === '_link';
  });
  const isHighPriorityBug = t.issueType?.toUpperCase() === 'BUG' && t.priority?.toUpperCase() === 'HIGH';
  return hasBlockerTag || isHighPriorityBug;
};

const computeCycleTimeDays = (t: Task): number => {
  if (!t.createdAt) return 0;
  const created = new Date(t.createdAt).getTime();
  const end = t.completedAt ? new Date(t.completedAt).getTime() : (t.updatedAt ? new Date(t.updatedAt).getTime() : 0);
  if (!end || end < created) return 0;
  const diffDays = (end - created) / (1000 * 60 * 60 * 24);
  // Real fractional days, minimum 0.1 for tasks completed on the same day
  return parseFloat(Math.max(0.1, diffDays).toFixed(1));
};

export const calculateKPIOverview = (
  tasks: Task[],
  sprints: Sprint[],
  selectedSprintId: number | 'all',
  users: User[],
  project: Project | null,
  sprintTasksMap: Record<number, Task[]>
): KPIOverviewResult => {
  // Determine current & previous sprint/period
  const nonPlannedSprints = sprints.filter(s => s.status?.toUpperCase() !== 'PLANNED');
  let currentSprint: Sprint | null = null;
  let previousSprint: Sprint | null = null;
  let prevPeriodTasks: Task[] = [];
  let periodLabel = 'previous sprint';
  let hasPreviousPeriod = false;

  if (selectedSprintId !== 'all') {
    const currIdx = nonPlannedSprints.findIndex(s => s.id === selectedSprintId);
    if (currIdx !== -1) {
      currentSprint = nonPlannedSprints[currIdx];
      if (currIdx > 0) {
        previousSprint = nonPlannedSprints[currIdx - 1];
        prevPeriodTasks = sprintTasksMap[previousSprint.id] || [];
        hasPreviousPeriod = prevPeriodTasks.length > 0;
      }
    }
  } else {
    // If all sprints or no sprint selected:
    const active = nonPlannedSprints.find(s => s.status?.toUpperCase() === 'ACTIVE');
    if (active) {
      currentSprint = active;
      const actIdx = nonPlannedSprints.findIndex(s => s.id === active.id);
      if (actIdx > 0) {
        previousSprint = nonPlannedSprints[actIdx - 1];
        prevPeriodTasks = sprintTasksMap[previousSprint.id] || [];
        hasPreviousPeriod = prevPeriodTasks.length > 0;
      }
    } else if (nonPlannedSprints.length >= 2) {
      currentSprint = nonPlannedSprints[nonPlannedSprints.length - 1];
      previousSprint = nonPlannedSprints[nonPlannedSprints.length - 2];
      prevPeriodTasks = sprintTasksMap[previousSprint.id] || [];
      hasPreviousPeriod = prevPeriodTasks.length > 0;
    } else {
      periodLabel = 'previous 14d';
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      prevPeriodTasks = tasks.filter(t => {
        if (!t.createdAt) return false;
        const d = new Date(t.createdAt);
        return d >= twentyEightDaysAgo && d < fourteenDaysAgo;
      });
      hasPreviousPeriod = prevPeriodTasks.length > 0;
    }
  }

  // --- 1. COMPLETION % ---
  // Formula: Completed Story Points / Total Story Points * 100
  const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const doneTasks = tasks.filter(t => isDone(t));
  const completedPoints = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const remainingPoints = totalPoints - completedPoints;
  const completionRateVal = totalPoints > 0 
    ? Math.round((completedPoints / totalPoints) * 100) 
    : (tasks.length > 0 && doneTasks.length === tasks.length ? 100 : (tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0));

  const prevTotalPoints = prevPeriodTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const prevDoneTasks = prevPeriodTasks.filter(t => isDone(t));
  const prevCompletedPoints = prevDoneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const prevCompletionRateVal = hasPreviousPeriod
    ? (prevTotalPoints > 0 ? Math.round((prevCompletedPoints / prevTotalPoints) * 100) : (prevPeriodTasks.length > 0 && prevDoneTasks.length === prevPeriodTasks.length ? 100 : 0))
    : completionRateVal;

  const completionDiff = completionRateVal - prevCompletionRateVal;
  const completionTrend: TrendDirection = completionDiff > 0 ? 'positive' : completionDiff < 0 ? 'negative' : 'neutral';
  const completionStatus: KPIStatus = completionRateVal >= 70 ? 'On Track' : completionRateVal >= 40 ? 'At Risk' : 'Critical';

  const completionCard: KPICardData = {
    id: 'completion',
    title: 'Completion %',
    currentValue: `${completionRateVal}%`,
    previousValue: hasPreviousPeriod ? `${prevCompletionRateVal}%` : '0%',
    trendText: hasPreviousPeriod 
      ? `${completionDiff >= 0 ? '↑ +' : '↓ '}${completionDiff}% vs ${periodLabel}`
      : `${completionRateVal}% current progress`,
    trendDirection: completionTrend,
    status: completionStatus,
    statusColor: completionStatus === 'On Track' ? '#36B37E' : completionStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Progress',
    description: 'Calculated as Completed Story Points / Total Story Points × 100.',
    detailsData: {
      totalPoints,
      completedPoints,
      remainingPoints,
      completedTasksCount: doneTasks.length,
      remainingTasksCount: tasks.length - doneTasks.length,
      doneTasks,
      openTasks: tasks.filter(t => !isDone(t))
    }
  };

  // --- 2. SCOPE CHANGE ---
  // Requirement: identifies tasks created within the last three days
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const scopeChangeTasks = tasks.filter(t => {
    if (!t.createdAt) return false;
    return new Date(t.createdAt) > threeDaysAgo;
  });
  const scopeChangeVal = scopeChangeTasks.length;

  const prevThreeDaysAgo = new Date();
  prevThreeDaysAgo.setDate(prevThreeDaysAgo.getDate() - 17);
  const prevThreeDaysEnd = new Date();
  prevThreeDaysEnd.setDate(prevThreeDaysEnd.getDate() - 14);
  const prevScopeTasks = prevPeriodTasks.filter(t => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d > prevThreeDaysAgo && d <= prevThreeDaysEnd;
  });
  const prevScopeVal = hasPreviousPeriod ? prevScopeTasks.length : 0;

  const scopeDiff = scopeChangeVal - prevScopeVal;
  const scopeTrend: TrendDirection = scopeDiff <= 0 ? 'positive' : 'negative'; // less scope creep is positive
  const scopeStatus: KPIStatus = scopeChangeVal <= 2 ? 'On Track' : scopeChangeVal <= 5 ? 'At Risk' : 'Critical';

  const scopeChangeCard: KPICardData = {
    id: 'scope-change',
    title: 'Scope Change',
    currentValue: `+${scopeChangeVal} ${scopeChangeVal === 1 ? 'Task' : 'Tasks'}`,
    previousValue: hasPreviousPeriod ? `+${prevScopeVal} Tasks` : '+0 Tasks',
    trendText: hasPreviousPeriod 
      ? `${scopeDiff > 0 ? '↑ +' : scopeDiff < 0 ? '↓ ' : '→ '}${Math.abs(scopeDiff)} tasks vs ${periodLabel}`
      : `+${scopeChangeVal} new items added`,
    trendDirection: scopeTrend,
    status: scopeStatus,
    statusColor: scopeStatus === 'On Track' ? '#36B37E' : scopeStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Scope',
    description: 'Tracks newly added work items created within the last three days.',
    detailsData: {
      scopeChangeTasks,
      totalNewPoints: scopeChangeTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
    }
  };

  // --- 3. OVERDUE WORK ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isAllComplete = completionRateVal === 100 || (totalPoints > 0 && remainingPoints === 0) || (tasks.length > 0 && tasks.every(t => isDone(t)));
  const overdueTasks = isAllComplete
    ? []
    : tasks.filter(t => {
        if (!t.dueDate || isDone(t)) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
      });
  const overdueVal = overdueTasks.length;
  const isPrevAllComplete = prevCompletionRateVal === 100 || (prevTotalPoints > 0 && prevCompletedPoints === prevTotalPoints);
  const prevOverdueTasks = (hasPreviousPeriod && !isPrevAllComplete)
    ? prevPeriodTasks.filter(t => {
        if (!t.dueDate || isDone(t)) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
      })
    : [];
  const prevOverdueVal = prevOverdueTasks.length;

  const overdueDiff = overdueVal - prevOverdueVal;
  const overdueTrend: TrendDirection = overdueDiff <= 0 ? 'positive' : 'negative';
  const overdueStatus: KPIStatus = overdueVal === 0 ? 'On Track' : overdueVal <= 2 ? 'At Risk' : 'Critical';

  const overdueWorkCard: KPICardData = {
    id: 'overdue-work',
    title: 'Overdue Work',
    currentValue: `${overdueVal} ${overdueVal === 1 ? 'Task' : 'Tasks'}`,
    previousValue: hasPreviousPeriod ? `${prevOverdueVal} Tasks` : '0 Tasks',
    trendText: hasPreviousPeriod 
      ? `${overdueDiff < 0 ? '↓ ' : overdueDiff > 0 ? '↑ +' : '→ '}${Math.abs(overdueDiff)} vs ${periodLabel}`
      : `${overdueVal} overdue items`,
    trendDirection: overdueTrend,
    status: overdueStatus,
    statusColor: overdueStatus === 'On Track' ? '#36B37E' : overdueStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Schedule',
    description: 'Active tasks that have passed their assigned due date.',
    detailsData: {
      overdueTasks,
      overduePoints: overdueTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
    }
  };

  // --- 4. OPEN BLOCKERS ---
  const blockerTasks = tasks.filter(isBlockedTask);
  const blockersVal = blockerTasks.length;
  const prevBlockerTasks = hasPreviousPeriod ? prevPeriodTasks.filter(isBlockedTask) : [];
  const prevBlockersVal = prevBlockerTasks.length;

  const blockersDiff = blockersVal - prevBlockersVal;
  const blockersTrend: TrendDirection = blockersDiff <= 0 ? 'positive' : 'negative';
  const blockersStatus: KPIStatus = blockersVal === 0 ? 'On Track' : blockersVal <= 2 ? 'At Risk' : 'Critical';

  const openBlockersCard: KPICardData = {
    id: 'open-blockers',
    title: 'Open Blockers',
    currentValue: `${blockersVal} ${blockersVal === 1 ? 'Blocker' : 'Blockers'}`,
    previousValue: hasPreviousPeriod ? `${prevBlockersVal} Blockers` : '0 Blockers',
    trendText: hasPreviousPeriod 
      ? `${blockersDiff < 0 ? '↓ ' : blockersDiff > 0 ? '↑ +' : '→ '}${Math.abs(blockersDiff)} vs ${periodLabel}`
      : `${blockersVal} active blockers`,
    trendDirection: blockersTrend,
    status: blockersStatus,
    statusColor: blockersStatus === 'On Track' ? '#36B37E' : blockersStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Quality',
    description: 'Active tasks flagged as blocked, with blocker dependencies or high-priority defects.',
    detailsData: {
      blockerTasks,
      blockerPoints: blockerTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
    }
  };

  // --- 5. VELOCITY ---
  // Completed story points delivered in current scope vs previous
  const velocityVal = completedPoints;
  const completedSprints = sprints.filter(s => s.status?.toUpperCase() === 'COMPLETED');
  const sprintDonePoints = completedSprints.map(s => {
    const sTasks = sprintTasksMap[s.id] || [];
    return sTasks.filter(t => isDone(t)).reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  });
  const avgVelocity = sprintDonePoints.length > 0
    ? Math.round(sprintDonePoints.reduce((a, b) => a + b, 0) / sprintDonePoints.length)
    : (hasPreviousPeriod ? prevCompletedPoints : velocityVal);

  const prevVelocityVal = hasPreviousPeriod ? prevCompletedPoints : velocityVal;
  const velocityDiff = velocityVal - prevVelocityVal;
  const velocityTrend: TrendDirection = velocityDiff >= 0 ? 'positive' : 'negative';
  const velocityStatus: KPIStatus = avgVelocity > 0 
    ? (velocityVal >= Math.round(avgVelocity * 0.85) ? 'On Track' : velocityVal >= Math.round(avgVelocity * 0.6) ? 'At Risk' : 'Critical')
    : 'On Track';

  const velocityCard: KPICardData = {
    id: 'velocity',
    title: 'Velocity',
    currentValue: `${velocityVal} SP`,
    previousValue: hasPreviousPeriod ? `${prevVelocityVal} SP` : '0 SP',
    trendText: hasPreviousPeriod 
      ? `${velocityDiff >= 0 ? '↑ +' : '↓ '}${velocityDiff} SP vs ${periodLabel}`
      : `${velocityVal} SP completed`,
    trendDirection: velocityTrend,
    status: velocityStatus,
    statusColor: velocityStatus === 'On Track' ? '#36B37E' : velocityStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Throughput',
    description: 'Total completed Story Points delivered compared with historical velocity.',
    detailsData: {
      currentVelocity: velocityVal,
      prevVelocity: prevVelocityVal,
      avgVelocity,
      sprintHistory: completedSprints.map((s, idx) => ({
        sprintName: s.name,
        donePoints: sprintDonePoints[idx] || 0
      }))
    }
  };

  // --- 6. CYCLE TIME ---
  const currentCompletedTasks = tasks.filter(isDone);
  const currentCycleTimes = currentCompletedTasks.map(computeCycleTimeDays).filter(d => d > 0);
  const avgCycleTimeVal = currentCycleTimes.length > 0
    ? parseFloat((currentCycleTimes.reduce((a, b) => a + b, 0) / currentCycleTimes.length).toFixed(1))
    : 0;

  // Percentiles calculation for completed tasks
  const sortedCycleTimes = [...currentCycleTimes].sort((a, b) => a - b);
  const getPercentile = (p: number): number => {
    if (sortedCycleTimes.length === 0) return 0;
    if (sortedCycleTimes.length === 1) return sortedCycleTimes[0];
    const rank = p * (sortedCycleTimes.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    return parseFloat((sortedCycleTimes[lower] * (1 - weight) + sortedCycleTimes[upper] * weight).toFixed(1));
  };
  const medianCycleVal = getPercentile(0.50);
  const p85CycleVal = getPercentile(0.85);
  const p95CycleVal = getPercentile(0.95);

  const prevCompletedTasks = prevPeriodTasks.filter(isDone);
  const prevCycleTimes = prevCompletedTasks.map(computeCycleTimeDays).filter(d => d > 0);
  const prevAvgCycleTimeVal = (hasPreviousPeriod && prevCycleTimes.length > 0)
    ? parseFloat((prevCycleTimes.reduce((a, b) => a + b, 0) / prevCycleTimes.length).toFixed(1))
    : avgCycleTimeVal;

  const cycleDiff = parseFloat((avgCycleTimeVal - prevAvgCycleTimeVal).toFixed(1));
  const cycleTrend: TrendDirection = cycleDiff <= 0 ? 'positive' : 'negative'; // lower cycle time is faster/positive
  const cycleStatus: KPIStatus = avgCycleTimeVal === 0 ? 'On Track' : avgCycleTimeVal <= 5.0 ? 'On Track' : avgCycleTimeVal <= 10.0 ? 'At Risk' : 'Critical';

  const cycleTimeCard: KPICardData = {
    id: 'cycle-time',
    title: 'Cycle Time',
    currentValue: `${avgCycleTimeVal} Days`,
    previousValue: hasPreviousPeriod ? `${prevAvgCycleTimeVal} Days` : '0 Days',
    trendText: hasPreviousPeriod 
      ? `${cycleDiff <= 0 ? '↓ ' : '↑ +'}${Math.abs(cycleDiff)}d vs ${periodLabel}`
      : `${avgCycleTimeVal}d avg completion time`,
    trendDirection: cycleTrend,
    status: cycleStatus,
    statusColor: cycleStatus === 'On Track' ? '#36B37E' : cycleStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Speed',
    description: 'Average calendar days required from task initiation to completion.',
    detailsData: {
      avgDays: avgCycleTimeVal,
      medianDays: medianCycleVal,
      p85Days: p85CycleVal,
      p95Days: p95CycleVal,
      completedCount: currentCompletedTasks.length,
      hasPreviousPeriod,
      taskCycleList: currentCompletedTasks.map(t => ({
        task: t,
        days: computeCycleTimeDays(t)
      })).sort((a, b) => b.days - a.days)
    }
  };

  // --- 7. SCHEDULE STATUS ---
  let scheduleVarianceDays = 0;
  let scheduleStatus: KPIStatus = 'On Track';
  let scheduleDisplay = 'On Schedule';
  let schedulePrevDisplay = 'On Schedule';

  if (currentSprint?.endDate) {
    const end = new Date(currentSprint.endDate);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 && remainingPoints > 0) {
      scheduleVarianceDays = Math.abs(daysLeft);
      scheduleDisplay = `${scheduleVarianceDays}d Overdue`;
      scheduleStatus = 'Critical';
    } else if (daysLeft >= 0) {
      if (completionRateVal >= 75 || daysLeft >= 5) {
        scheduleDisplay = daysLeft > 0 ? `${daysLeft}d Ahead` : 'On Schedule';
        scheduleStatus = 'On Track';
      } else if (completionRateVal >= 40 || daysLeft >= 2) {
        scheduleDisplay = 'Tight Window';
        scheduleStatus = 'At Risk';
      } else {
        scheduleDisplay = 'Behind Schedule';
        scheduleStatus = 'Critical';
      }
    }
  } else if (project?.deadline) {
    const dLine = new Date(project.deadline);
    dLine.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((dLine.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 && remainingPoints > 0) {
      scheduleDisplay = `${Math.abs(daysLeft)}d Behind`;
      scheduleStatus = 'Critical';
    } else {
      scheduleDisplay = daysLeft >= 0 ? `${daysLeft}d Remaining` : 'On Schedule';
      scheduleStatus = daysLeft >= 7 ? 'On Track' : daysLeft >= 0 ? 'At Risk' : 'Critical';
    }
  } else {
    scheduleDisplay = overdueVal === 0 ? 'On Schedule' : `${overdueVal} Delayed`;
    scheduleStatus = overdueVal === 0 ? 'On Track' : overdueVal <= 2 ? 'At Risk' : 'Critical';
  }

  const scheduleTrend: TrendDirection = scheduleStatus === 'On Track' ? 'positive' : scheduleStatus === 'At Risk' ? 'neutral' : 'negative';

  const scheduleStatusCard: KPICardData = {
    id: 'schedule-status',
    title: 'Schedule Status',
    currentValue: scheduleDisplay,
    previousValue: hasPreviousPeriod ? schedulePrevDisplay : 'Baseline',
    trendText: scheduleStatus === 'On Track' ? `↑ On pace vs ${periodLabel}` : `↓ Pace risk vs ${periodLabel}`,
    trendDirection: scheduleTrend,
    status: scheduleStatus,
    statusColor: scheduleStatus === 'On Track' ? '#36B37E' : scheduleStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Schedule',
    description: 'Sprint and milestone timeline alignment based on burn rate and remaining points.',
    detailsData: {
      sprint: currentSprint,
      deadline: project?.deadline,
      overdueTasksCount: overdueVal,
      remainingPoints,
      hasPreviousPeriod
    }
  };

  // --- 8. BUDGET STATUS ---
  // Adapts according to the project's active financial framework:
  // Model A (STORY_POINT_WEIGHTED): Driven by Story Points & Cost per SP
  // Model B (CATEGORY_BASED): Driven by Domain Category % & Incurred Cost
  // Model C (TIME_BASED): Driven by Logged Hours vs Estimated Effort & Hourly Rate
  const totalEstimatedSecs = tasks.reduce((sum, t) => sum + (t.originalEstimateSeconds || 0), 0);
  const totalSpentSecs = tasks.reduce((sum, t) => sum + (t.timeSpentSeconds || 0), 0);
  const totalEstimatedHrs = Math.round(totalEstimatedSecs / 3600);
  const totalSpentHrs = Math.round(totalSpentSecs / 3600);

  const prevSpentSecs = hasPreviousPeriod ? prevPeriodTasks.reduce((sum, t) => sum + (t.timeSpentSeconds || 0), 0) : 0;
  const prevSpentHrs = Math.round(prevSpentSecs / 3600);

  const totalAllocatedBudget = tasks.reduce((sum, t) => sum + (t.allocatedBudget || 0), 0) || (project?.totalBudget || 0);
  const totalActualCost = tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);
  const prevAllocatedBudget = hasPreviousPeriod ? (prevPeriodTasks.reduce((sum, t) => sum + (t.allocatedBudget || 0), 0) || 0) : 0;
  const prevActualCost = hasPreviousPeriod ? (prevPeriodTasks.reduce((sum, t) => sum + (t.actualCost || 0), 0) || 0) : 0;

  const budgetAllocationMethod = project?.budgetAllocationMethod || 'STORY_POINT_WEIGHTED';
  const isModelA = budgetAllocationMethod === 'STORY_POINT_WEIGHTED';
  const isModelB = budgetAllocationMethod === 'CATEGORY_BASED';

  const formatCurrencyK = (num: number) => {
    if (num >= 1000000) return `₹${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
    return `₹${num}`;
  };

  let budgetUtilizationPct = 0;
  let budgetDisplay = '';
  let budgetPrevDisplay = '';
  let budgetTrendText = '';
  let budgetStatus: KPIStatus = 'On Track';

  if (isModelA) {
    // Model A: Story Point Weighted Financial Accounting
    budgetUtilizationPct = totalAllocatedBudget > 0 ? Math.round((totalActualCost / totalAllocatedBudget) * 100) : (completionRateVal === 100 ? 100 : 0);
    budgetDisplay = `${budgetUtilizationPct}% (${formatCurrencyK(totalActualCost)}/${formatCurrencyK(totalAllocatedBudget)})`;
    budgetPrevDisplay = hasPreviousPeriod ? `${formatCurrencyK(prevActualCost)} spent` : '₹0 spent';
    const costDiff = totalActualCost - prevActualCost;
    budgetTrendText = hasPreviousPeriod 
      ? `${costDiff >= 0 ? '↑ +' : '↓ '}${formatCurrencyK(Math.abs(costDiff))} vs ${periodLabel}`
      : `${formatCurrencyK(totalActualCost)} actual spend`;
    budgetStatus = budgetUtilizationPct <= 100 ? 'On Track' : budgetUtilizationPct <= 115 ? 'At Risk' : 'Critical';
  } else if (isModelB) {
    // Model B: Category Based Allocation
    budgetUtilizationPct = totalAllocatedBudget > 0 ? Math.round((totalActualCost / totalAllocatedBudget) * 100) : 0;
    budgetDisplay = `${budgetUtilizationPct}% (${formatCurrencyK(totalActualCost)}/${formatCurrencyK(totalAllocatedBudget)})`;
    budgetPrevDisplay = hasPreviousPeriod ? `${formatCurrencyK(prevActualCost)} spent` : '₹0 spent';
    const costDiff = totalActualCost - prevActualCost;
    budgetTrendText = hasPreviousPeriod 
      ? `${costDiff >= 0 ? '↑ +' : '↓ '}${formatCurrencyK(Math.abs(costDiff))} vs ${periodLabel}`
      : `${formatCurrencyK(totalActualCost)} category spend`;
    budgetStatus = budgetUtilizationPct <= 100 ? 'On Track' : budgetUtilizationPct <= 115 ? 'At Risk' : 'Critical';
  } else {
    // Model C: Time Based Effort & Hourly Billing
    if (totalEstimatedHrs > 0) {
      budgetUtilizationPct = Math.round((totalSpentHrs / totalEstimatedHrs) * 100);
      budgetDisplay = `${budgetUtilizationPct}% (${totalSpentHrs}h/${totalEstimatedHrs}h)`;
      budgetStatus = budgetUtilizationPct <= 100 ? 'On Track' : budgetUtilizationPct <= 120 ? 'At Risk' : 'Critical';
    } else {
      budgetDisplay = totalSpentHrs > 0 ? `${totalSpentHrs}h Logged` : '0h Logged';
      budgetStatus = 'On Track';
    }
    const budgetSpentDiff = totalSpentHrs - prevSpentHrs;
    budgetPrevDisplay = hasPreviousPeriod ? `${prevSpentHrs}h logged` : '0h logged';
    budgetTrendText = hasPreviousPeriod 
      ? `${budgetSpentDiff >= 0 ? '↑ +' : '↓ '}${budgetSpentDiff}h spent vs ${periodLabel}`
      : `${totalSpentHrs}h total time spent`;
  }

  const budgetTrend: TrendDirection = budgetStatus === 'On Track' ? 'positive' : 'negative';

  const budgetStatusCard: KPICardData = {
    id: 'budget-status',
    title: 'Budget Status',
    currentValue: budgetDisplay,
    previousValue: budgetPrevDisplay,
    trendText: budgetTrendText,
    trendDirection: budgetTrend,
    status: budgetStatus,
    statusColor: budgetStatus === 'On Track' ? '#36B37E' : budgetStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: isModelA ? 'Financials' : 'Cost & Time',
    description: isModelA 
      ? 'Agile story point budget burn tracking cost per story point delivered.' 
      : isModelB
        ? 'Departmental and functional domain category budget utilization.'
        : 'Comparison of logged effort against original estimates and team capacity.',
    detailsData: {
      totalEstimatedHrs,
      totalSpentHrs,
      budgetUtilizationPct,
      totalAllocatedBudget,
      totalActualCost,
      budgetAllocationMethod,
      costPerStoryPoint: project?.costPerStoryPoint || 0,
      defaultHourlyRate: project?.defaultHourlyRate || 0,
      hasPreviousPeriod,
      completedPoints: completedPoints > 0 
        ? completedPoints 
        : (totalActualCost > 0 && (project?.costPerStoryPoint || 0) > 0 ? Math.round(totalActualCost / project!.costPerStoryPoint!) : completedPoints),
      totalPoints: totalPoints > 0 
        ? totalPoints 
        : (totalAllocatedBudget > 0 && (project?.costPerStoryPoint || 0) > 0 ? Math.round(totalAllocatedBudget / project!.costPerStoryPoint!) : totalPoints),
      tasksWithTime: tasks.filter(t => 
        (t.originalEstimateSeconds || 0) > 0 || 
        (t.timeSpentSeconds || 0) > 0 || 
        (t.allocatedBudget || 0) > 0 || 
        (t.actualCost || 0) > 0 ||
        (t.storyPoints || 0) > 0
      )
    }
  };

  // --- 9. RESOURCE UTILIZATION ---
  let projectMembersList = users;
  if (project && (project.createdBy || (project.teamMembers && project.teamMembers.length > 0))) {
    const pMap = new Map<string, User>();
    if (project.createdBy) {
      pMap.set(String(project.createdBy.id || project.createdBy.empId || project.createdBy.name), project.createdBy);
    }
    (project.teamMembers || []).forEach(m => {
      pMap.set(String(m.id || m.empId || m.name), m);
    });
    tasks.forEach(t => {
      if (t.assignee) {
        pMap.set(String(t.assignee.id || t.assignee.empId || t.assignee.name), t.assignee);
      }
    });
    projectMembersList = Array.from(pMap.values());
  }

  const memberTasksMap: Record<string, Task[]> = {};
  projectMembersList.forEach(u => {
    const key = String(u.id || u.empId || u.name);
    memberTasksMap[key] = [];
  });
  tasks.forEach(t => {
    const key = String(t.assignee?.id || t.assigneeId || t.assignee?.name || '');
    if (key && memberTasksMap[key]) {
      memberTasksMap[key].push(t);
    } else {
      for (const [mKey, mList] of Object.entries(memberTasksMap)) {
        const u = projectMembersList.find(pm => String(pm.id || pm.empId || pm.name) === mKey);
        if (u && (u.empId === t.assigneeId || (t.assignee && (u.name === t.assignee.name || u.email === t.assignee.email)))) {
          mList.push(t);
          break;
        }
      }
    }
  });

  const allocatedMembersCount = Object.values(memberTasksMap).filter(mTasks => mTasks.length > 0).length;
  const totalMembersCount = Math.max(1, projectMembersList.length);
  const resourceUtilPct = Math.round((allocatedMembersCount / totalMembersCount) * 100);

  const prevMemberTasksMap: Record<number, Task[]> = {};
  if (hasPreviousPeriod) {
    prevPeriodTasks.forEach(t => {
      const uid = t.assignee?.id || t.assigneeId;
      if (uid) {
        if (!prevMemberTasksMap[uid]) prevMemberTasksMap[uid] = [];
        prevMemberTasksMap[uid].push(t);
      }
    });
  }
  const prevAllocatedCount = Object.values(prevMemberTasksMap).filter(mTasks => mTasks.length > 0).length;
  const prevResourceUtilPct = hasPreviousPeriod ? Math.round((prevAllocatedCount / totalMembersCount) * 100) : 0;

  const utilDiff = resourceUtilPct - prevResourceUtilPct;
  const utilTrend: TrendDirection = utilDiff >= 0 ? 'positive' : 'negative';
  const utilStatus: KPIStatus = resourceUtilPct >= 50 && resourceUtilPct <= 100 ? 'On Track' : (resourceUtilPct > 0 ? 'At Risk' : 'Critical');

  const unassignedTasks = tasks.filter(t => !t.assignee && !t.assigneeId);

  const resourceUtilizationCard: KPICardData = {
    id: 'resource-utilization',
    title: 'Resource Utilization',
    currentValue: `${resourceUtilPct}% Active`,
    previousValue: hasPreviousPeriod ? `${prevResourceUtilPct}% Active` : '0% Active',
    trendText: hasPreviousPeriod 
      ? `${utilDiff >= 0 ? '↑ +' : '↓ '}${utilDiff}% vs ${periodLabel}`
      : `${allocatedMembersCount} of ${totalMembersCount} team members allocated`,
    trendDirection: utilTrend,
    status: utilStatus,
    statusColor: utilStatus === 'On Track' ? '#36B37E' : utilStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Workload',
    description: 'Percentage of active team members allocated with task responsibilities.',
    detailsData: {
      activeMembersCount: allocatedMembersCount,
      totalMembersCount,
      unassignedTasksCount: unassignedTasks.length,
      unassignedTasks,
      hasPreviousPeriod,
      memberBreakdown: users.map(u => ({
        user: u,
        assignedTasks: memberTasksMap[u.id] || [],
        assignedPoints: (memberTasksMap[u.id] || []).reduce((sum, t) => sum + (t.storyPoints || 0), 0),
        activePoints: (memberTasksMap[u.id] || []).filter(t => !isDone(t)).reduce((sum, t) => sum + (t.storyPoints || 0), 0)
      }))
    }
  };

  // --- 10. PROJECT HEALTH ---
  // Composite calculation taking into account completion, blockers, overdue, schedule, and budget
  let healthScore = 100;
  if (overdueVal > 0) healthScore -= Math.min(30, overdueVal * 10);
  if (blockersVal > 0) healthScore -= Math.min(25, blockersVal * 12);
  if (scheduleStatus === 'Critical') healthScore -= 20;
  else if (scheduleStatus === 'At Risk') healthScore -= 10;
  if (budgetStatus === 'Critical') healthScore -= 15;
  else if (budgetStatus === 'At Risk') healthScore -= 5;
  if (completionRateVal < 30 && tasks.length > 5) healthScore -= 15;
  if (scopeChangeVal > 5) healthScore -= 10;
  healthScore = Math.max(10, Math.min(100, healthScore));

  let prevHealthScore = 100;
  if (hasPreviousPeriod) {
    if (prevOverdueVal > 0) prevHealthScore -= Math.min(30, prevOverdueVal * 10);
    if (prevBlockersVal > 0) prevHealthScore -= Math.min(25, prevBlockersVal * 12);
    if (prevCompletionRateVal < 30 && prevPeriodTasks.length > 5) prevHealthScore -= 15;
    prevHealthScore = Math.max(10, Math.min(100, prevHealthScore));
  } else {
    prevHealthScore = 0;
  }

  const healthDiff = healthScore - prevHealthScore;
  const healthTrend: TrendDirection = healthDiff >= 0 ? 'positive' : 'negative';
  const healthStatus: KPIStatus = healthScore >= 80 ? 'On Track' : healthScore >= 60 ? 'At Risk' : 'Critical';

  const projectHealthCard: KPICardData = {
    id: 'project-health',
    title: 'Project Health',
    currentValue: `${healthScore}%`,
    previousValue: hasPreviousPeriod ? `${prevHealthScore}%` : 'N/A (Baseline)',
    trendText: hasPreviousPeriod 
      ? `${healthDiff >= 0 ? '↑ +' : '↓ '}${healthDiff}% vs ${periodLabel}`
      : 'Initial baseline score',
    trendDirection: hasPreviousPeriod ? healthTrend : 'neutral',
    status: healthStatus,
    statusColor: healthStatus === 'On Track' ? '#36B37E' : healthStatus === 'At Risk' ? '#FFAB00' : '#FF5630',
    category: 'Governance',
    description: 'Overall composite score factoring on-time delivery, blockers, overdue items, and velocity.',
    detailsData: {
      healthScore,
      prevHealthScore: hasPreviousPeriod ? prevHealthScore : null,
      hasPreviousPeriod,
      factors: [
        { name: 'Completion Progress', score: `${completionRateVal}% completed`, status: completionStatus },
        { name: 'Schedule Adherence', score: scheduleDisplay, status: scheduleStatus },
        { name: 'Blocker Impact', score: `${blockersVal} active blockers`, status: blockersStatus },
        { name: 'Overdue Impact', score: `${overdueVal} overdue tasks`, status: overdueStatus },
        { name: 'Scope Stability', score: `+${scopeChangeVal} recent items`, status: scopeStatus }
      ]
    }
  };

  const allCards: KPICardData[] = [
    projectHealthCard,
    scheduleStatusCard,
    budgetStatusCard,
    completionCard,
    velocityCard,
    cycleTimeCard,
    openBlockersCard,
    overdueWorkCard,
    scopeChangeCard,
    resourceUtilizationCard
  ];

  return {
    projectHealth: projectHealthCard,
    scheduleStatus: scheduleStatusCard,
    budgetStatus: budgetStatusCard,
    completionRate: completionCard,
    velocity: velocityCard,
    cycleTime: cycleTimeCard,
    openBlockers: openBlockersCard,
    overdueWork: overdueWorkCard,
    scopeChange: scopeChangeCard,
    resourceUtilization: resourceUtilizationCard,
    allCards
  };
};
