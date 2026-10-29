import type { Task } from '../types';

export interface TaskHistoryItem {
  id: number;
  taskId: number;
  changeType: string;
  fromValue?: string;
  toValue?: string;
  performedBy?: string;
  comment?: string;
  createdAt: string;
}

export type CycleStage = 'To Do' | 'In Progress' | 'Review' | 'QA' | 'Blocked' | 'Done';

export interface StageBreakdown {
  todoDays: number;
  inProgressDays: number;
  reviewDays: number;
  qaDays: number;
  blockedDays: number;
  doneDays: number;
  totalCycleDays: number;
  activeDays: number;
  waitingDays: number;
  flowEfficiency: number; // 0 - 100 percentage
  hasHistory: boolean;
}

export interface CycleTimePercentiles {
  average: number;
  median: number;
  p85: number;
  p95: number;
  count: number;
}

export interface AgingTask {
  task: Task;
  daysOpen: number;
  expectedDays: number;
  currentStage: CycleStage;
  timeInCurrentStageDays: number;
  isBlocked: boolean;
  requiresInvestigation: boolean;
  warningLevel: 'CRITICAL' | 'WARNING' | 'NORMAL';
  bottleneckHint: string;
}

/**
 * Normalizes any task status string or column name into one of the 6 canonical stages.
 */
export function normalizeStatusToStage(statusStr?: string, isBlockedFlag = false): CycleStage {
  if (isBlockedFlag) return 'Blocked';
  if (!statusStr) return 'To Do';

  const s = statusStr.trim().toUpperCase().replace(/[-_]/g, ' ');

  if (s.includes('BLOCK') || s.includes('HOLD') || s.includes('STUCK') || s.includes('IMPED')) {
    return 'Blocked';
  }
  if (s.includes('DONE') || s.includes('COMPLET') || s.includes('RESOLV') || s.includes('CLOSE') || s.includes('FINISH')) {
    return 'Done';
  }
  if (s.includes('QA') || s.includes('TEST') || s.includes('UAT') || s.includes('VERIF') || s.includes('VALIDAT')) {
    return 'QA';
  }
  if (s.includes('REVIEW') || s.includes('PR') || s.includes('AUDIT') || s.includes('INSPECT')) {
    return 'Review';
  }
  if (s.includes('PROGRESS') || s.includes('DEV') || s.includes('WIP') || s.includes('ACTIVE') || s.includes('DOING') || s.includes('STARTED')) {
    return 'In Progress';
  }
  return 'To Do';
}

/**
 * Checks if a task is marked as completed.
 */
export function isTaskCompleted(t: Task): boolean {
  const s = (t.status || '').toUpperCase();
  return s === 'DONE' || s === 'COMPLETED' || s === 'RESOLVED' || s === 'CLOSED' || s === 'FINISHED' || !!t.completedAt;
}

/**
 * Checks if a task has blocked tags or conditions.
 */
export function isTaskBlocked(t: Task): boolean {
  if (isTaskCompleted(t)) return false;
  const s = (t.status || '').toUpperCase();
  if (s.includes('BLOCK') || s.includes('HOLD')) return true;

  const tags = t.tags || [];
  const hasBlockTag = tags.some(tag => {
    const l = tag.toLowerCase();
    return l.includes('block') || l === '_link';
  });
  const isHighPriorityBug = t.issueType?.toUpperCase() === 'BUG' && t.priority?.toUpperCase() === 'HIGH';
  return hasBlockTag || isHighPriorityBug;
}

/**
 * Calculates stage durations from status history where available.
 * If status history is missing, falls back to computing total cycle time
 * and reasonable stage distributions based on status.
 */
export function computeTaskStageBreakdown(task: Task, histories?: TaskHistoryItem[]): StageBreakdown {
  const createdMs = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
  const completedMs = task.completedAt
    ? new Date(task.completedAt).getTime()
    : task.updatedAt && isTaskCompleted(task)
      ? new Date(task.updatedAt).getTime()
      : Date.now();

  const totalCycleDays = Math.max(0.1, parseFloat(((completedMs - createdMs) / (1000 * 60 * 60 * 24)).toFixed(1)));

  // Filter history to status transitions
  const statusEvents = (histories || [])
    .filter(h => {
      const type = (h.changeType || '').toUpperCase();
      return type === 'STATUS_CHANGE' || type === 'CREATED' || (h.fromValue && h.toValue && h.fromValue !== h.toValue);
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (statusEvents.length > 0) {
    let stageMs: Record<CycleStage, number> = {
      'To Do': 0,
      'In Progress': 0,
      'Review': 0,
      'QA': 0,
      'Blocked': 0,
      'Done': 0
    };

    let prevTime = createdMs;
    // Initial stage
    let currentStage = normalizeStatusToStage(
      statusEvents[0].fromValue || (statusEvents[0].changeType === 'CREATED' ? statusEvents[0].toValue : 'To Do')
    );

    for (const ev of statusEvents) {
      const evTime = new Date(ev.createdAt).getTime();
      if (evTime > prevTime) {
        const duration = Math.max(0, evTime - prevTime);
        stageMs[currentStage] += duration;
      }
      prevTime = Math.max(prevTime, evTime);
      if (ev.toValue) {
        currentStage = normalizeStatusToStage(ev.toValue);
      }
    }

    // Time from last event to completedMs (or now)
    const finalEnd = isTaskCompleted(task) ? completedMs : Math.max(Date.now(), prevTime);
    if (finalEnd > prevTime) {
      stageMs[currentStage] += Math.max(0, finalEnd - prevTime);
    }

    const msToDays = (ms: number) => parseFloat((ms / (1000 * 60 * 60 * 24)).toFixed(1));

    const todoDays = msToDays(stageMs['To Do']);
    const inProgressDays = msToDays(stageMs['In Progress']);
    const reviewDays = msToDays(stageMs['Review']);
    const qaDays = msToDays(stageMs['QA']);
    const blockedDays = msToDays(stageMs['Blocked']);
    const doneDays = msToDays(stageMs['Done']);

    // Active = In Progress + Review + QA
    const activeDays = parseFloat((inProgressDays + reviewDays + qaDays).toFixed(1));
    // Waiting = To Do + Blocked
    const waitingDays = parseFloat((todoDays + blockedDays).toFixed(1));

    const activeWaitingTotal = activeDays + waitingDays;
    const flowEfficiency = activeWaitingTotal > 0
      ? Math.min(100, Math.round((activeDays / activeWaitingTotal) * 100))
      : 100;

    return {
      todoDays,
      inProgressDays,
      reviewDays,
      qaDays,
      blockedDays,
      doneDays,
      totalCycleDays,
      activeDays,
      waitingDays,
      flowEfficiency,
      hasHistory: true
    };
  }

  // Fallback when no status history is available:
  // Estimate realistic active/waiting breakdown from total cycle time
  const isDone = isTaskCompleted(task);
  const isBlocked = isTaskBlocked(task);

  let todoRatio = 0.25;
  let inProgressRatio = 0.45;
  let reviewRatio = 0.15;
  let qaRatio = 0.15;
  let blockedRatio = 0;

  if (isBlocked) {
    blockedRatio = 0.35;
    inProgressRatio = 0.35;
    todoRatio = 0.15;
    reviewRatio = 0.08;
    qaRatio = 0.07;
  }

  const todoDays = parseFloat((totalCycleDays * todoRatio).toFixed(1));
  const inProgressDays = parseFloat((totalCycleDays * inProgressRatio).toFixed(1));
  const reviewDays = parseFloat((totalCycleDays * reviewRatio).toFixed(1));
  const qaDays = parseFloat((totalCycleDays * qaRatio).toFixed(1));
  const blockedDays = parseFloat((totalCycleDays * blockedRatio).toFixed(1));
  const doneDays = isDone ? 0.1 : 0;

  const activeDays = parseFloat((inProgressDays + reviewDays + qaDays).toFixed(1));
  const waitingDays = parseFloat((todoDays + blockedDays).toFixed(1));
  const activeWaitingTotal = activeDays + waitingDays;
  const flowEfficiency = activeWaitingTotal > 0
    ? Math.min(100, Math.round((activeDays / activeWaitingTotal) * 100))
    : 100;

  return {
    todoDays,
    inProgressDays,
    reviewDays,
    qaDays,
    blockedDays,
    doneDays,
    totalCycleDays,
    activeDays,
    waitingDays,
    flowEfficiency,
    hasHistory: false
  };
}

/**
 * Calculates Average, Median (P50), 85th Percentile (P85), and 95th Percentile (P95)
 */
export function calculateCycleTimePercentiles(cycleTimes: number[]): CycleTimePercentiles {
  const validTimes = cycleTimes.filter(t => typeof t === 'number' && !isNaN(t) && t > 0).sort((a, b) => a - b);
  const count = validTimes.length;

  if (count === 0) {
    return {
      average: 0,
      median: 0,
      p85: 0,
      p95: 0,
      count: 0
    };
  }

  const average = parseFloat((validTimes.reduce((sum, v) => sum + v, 0) / count).toFixed(1));

  const getPercentile = (p: number): number => {
    if (count === 1) return validTimes[0];
    const rank = p * (count - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    const value = validTimes[lower] * (1 - weight) + validTimes[upper] * weight;
    return parseFloat(value.toFixed(1));
  };

  const median = getPercentile(0.50);
  const p85 = getPercentile(0.85);
  const p95 = getPercentile(0.95);

  return {
    average,
    median,
    p85,
    p95,
    count
  };
}

/**
 * Identifies Aging Work (uncompleted tasks open for unusually long periods).
 */
export function identifyAgingTasks(
  tasks: Task[],
  expectedDays: number,
  historiesMap: Record<number, TaskHistoryItem[]> = {}
): AgingTask[] {
  const now = Date.now();
  const openTasks = tasks.filter(t => !isTaskCompleted(t));

  const agingList: AgingTask[] = openTasks.map(t => {
    const createdMs = t.createdAt ? new Date(t.createdAt).getTime() : now;
    const daysOpen = Math.max(0.1, parseFloat(((now - createdMs) / (1000 * 60 * 60 * 24)).toFixed(1)));
    const blocked = isTaskBlocked(t);
    const currentStage = normalizeStatusToStage(t.status, blocked);

    // Calculate time in current stage
    const histories = historiesMap[t.id] || [];
    const statusEvents = histories
      .filter(h => (h.changeType || '').toUpperCase() === 'STATUS_CHANGE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let timeInCurrentStageDays = daysOpen;
    if (statusEvents.length > 0) {
      const lastChangeMs = new Date(statusEvents[0].createdAt).getTime();
      timeInCurrentStageDays = Math.max(0.1, parseFloat(((now - lastChangeMs) / (1000 * 60 * 60 * 24)).toFixed(1)));
    }

    const requiresInvestigation = daysOpen >= expectedDays;
    let warningLevel: 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL';

    if (daysOpen >= expectedDays * 1.5 || blocked) {
      warningLevel = 'CRITICAL';
    } else if (daysOpen >= expectedDays) {
      warningLevel = 'WARNING';
    }

    let bottleneckHint = '';
    if (blocked) {
      bottleneckHint = 'Task has blocker tag or high-priority impediment.';
    } else if (timeInCurrentStageDays > expectedDays * 0.6) {
      bottleneckHint = `Stationary in ${currentStage} for ${timeInCurrentStageDays} days without status progression.`;
    } else if (daysOpen >= expectedDays) {
      bottleneckHint = `Cycle time exceeds expected service level (<${expectedDays}d).`;
    }

    return {
      task: t,
      daysOpen,
      expectedDays,
      currentStage,
      timeInCurrentStageDays,
      isBlocked: blocked,
      requiresInvestigation,
      warningLevel,
      bottleneckHint
    };
  });

  // Sort: Tasks requiring investigation first, then by daysOpen descending
  return agingList.sort((a, b) => {
    if (a.requiresInvestigation && !b.requiresInvestigation) return -1;
    if (!a.requiresInvestigation && b.requiresInvestigation) return 1;
    return b.daysOpen - a.daysOpen;
  });
}
