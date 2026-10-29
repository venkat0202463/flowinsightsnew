import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Filter,
  Flame,
  HelpCircle,
  Hourglass,
  Info,
  Layers,
  LineChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import type { Task, Sprint, Project, User } from '../types';
import { getTaskCode } from '../services/projectUtils';
import api from '../services/api';

export interface CumulativeFlowIntelligenceTabProps {
  projectId: number;
  selectedSprintId: number | 'all';
  sprints: Sprint[];
  sprintTasksMap: Record<number, Task[]>;
  tasks: Task[];
  project: Project | null;
  users: User[];
  selectedMember?: string;
  onSelectTask?: (taskId: number) => void;
}

interface CFDSnapshot {
  date: string;
  label: string;
  timestamp: number;
  todoCount: number;
  wipCount: number;
  doneCount: number;
  totalCount: number;
  todoSP: number;
  wipSP: number;
  doneSP: number;
  totalSP: number;
}

interface WeeklyThroughputItem {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  tasksCompleted: number;
  spCompleted: number;
  tasksCreated?: number;
  spCreated?: number;
  isCurrentWeek?: boolean;
}

export const CumulativeFlowIntelligenceTab: React.FC<CumulativeFlowIntelligenceTabProps> = ({
  projectId,
  selectedSprintId,
  sprints,
  sprintTasksMap,
  tasks,
  project,
  users,
  selectedMember = 'all',
  onSelectTask
}) => {
  // View & Mode Controls
  const [metricMode, setMetricMode] = useState<'COUNT' | 'SP'>('COUNT');
  const [timeRange, setTimeRange] = useState<'SPRINT' | '14D' | '30D' | '60D' | 'ALL' | 'CUSTOM'>('SPRINT');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [chartStyle, setChartStyle] = useState<'STEPPED' | 'SMOOTH' | 'COLUMNS'>('SMOOTH');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showBottleneckDrillDown, setShowBottleneckDrillDown] = useState(false);

  // 8.3 Throughput Customizable Range & Dates
  const [throughputRange, setThroughputRange] = useState<'2W' | '4W' | '6W' | '8W' | '12W' | 'CUSTOM'>('6W');
  const [throughputStartDate, setThroughputStartDate] = useState<string>('');
  const [throughputEndDate, setThroughputEndDate] = useState<string>('');
  const [showThroughputDatePicker, setShowThroughputDatePicker] = useState<boolean>(false);

  // Active Sprint
  const currentSprint = useMemo(() => {
    if (selectedSprintId === 'all') {
      return sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') || sprints[0] || null;
    }
    return sprints.find(s => s.id === selectedSprintId) || null;
  }, [sprints, selectedSprintId]);

  // Pre-fill initial date range values
  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${curYear}-${curMonth}-${curDay}`;

    if (!customEndDate) {
      setCustomEndDate(todayStr);
    }
    if (!throughputEndDate) {
      setThroughputEndDate(todayStr);
    }
    if (!throughputStartDate) {
      const past6W = new Date(now.getTime() - 42 * 86400000);
      const sYear = past6W.getFullYear();
      const sMonth = String(past6W.getMonth() + 1).padStart(2, '0');
      const sDay = String(past6W.getDate()).padStart(2, '0');
      setThroughputStartDate(`${sYear}-${sMonth}-${sDay}`);
    }
    if (!customStartDate) {
      if (currentSprint?.startDate) {
        const sd = new Date(currentSprint.startDate);
        const sYear = sd.getFullYear();
        const sMonth = String(sd.getMonth() + 1).padStart(2, '0');
        const sDay = String(sd.getDate()).padStart(2, '0');
        setCustomStartDate(`${sYear}-${sMonth}-${sDay}`);
      } else {
        const past30 = new Date(now.getTime() - 30 * 86400000);
        const pYear = past30.getFullYear();
        const pMonth = String(past30.getMonth() + 1).padStart(2, '0');
        const pDay = String(past30.getDate()).padStart(2, '0');
        setCustomStartDate(`${pYear}-${pMonth}-${pDay}`);
      }
    }
  }, [currentSprint]);

  // Tasks in scope - combine sprintTasksMap when viewing historical ranges
  const activeTasks = useMemo(() => {
    if (timeRange === 'CUSTOM' || timeRange === 'ALL' || timeRange === '60D') {
      const allMapped = Object.values(sprintTasksMap || {}).flat();
      if (allMapped.length > (tasks?.length || 0)) {
        const taskMap = new Map<number, Task>();
        (tasks || []).forEach(t => taskMap.set(t.id, t));
        allMapped.forEach(t => taskMap.set(t.id, t));
        return Array.from(taskMap.values());
      }
    }
    return tasks || [];
  }, [tasks, sprintTasksMap, timeRange]);

  // -------------------------------------------------------------
  // 1. TIMELINE & CFD SNAPSHOT GENERATION
  // -------------------------------------------------------------
  const cfdData = useMemo(() => {
    if (!activeTasks || activeTasks.length === 0) {
      return [];
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const taskDates = activeTasks
      .flatMap(t => [
        t.createdAt ? new Date(t.createdAt).getTime() : NaN,
        t.completedAt ? new Date(t.completedAt).getTime() : NaN,
        t.updatedAt ? new Date(t.updatedAt).getTime() : NaN
      ])
      .filter(t => !isNaN(t));
    const maxTaskDate = taskDates.length > 0 ? Math.max(...taskDates) : now.getTime();
    const minTaskDate = taskDates.length > 0 ? Math.min(...taskDates) : now.getTime() - 14 * 86400000;

    if (timeRange === 'CUSTOM' && customStartDate) {
      const parts = customStartDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      } else {
        startDate = new Date(customStartDate);
      }

      if (customEndDate) {
        const endParts = customEndDate.split('-').map(Number);
        if (endParts.length === 3 && !isNaN(endParts[0]) && !isNaN(endParts[1]) && !isNaN(endParts[2])) {
          endDate = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
        } else {
          endDate = new Date(customEndDate);
        }
      } else {
        endDate = new Date(now);
      }
    } else if (timeRange === '14D') {
      startDate = new Date(now.getTime() - 14 * 86400000);
      endDate = new Date(now);
    } else if (timeRange === '30D') {
      startDate = new Date(now.getTime() - 30 * 86400000);
      endDate = new Date(now);
    } else if (timeRange === '60D') {
      startDate = new Date(now.getTime() - 60 * 86400000);
      endDate = new Date(now);
    } else if (timeRange === 'SPRINT' && currentSprint?.startDate) {
      startDate = new Date(currentSprint.startDate);
      const sprintEnd = currentSprint.endDate ? new Date(currentSprint.endDate) : new Date(startDate.getTime() + 14 * 86400000);
      // Cap at today or latest task activity so we don't display months of dead flat space
      if (sprintEnd.getTime() > now.getTime()) {
        const activeCeiling = Math.max(now.getTime(), maxTaskDate + 86400000);
        endDate = new Date(Math.min(sprintEnd.getTime(), activeCeiling));
      } else {
        endDate = sprintEnd;
      }
    } else {
      startDate = new Date(minTaskDate);
      endDate = new Date(Math.max(now.getTime(), maxTaskDate));
    }

    // Ensure valid timeline
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      startDate = new Date(now.getTime() - 14 * 86400000);
      endDate = new Date(now);
    }

    // Generate daily points
    const points: CFDSnapshot[] = [];
    const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const stepDays = diffDays > 120 ? 4 : diffDays > 60 ? 2 : 1;

    let dayCursor = new Date(startDate);
    dayCursor.setHours(0, 0, 0, 0);

    const endMs = endDate.getTime();
    let index = 0;

    while (dayCursor.getTime() <= endMs) {
      const curTime = dayCursor.getTime();
      const curYear = dayCursor.getFullYear();
      const curMonth = String(dayCursor.getMonth() + 1).padStart(2, '0');
      const curDay = String(dayCursor.getDate()).padStart(2, '0');
      const isoDate = `${curYear}-${curMonth}-${curDay}`;
      const monthDay = `${dayCursor.getMonth() + 1}/${dayCursor.getDate()}`;

      let todoCount = 0;
      let wipCount = 0;
      let doneCount = 0;
      let todoSP = 0;
      let wipSP = 0;
      let doneSP = 0;

      activeTasks.forEach(task => {
        const taskCreated = task.createdAt ? new Date(task.createdAt).getTime() : startDate.getTime();
        const statusUpper = (task.status || '').toUpperCase();
        const isDone = statusUpper === 'DONE' || statusUpper === 'COMPLETED';

        let taskCompleted = Infinity;
        if (task.completedAt) {
          taskCompleted = new Date(task.completedAt).getTime();
        } else if (isDone) {
          taskCompleted = task.updatedAt ? new Date(task.updatedAt).getTime() : taskCreated;
        }

        const sp = task.storyPoints || 0;

        // Only evaluate if task existed on or before this snapshot date
        if (taskCreated <= curTime) {
          const isDoneByNow = taskCompleted <= curTime;
          const isCurrentWip = statusUpper === 'IN PROGRESS' || statusUpper === 'IN_PROGRESS' || statusUpper === 'IN REVIEW' || statusUpper === 'QA' || statusUpper === 'TESTING';

          if (isDoneByNow) {
            doneCount++;
            doneSP += sp;
          } else if (isCurrentWip) {
            wipCount++;
            wipSP += sp;
          } else {
            todoCount++;
            todoSP += sp;
          }
        }
      });

      points.push({
        date: isoDate,
        label: monthDay,
        timestamp: curTime,
        todoCount,
        wipCount,
        doneCount,
        totalCount: todoCount + wipCount + doneCount,
        todoSP,
        wipSP,
        doneSP,
        totalSP: todoSP + wipSP + doneSP
      });

      // Next step
      dayCursor = new Date(dayCursor.getTime() + stepDays * 86400000);
      index++;
      if (index > 300) break; // generous safety guard for multi-month custom ranges
    }

    return points;
  }, [activeTasks, currentSprint, timeRange, customStartDate, customEndDate]);

  // -------------------------------------------------------------
  // 8.1 WIP MONITORING CALCULATIONS
  // -------------------------------------------------------------
  const wipMetrics = useMemo(() => {
    // Current in-progress tasks
    const currentWIPTasks = activeTasks.filter(t => {
      const s = (t.status || '').toUpperCase();
      return s === 'IN PROGRESS' || s === 'IN_PROGRESS' || s === 'IN REVIEW' || s === 'TESTING' || s === 'QA';
    });

    const currentWIP = currentWIPTasks.length;
    const currentWIPSP = currentWIPTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // Calculate Average WIP and Maximum WIP from CFD history points
    const wipCounts = cfdData.map(p => (metricMode === 'COUNT' ? p.wipCount : p.wipSP));
    const maxWIP = wipCounts.length > 0 ? Math.max(...wipCounts, currentWIP) : currentWIP;
    const avgWIP = wipCounts.length > 0
      ? Math.round((wipCounts.reduce((sum, v) => sum + v, 0) / wipCounts.length) * 10) / 10
      : currentWIP;

    // WIP Trend: Compare recent 3 snapshots with initial/prior snapshots
    let wipTrendDirection: 'ACCUMULATING' | 'STABLE' | 'DRAINING' = 'STABLE';
    let wipTrendPercent = 0;

    if (cfdData.length >= 4) {
      const recentWindow = cfdData.slice(-3);
      const priorWindow = cfdData.slice(0, Math.max(1, Math.floor(cfdData.length / 2)));
      const recentAvg = recentWindow.reduce((sum, p) => sum + (metricMode === 'COUNT' ? p.wipCount : p.wipSP), 0) / recentWindow.length;
      const priorAvg = priorWindow.reduce((sum, p) => sum + (metricMode === 'COUNT' ? p.wipCount : p.wipSP), 0) / priorWindow.length;

      const diff = recentAvg - priorAvg;
      wipTrendPercent = priorAvg > 0 ? Math.round((diff / priorAvg) * 100) : (recentAvg > 0 ? 100 : 0);

      if (wipTrendPercent > 15) {
        wipTrendDirection = 'ACCUMULATING';
      } else if (wipTrendPercent < -15) {
        wipTrendDirection = 'DRAINING';
      } else {
        wipTrendDirection = 'STABLE';
      }
    }

    // Recommended WIP capacity based on team size
    const activeAssignees = new Set(activeTasks.map(t => t.assigneeId || t.assignee?.id).filter(Boolean));
    const teamCapacity = Math.max(2, activeAssignees.size || users.length || 3);
    const recommendedWIPLimit = teamCapacity * 2; // ~2 WIP per person guideline

    return {
      currentWIP,
      currentWIPSP,
      currentWIPTasks,
      avgWIP,
      maxWIP,
      wipTrendDirection,
      wipTrendPercent,
      recommendedWIPLimit,
      isWIPExcessive: currentWIP > recommendedWIPLimit
    };
  }, [activeTasks, cfdData, metricMode, users]);

  // -------------------------------------------------------------
  // 8.2 BOTTLENECK DETECTION ENGINE
  // -------------------------------------------------------------
  const bottleneckData = useMemo(() => {
    // Condition: If In Progress area continues increasing while Done remains relatively flat
    if (cfdData.length < 3) {
      return {
        hasBottleneck: false,
        wipGrowthPct: 0,
        doneGrowthPct: 0,
        agingInFlightTasks: []
      };
    }

    const midIdx = Math.floor(cfdData.length / 2);
    const priorPoint = cfdData[midIdx];
    const latestPoint = cfdData[cfdData.length - 1];

    const priorWip = metricMode === 'COUNT' ? priorPoint.wipCount : priorPoint.wipSP;
    const latestWip = metricMode === 'COUNT' ? latestPoint.wipCount : latestPoint.wipSP;

    const priorDone = metricMode === 'COUNT' ? priorPoint.doneCount : priorPoint.doneSP;
    const latestDone = metricMode === 'COUNT' ? latestPoint.doneCount : latestPoint.doneSP;

    const wipDelta = latestWip - priorWip;
    const doneDelta = latestDone - priorDone;

    const wipGrowthPct = priorWip > 0 ? (wipDelta / priorWip) * 100 : (latestWip > 0 ? 100 : 0);
    const doneGrowthPct = priorDone > 0 ? (doneDelta / priorDone) * 100 : (latestDone > 0 ? 100 : 0);

    // Bottleneck trigger: WIP is expanding while Done has flatlined or growing much slower
    const isWipExpanding = wipDelta > 0 && wipGrowthPct >= 10;
    const isDoneFlat = doneDelta <= 1 || doneGrowthPct <= 8;
    const isAccumulating = (isWipExpanding && isDoneFlat) || (latestWip >= 3 && doneDelta === 0 && wipDelta >= 0);

    // Aging in-progress items that may be stalled
    const nowMs = Date.now();
    const agingInFlightTasks = wipMetrics.currentWIPTasks
      .map(t => {
        const createdMs = t.createdAt ? new Date(t.createdAt).getTime() : nowMs;
        const updatedMs = t.updatedAt ? new Date(t.updatedAt).getTime() : createdMs;
        const daysInFlight = Math.max(1, Math.round((nowMs - createdMs) / 86400000));
        const daysSinceUpdate = Math.round((nowMs - updatedMs) / 86400000);
        return {
          task: t,
          daysInFlight,
          daysSinceUpdate,
          isHighAging: daysInFlight > 7 || daysSinceUpdate >= 3
        };
      })
      .sort((a, b) => b.daysInFlight - a.daysInFlight);

    return {
      hasBottleneck: isAccumulating,
      wipGrowthPct: Math.round(wipGrowthPct),
      doneGrowthPct: Math.round(doneGrowthPct),
      agingInFlightTasks
    };
  }, [cfdData, metricMode, wipMetrics.currentWIPTasks]);

  // -------------------------------------------------------------
  // 8.3 THROUGHPUT & WEEKLY VELOCITY INTELLIGENCE
  // -------------------------------------------------------------
  const throughputMetrics = useMemo(() => {
    // Sourced tasks pool across project and sprint maps for full history
    const allMapped = Object.values(sprintTasksMap || {}).flat();
    const taskMap = new Map<number, Task>();
    (tasks || []).forEach(t => taskMap.set(t.id, t));
    allMapped.forEach(t => taskMap.set(t.id, t));
    const allAvailableTasks = Array.from(taskMap.values());

    // Basic CFD / activeTasks done items (used by CFD legend)
    const activeDoneTasks = activeTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');
    const doneCount = activeDoneTasks.length;
    const totalCount = activeTasks.length;
    const doneSP = activeDoneTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
    const totalSP = activeTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
    const throughputPercentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const spThroughputPercentage = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;

    // All done tasks across project for weekly velocity calculations
    const allDoneTasks = allAvailableTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');

    const today = new Date();
    const currentDay = today.getDay();
    const diffToMonday = (currentDay + 6) % 7; // 0 for Monday, ..., 6 for Sunday
    const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday, 0, 0, 0, 0);

    // Determine number of weeks or custom date bounds
    let weeksCount = 6;
    if (throughputRange === '2W') weeksCount = 2;
    else if (throughputRange === '4W') weeksCount = 4;
    else if (throughputRange === '6W') weeksCount = 6;
    else if (throughputRange === '8W') weeksCount = 8;
    else if (throughputRange === '12W') weeksCount = 12;

    if (throughputRange === 'CUSTOM' && throughputStartDate && throughputEndDate) {
      const sParts = throughputStartDate.split('-').map(Number);
      const eParts = throughputEndDate.split('-').map(Number);
      if (sParts.length === 3 && eParts.length === 3) {
        const sDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
        const eDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
        const diffMs = Math.max(86400000, eDate.getTime() - sDate.getTime());
        weeksCount = Math.max(1, Math.ceil(diffMs / (7 * 86400000)));
      }
    }

    // Build chronological array of weeks: index 0 (oldest) to index weeksCount - 1 (most recent / current)
    const weeklyList: WeeklyThroughputItem[] = [];
    for (let i = weeksCount - 1; i >= 0; i--) {
      const monday = new Date(currentMonday.getTime() - i * 7 * 86400000);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday.getTime() + 6 * 86400000);
      sunday.setHours(23, 59, 59, 999);

      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;

      weeklyList.push({
        weekKey,
        weekLabel,
        startDate: monday.toISOString(),
        endDate: sunday.toISOString(),
        tasksCompleted: 0,
        spCompleted: 0,
        tasksCreated: 0,
        spCreated: 0,
        isCurrentWeek: i === 0
      });
    }

    // Populate weeks with actual created tasks
    allAvailableTasks.forEach(t => {
      const sp = t.storyPoints || 0;
      if (t.createdAt) {
        const createMs = new Date(t.createdAt).getTime();
        weeklyList.forEach(w => {
          const startMs = new Date(w.startDate).getTime();
          const endMs = new Date(w.endDate).getTime();
          if (createMs >= startMs && createMs <= endMs) {
            w.tasksCreated = (w.tasksCreated || 0) + 1;
            w.spCreated = (w.spCreated || 0) + sp;
          }
        });
      }
    });

    // Populate weeks with actual completed tasks
    allDoneTasks.forEach(t => {
      const finishDate = t.completedAt ? new Date(t.completedAt) : (t.updatedAt ? new Date(t.updatedAt) : null);
      if (!finishDate) return;

      const finishMs = finishDate.getTime();
      weeklyList.forEach(w => {
        const startMs = new Date(w.startDate).getTime();
        const endMs = new Date(w.endDate).getTime();
        if (finishMs >= startMs && finishMs <= endMs) {
          w.tasksCompleted += 1;
          w.spCompleted += (t.storyPoints || 0);
        }
      });
    });

    const totalPeriodTasks = weeklyList.reduce((acc, w) => acc + w.tasksCompleted, 0);
    const totalPeriodSP = weeklyList.reduce((acc, w) => acc + w.spCompleted, 0);
    const totalCreatedTasks = weeklyList.reduce((acc, w) => acc + (w.tasksCreated || 0), 0);
    const totalCreatedSP = weeklyList.reduce((acc, w) => acc + (w.spCreated || 0), 0);

    const activeWeeks = weeklyList.filter(w => w.tasksCompleted > 0 || w.spCompleted > 0 || (w.tasksCreated || 0) > 0);
    const activeWeeksCount = Math.max(1, activeWeeks.length);
    const avgTasksPerWeek = Math.round((totalPeriodTasks / activeWeeksCount) * 10) / 10;
    const avgSPPerWeek = Math.round((totalPeriodSP / activeWeeksCount) * 10) / 10;

    // Current active week item (last week in the sequence)
    const currentWeekItem = weeklyList[weeklyList.length - 1];
    const prevWeekItem = weeklyList.length > 1 ? weeklyList[weeklyList.length - 2] : null;

    // Throughput Trend
    let throughputTrend: 'ACCELERATING' | 'STEADY' | 'DECELERATING' = 'STEADY';
    let throughputTrendPercent = 0;

    if (prevWeekItem && prevWeekItem.tasksCompleted > 0) {
      const delta = (currentWeekItem?.tasksCompleted || 0) - prevWeekItem.tasksCompleted;
      throughputTrendPercent = Math.round((delta / prevWeekItem.tasksCompleted) * 100);
      if (throughputTrendPercent > 10) throughputTrend = 'ACCELERATING';
      else if (throughputTrendPercent < -10) throughputTrend = 'DECELERATING';
      else throughputTrend = 'STEADY';
    } else if ((currentWeekItem?.tasksCompleted || 0) > 0) {
      throughputTrend = 'ACCELERATING';
      throughputTrendPercent = 100;
    } else {
      const lastActiveWeek = [...weeklyList].reverse().find(w => w.tasksCompleted > 0);
      if (lastActiveWeek) {
        throughputTrend = 'STEADY';
        throughputTrendPercent = 0;
      }
    }

    const rangeLabel = throughputRange === 'CUSTOM'
      ? `${throughputStartDate || 'Start'} to ${throughputEndDate || 'Today'}`
      : `Last ${weeksCount} Weeks`;

    return {
      doneCount,
      totalCount,
      doneSP,
      totalSP,
      throughputPercentage,
      spThroughputPercentage,
      weeklyList,
      totalPeriodTasks,
      totalPeriodSP,
      totalCreatedTasks,
      totalCreatedSP,
      avgTasksPerWeek,
      avgSPPerWeek,
      currentWeekTasks: currentWeekItem?.tasksCompleted || 0,
      currentWeekSP: currentWeekItem?.spCompleted || 0,
      throughputTrend,
      throughputTrendPercent,
      weeksCount,
      rangeLabel
    };
  }, [activeTasks, tasks, sprintTasksMap, throughputRange, throughputStartDate, throughputEndDate]);

  // -------------------------------------------------------------
  // 4. SVG CHART RENDERER (STACKED AREA CURVES)
  // -------------------------------------------------------------
  const chartWidth = 840;
  const chartHeight = 240;
  const padding = { top: 15, right: 25, bottom: 25, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxVal = useMemo(() => {
    if (cfdData.length === 0) return 10;
    const max = Math.max(
      ...cfdData.map(d => (metricMode === 'COUNT' ? d.totalCount : d.totalSP)),
      metricMode === 'COUNT' ? activeTasks.length : activeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0)
    );
    return Math.max(5, Math.ceil(max * 1.15));
  }, [cfdData, metricMode, activeTasks]);

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxVal, val));
    return padding.top + innerHeight - (clamped / maxVal) * innerHeight;
  };

  const getX = (index: number) => {
    if (cfdData.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (cfdData.length - 1)) * innerWidth;
  };

  // Stacked Area Paths (Stepped & Strictly Monotone Spline)
  const svgPaths = useMemo(() => {
    if (cfdData.length === 0) return { donePath: '', wipPath: '', todoPath: '', doneLine: '', wipLine: '', todoLine: '' };

    const n = cfdData.length;

    // Layer 1: Done (0 to Done)
    const donePts = cfdData.map((d, i) => ({
      x: getX(i),
      y: getY(metricMode === 'COUNT' ? d.doneCount : d.doneSP)
    }));

    // Layer 2: WIP (Done to Done + WIP)
    const wipPts = cfdData.map((d, i) => ({
      x: getX(i),
      y: getY((metricMode === 'COUNT' ? d.doneCount + d.wipCount : d.doneSP + d.wipSP))
    }));

    // Layer 3: Total (0 to Total Scope)
    const totalPts = cfdData.map((d, i) => ({
      x: getX(i),
      y: getY(metricMode === 'COUNT' ? d.totalCount : d.totalSP)
    }));

    const bottomY = padding.top + innerHeight;

    if (chartStyle === 'STEPPED') {
      // Clean Jira Stepped CFD with zero gaps/overshoots
      const buildStepPath = (top: { x: number; y: number }[], bot?: { x: number; y: number }[]) => {
        if (top.length === 0) return '';
        let p = `M ${top[0].x.toFixed(1)} ${top[0].y.toFixed(1)}`;
        for (let i = 1; i < top.length; i++) {
          p += ` H ${top[i].x.toFixed(1)} V ${top[i].y.toFixed(1)}`;
        }
        if (bot && bot.length > 0) {
          p += ` V ${bot[bot.length - 1].y.toFixed(1)}`;
          for (let i = bot.length - 2; i >= 0; i--) {
            p += ` H ${bot[i + 1].x.toFixed(1)} V ${bot[i].y.toFixed(1)}`;
          }
          p += ` H ${bot[0].x.toFixed(1)}`;
        } else {
          p += ` V ${bottomY.toFixed(1)} H ${top[0].x.toFixed(1)}`;
        }
        p += ' Z';
        return p;
      };

      const buildStepLine = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return '';
        let p = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          p += ` H ${pts[i].x.toFixed(1)} V ${pts[i].y.toFixed(1)}`;
        }
        return p;
      };

      return {
        donePath: buildStepPath(donePts),
        wipPath: buildStepPath(wipPts, donePts),
        todoPath: buildStepPath(totalPts, wipPts),
        doneLine: buildStepLine(donePts),
        wipLine: buildStepLine(wipPts),
        todoLine: buildStepLine(totalPts)
      };
    }

    // Monotone Hermite Spline (Fritsch-Carlson algorithm)
    const computeMonotoneTangents = (pts: { x: number; y: number }[]) => {
      const len = pts.length;
      if (len <= 1) return { m: [0], dxs: [0] };
      const deltas: number[] = [];
      const dxs: number[] = [];
      for (let i = 0; i < len - 1; i++) {
        const dx = Math.max(0.1, pts[i + 1].x - pts[i].x);
        dxs.push(dx);
        deltas.push((pts[i + 1].y - pts[i].y) / dx);
      }
      const m: number[] = new Array(len);
      m[0] = deltas[0];
      m[len - 1] = deltas[len - 2] || 0;
      for (let i = 1; i < len - 1; i++) {
        if (deltas[i - 1] * deltas[i] <= 0) {
          m[i] = 0;
        } else {
          m[i] = (2 * deltas[i - 1] * deltas[i]) / (deltas[i - 1] + deltas[i]);
        }
      }
      return { m, dxs };
    };

    const getSplineSegments = (pts: { x: number; y: number }[]) => {
      const { m, dxs } = computeMonotoneTangents(pts);
      const segs: { p0: { x: number; y: number }; cp1: { x: number; y: number }; cp2: { x: number; y: number }; p1: { x: number; y: number } }[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = dxs[i];
        const cp1x = pts[i].x + dx / 3;
        const cp1y = Math.min(bottomY, Math.max(padding.top, pts[i].y + (m[i] * dx) / 3));
        const cp2x = pts[i + 1].x - dx / 3;
        const cp2y = Math.min(bottomY, Math.max(padding.top, pts[i + 1].y - (m[i + 1] * dx) / 3));
        segs.push({
          p0: pts[i],
          cp1: { x: cp1x, y: cp1y },
          cp2: { x: cp2x, y: cp2y },
          p1: pts[i + 1]
        });
      }
      return segs;
    };

    const topSegs = {
      done: getSplineSegments(donePts),
      wip: getSplineSegments(wipPts),
      todo: getSplineSegments(totalPts)
    };

    const buildMonotonePath = (
      segsTop: ReturnType<typeof getSplineSegments>,
      top: { x: number; y: number }[],
      segsBot?: ReturnType<typeof getSplineSegments>,
      bot?: { x: number; y: number }[]
    ) => {
      if (top.length === 0) return '';
      let p = `M ${top[0].x.toFixed(1)} ${top[0].y.toFixed(1)}`;
      for (let i = 0; i < segsTop.length; i++) {
        const s = segsTop[i];
        p += ` C ${s.cp1.x.toFixed(1)} ${s.cp1.y.toFixed(1)}, ${s.cp2.x.toFixed(1)} ${s.cp2.y.toFixed(1)}, ${s.p1.x.toFixed(1)} ${s.p1.y.toFixed(1)}`;
      }
      if (segsBot && bot && bot.length > 0) {
        p += ` L ${bot[bot.length - 1].x.toFixed(1)} ${bot[bot.length - 1].y.toFixed(1)}`;
        // Trace back along botSegs in reverse for 100% pixel-perfect boundary matching
        for (let i = segsBot.length - 1; i >= 0; i--) {
          const s = segsBot[i];
          p += ` C ${s.cp2.x.toFixed(1)} ${s.cp2.y.toFixed(1)}, ${s.cp1.x.toFixed(1)} ${s.cp1.y.toFixed(1)}, ${s.p0.x.toFixed(1)} ${s.p0.y.toFixed(1)}`;
        }
      } else {
        p += ` L ${top[top.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)}`;
        p += ` L ${top[0].x.toFixed(1)} ${bottomY.toFixed(1)}`;
      }
      p += ' Z';
      return p;
    };

    const buildMonotoneLine = (segs: ReturnType<typeof getSplineSegments>, pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return '';
      let p = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        p += ` C ${s.cp1.x.toFixed(1)} ${s.cp1.y.toFixed(1)}, ${s.cp2.x.toFixed(1)} ${s.cp2.y.toFixed(1)}, ${s.p1.x.toFixed(1)} ${s.p1.y.toFixed(1)}`;
      }
      return p;
    };

    return {
      donePath: buildMonotonePath(topSegs.done, donePts),
      wipPath: buildMonotonePath(topSegs.wip, wipPts, topSegs.done, donePts),
      todoPath: buildMonotonePath(topSegs.todo, totalPts, topSegs.wip, wipPts),
      doneLine: buildMonotoneLine(topSegs.done, donePts),
      wipLine: buildMonotoneLine(topSegs.wip, wipPts),
      todoLine: buildMonotoneLine(topSegs.todo, totalPts)
    };
  }, [cfdData, maxVal, metricMode, chartStyle]);

  // Horizontal Grid Ticks
  const yTicks = useMemo(() => {
    const count = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((maxVal / count) * i));
    }
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  }, [maxVal]);

  const activeHoverPoint = hoveredIndex !== null && cfdData[hoveredIndex] ? cfdData[hoveredIndex] : null;

  return (
    <div className="space-y-8 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 8.2 BOTTLENECK DETECTION ALERT BANNER                           */}
      {/* ------------------------------------------------------------- */}
      {bottleneckData.hasBottleneck && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-l-4 border-amber-500 p-6 rounded-r-xl bg-white shadow-sm border-y border-r border-[#DFE1E6] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300 shadow-2xs">
              <AlertTriangle className="text-amber-700 animate-pulse" size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                  Flow Alert
                </span>
                <h3 className="text-base font-bold text-[#172B4D] flex items-center gap-1.5">
                  ⚠ Potential Bottleneck
                </h3>
              </div>
              <p className="text-sm font-semibold text-amber-900 mt-1">
                Work is accumulating in In Progress.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200 shadow-2xs">
                  <p className="text-xs font-bold text-[#172B4D] mb-1.5 flex items-center gap-1">
                    <HelpCircle size={13} className="text-amber-600" />
                    Possible investigation:
                  </p>
                  <ul className="text-xs text-[#42526E] space-y-1 pl-4 list-disc marker:text-amber-600 font-medium">
                    <li><b>QA capacity</b>: Verify test queue backlog and validation throughput.</li>
                    <li><b>Review delays</b>: Inspect PR and peer-review waiting times.</li>
                    <li><b>Technical blockers</b>: Check for dependency stalls and environment impediments.</li>
                  </ul>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">WIP vs Done Growth Divergence</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-black text-rose-600">+{bottleneckData.wipGrowthPct}% WIP</span>
                      <span className="text-xs text-[#5E6C84]">vs</span>
                      <span className="text-sm font-bold text-slate-600">{bottleneckData.doneGrowthPct}% Done</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBottleneckDrillDown(!showBottleneckDrillDown)}
                    className="mt-2 text-xs font-bold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>{showBottleneckDrillDown ? 'Hide aging WIP items' : `Inspect ${bottleneckData.agingInFlightTasks.length} in-flight items`}</span>
                    <ChevronRight size={14} className={`transition-transform ${showBottleneckDrillDown ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Collapsible Aging Items Table */}
              {showBottleneckDrillDown && bottleneckData.agingInFlightTasks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-200/60 overflow-x-auto">
                  <table className="w-full text-left text-xs bg-white rounded-lg border border-[#DFE1E6] overflow-hidden">
                    <thead className="bg-[#FAFBFC] border-b border-[#DFE1E6] text-[10px] font-bold text-[#5E6C84] uppercase">
                      <tr>
                        <th className="py-2 px-3">Work Item</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-center">Assignee</th>
                        <th className="py-2 px-3 text-center">Days in WIP</th>
                        <th className="py-2 px-3 text-right">Story Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EBECF0]">
                      {bottleneckData.agingInFlightTasks.slice(0, 5).map(({ task, daysInFlight }) => (
                        <tr
                          key={task.id}
                          onClick={() => onSelectTask && onSelectTask(task.id)}
                          className="hover:bg-amber-50/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-3">
                            <span className="font-bold text-[#0052CC] hover:underline">
                              {getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}: {task.title}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {task.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-[#42526E] font-medium">
                            {task.assignee?.name || 'Unassigned'}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-rose-600">
                            {daysInFlight}d
                          </td>
                          <td className="py-2 px-3 text-right font-black text-[#172B4D]">
                            {task.storyPoints || 0} SP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ------------------------------------------------------------- */}
      {/* MAIN CUMULATIVE FLOW DIAGRAM (CFD)                            */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-7 rounded-xl border border-[#DFE1E6] shadow-sm">
        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172B4D]">
                Cumulative Flow Diagram (CFD)
              </h3>
              {selectedMember !== 'all' && (
                <span className="bg-blue-50 text-[#0052CC] text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  👤 {selectedMember}
                </span>
              )}
            </div>
            <p className="text-xs text-[#5E6C84] mt-0.5">
              Distribution of work across To Do, In Progress (WIP), and Done stages over time
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Metric Mode Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC]">
              <button
                type="button"
                onClick={() => setMetricMode('COUNT')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${metricMode === 'COUNT'
                  ? 'bg-white text-[#0052CC] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`}
              >
                Work Items
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('SP')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${metricMode === 'SP'
                  ? 'bg-white text-[#0052CC] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`}
              >
                Story Points
              </button>
            </div>

            {/* Timeframe Selector & Calendar Option to See Before Days */}
            <div className="flex items-center gap-1.5 relative">
              <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC]">
                {(['SPRINT', '14D', '30D', '60D', 'ALL'] as const).map(range => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setTimeRange(range);
                      setShowDatePicker(false);
                    }}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${timeRange === range
                      ? 'bg-white text-[#172B4D] shadow-2xs'
                      : 'text-[#5E6C84] hover:text-[#172B4D]'
                      }`}
                  >
                    {range === 'SPRINT' ? 'Sprint' : range === '14D' ? '14 Days' : range === '30D' ? '30 Days' : range === '60D' ? '60 Days' : 'Full Scope'}
                  </button>
                ))}
              </div>

              {/* Calendar Button (See Before Days / Custom Range) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${showDatePicker || timeRange === 'CUSTOM'
                    ? 'bg-blue-50 border-[#0052CC] text-[#0052CC] shadow-2xs'
                    : 'bg-[#FAFBFC] border-[#DFE1E6] text-[#5E6C84] hover:text-[#172B4D] hover:bg-white'
                    }`}
                  title="See Before Days / Select Custom Date Range"
                >
                  <Calendar size={15} />
                </button>

                {/* Calendar Date Range Dropdown Popover */}
                {showDatePicker && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowDatePicker(false)} />
                    <div className="absolute right-0 top-full mt-2 z-40 w-72 bg-white rounded-xl shadow-xl border border-[#DFE1E6] p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between border-b border-[#EBECF0] pb-2">
                        <span className="font-bold text-[#172B4D] flex items-center gap-1.5">
                          <Calendar size={14} className="text-[#0052CC]" />
                          See Before Days & History
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(false)}
                          className="text-[#5E6C84] hover:text-[#172B4D] text-xs font-bold px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Quick Historical Jump buttons */}
                      <div>
                        <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block mb-1.5">
                          Quick Historical Jumps
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const d = new Date(now.getTime() - 45 * 86400000);
                              const curYear = d.getFullYear();
                              const curMonth = String(d.getMonth() + 1).padStart(2, '0');
                              const curDay = String(d.getDate()).padStart(2, '0');
                              setCustomStartDate(`${curYear}-${curMonth}-${curDay}`);
                              setCustomEndDate(new Date().toISOString().split('T')[0]);
                              setTimeRange('CUSTOM');
                              setShowDatePicker(false);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-[#FAFBFC] hover:bg-blue-50 hover:text-[#0052CC] border border-[#DFE1E6] font-bold text-[11px] text-left transition-colors cursor-pointer"
                          >
                            ← Past 45 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const d = new Date(now.getTime() - 60 * 86400000);
                              const curYear = d.getFullYear();
                              const curMonth = String(d.getMonth() + 1).padStart(2, '0');
                              const curDay = String(d.getDate()).padStart(2, '0');
                              setCustomStartDate(`${curYear}-${curMonth}-${curDay}`);
                              setCustomEndDate(new Date().toISOString().split('T')[0]);
                              setTimeRange('CUSTOM');
                              setShowDatePicker(false);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-[#FAFBFC] hover:bg-blue-50 hover:text-[#0052CC] border border-[#DFE1E6] font-bold text-[11px] text-left transition-colors cursor-pointer"
                          >
                            ← Past 60 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const d = new Date(now.getTime() - 90 * 86400000);
                              const curYear = d.getFullYear();
                              const curMonth = String(d.getMonth() + 1).padStart(2, '0');
                              const curDay = String(d.getDate()).padStart(2, '0');
                              setCustomStartDate(`${curYear}-${curMonth}-${curDay}`);
                              setCustomEndDate(new Date().toISOString().split('T')[0]);
                              setTimeRange('CUSTOM');
                              setShowDatePicker(false);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-[#FAFBFC] hover:bg-blue-50 hover:text-[#0052CC] border border-[#DFE1E6] font-bold text-[11px] text-left transition-colors cursor-pointer"
                          >
                            ← Past 90 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const baseStart = customStartDate ? new Date(customStartDate) : (currentSprint?.startDate ? new Date(currentSprint.startDate) : new Date(now.getTime() - 14 * 86400000));
                              const earlier = new Date(baseStart.getTime() - 30 * 86400000);
                              const curYear = earlier.getFullYear();
                              const curMonth = String(earlier.getMonth() + 1).padStart(2, '0');
                              const curDay = String(earlier.getDate()).padStart(2, '0');
                              setCustomStartDate(`${curYear}-${curMonth}-${curDay}`);
                              if (!customEndDate) {
                                setCustomEndDate(new Date().toISOString().split('T')[0]);
                              }
                              setTimeRange('CUSTOM');
                              setShowDatePicker(false);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-[#FAFBFC] hover:bg-blue-50 hover:text-[#0052CC] border border-[#DFE1E6] font-bold text-[11px] text-left transition-colors cursor-pointer"
                          >
                            ← 30d Earlier
                          </button>
                        </div>
                      </div>

                      {/* Date Pickers */}
                      <div className="space-y-2 pt-1 border-t border-[#EBECF0]">
                        <div>
                          <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block mb-1">
                            From (See Before Days)
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DFE1E6] bg-white focus:outline-none focus:border-[#0052CC] font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DFE1E6] bg-white focus:outline-none focus:border-[#0052CC] font-medium"
                          />
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#EBECF0]">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomStartDate('');
                            setCustomEndDate('');
                            setTimeRange('SPRINT');
                            setShowDatePicker(false);
                          }}
                          className="text-[11px] font-bold text-[#5E6C84] hover:text-[#172B4D] cursor-pointer"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (customStartDate) {
                              setTimeRange('CUSTOM');
                              setShowDatePicker(false);
                            }
                          }}
                          className="px-3 py-1 bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold rounded-md text-xs shadow-2xs cursor-pointer"
                        >
                          Apply Range
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chart Style Switcher */}
            <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC]">
              <button
                type="button"
                onClick={() => setChartStyle('SMOOTH')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${chartStyle === 'SMOOTH'
                  ? 'bg-white text-[#0052CC] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`}
                title="Modern Translucent Flow"
              >
                <LineChart size={12} />
                <span>Flow</span>
              </button>
              <button
                type="button"
                onClick={() => setChartStyle('STEPPED')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${chartStyle === 'STEPPED'
                  ? 'bg-white text-[#0052CC] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`}
                title="Classic Jira Stepped Flow"
              >
                <Activity size={12} />
                <span>Stepped</span>
              </button>
              <button
                type="button"
                onClick={() => setChartStyle('COLUMNS')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${chartStyle === 'COLUMNS'
                  ? 'bg-white text-[#0052CC] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`}
                title="Daily Stacked Distribution Columns"
              >
                <BarChart2 size={12} />
                <span>Columns</span>
              </button>
            </div>
          </div>
        </div>


        {/* Active Custom Range Indicator */}
        {timeRange === 'CUSTOM' && customStartDate && (
          <div className="mb-4 px-3 py-1.5 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
            <span className="text-[#0052CC] font-bold flex items-center gap-1.5">
              <Calendar size={13} />
              Historical Range: <b>{customStartDate}</b> → <b>{customEndDate || 'Today'}</b> ({cfdData.length} daily snapshots)
            </span>
            <button
              type="button"
              onClick={() => {
                setCustomStartDate('');
                setCustomEndDate('');
                setTimeRange('SPRINT');
              }}
              className="text-[#0052CC] hover:underline font-bold text-[11px] cursor-pointer"
            >
              Reset to Sprint
            </button>
          </div>
        )}

        {/* SVG Visualization */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto overflow-visible select-none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="cfdDoneGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="cfdWipGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.36" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="cfdTodoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.04" />
              </linearGradient>
              <filter id="cfdLineGlowEmerald" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#10B981" floodOpacity="0.35" />
              </filter>
              <filter id="cfdLineGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#3B82F6" floodOpacity="0.35" />
              </filter>
              <filter id="cfdLineGlowAmber" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#F59E0B" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Horizontal Grid Lines */}
            {yTicks.map(tVal => {
              const y = getY(tVal);
              return (
                <g key={tVal}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 3.5}
                    textAnchor="end"
                    className="text-[10px] font-bold fill-[#6B778C]"
                  >
                    {tVal} {tVal === maxVal ? (metricMode === 'COUNT' ? 'tasks' : 'SP') : ''}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Baseline */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={chartWidth - padding.right}
              y2={padding.top + innerHeight}
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* CFD Stacked Layers / Columns */}
            {chartStyle === 'COLUMNS' ? (
              <g>
                {cfdData.map((d, i) => {
                  const x = getX(i);
                  const colW = Math.max(4, Math.min(24, (innerWidth / (cfdData.length || 1)) * 0.7));
                  const doneVal = metricMode === 'COUNT' ? d.doneCount : d.doneSP;
                  const wipVal = metricMode === 'COUNT' ? d.wipCount : d.wipSP;
                  const todoVal = metricMode === 'COUNT' ? d.todoCount : d.todoSP;

                  const yDone = getY(doneVal);
                  const yWip = getY(doneVal + wipVal);
                  const yTodo = getY(doneVal + wipVal + todoVal);
                  const hDone = padding.top + innerHeight - yDone;
                  const hWip = yDone - yWip;
                  const hTodo = yWip - yTodo;

                  return (
                    <g key={i}>
                      {/* Done bar */}
                      {hDone > 0 && (
                        <rect
                          x={x - colW / 2}
                          y={yDone}
                          width={colW}
                          height={hDone}
                          fill="url(#cfdDoneGradient)"
                          rx={wipVal === 0 && todoVal === 0 ? 3 : 0}
                        />
                      )}
                      {/* WIP bar */}
                      {hWip > 0 && (
                        <rect
                          x={x - colW / 2}
                          y={yWip}
                          width={colW}
                          height={hWip}
                          fill="url(#cfdWipGradient)"
                          rx={todoVal === 0 ? 3 : 0}
                        />
                      )}
                      {/* To Do bar */}
                      {hTodo > 0 && (
                        <rect
                          x={x - colW / 2}
                          y={yTodo}
                          width={colW}
                          height={hTodo}
                          fill="url(#cfdTodoGradient)"
                          rx={3}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            ) : (
              <g>
                {/* Top Layer: To Do */}
                {svgPaths.todoPath && (
                  <path
                    d={svgPaths.todoPath}
                    fill="url(#cfdTodoGradient)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Middle Layer: WIP / In Progress */}
                {svgPaths.wipPath && (
                  <path
                    d={svgPaths.wipPath}
                    fill="url(#cfdWipGradient)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Bottom Layer: Done */}
                {svgPaths.donePath && (
                  <path
                    d={svgPaths.donePath}
                    fill="url(#cfdDoneGradient)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Crisp Boundary Accent Lines with Glow */}
                {svgPaths.todoLine && (
                  <path
                    d={svgPaths.todoLine}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeDasharray="5,4"
                    filter="url(#cfdLineGlowAmber)"
                    opacity="0.95"
                  />
                )}
                {svgPaths.wipLine && (
                  <path
                    d={svgPaths.wipLine}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    filter="url(#cfdLineGlowBlue)"
                    opacity="0.95"
                  />
                )}
                {svgPaths.doneLine && (
                  <path
                    d={svgPaths.doneLine}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    filter="url(#cfdLineGlowEmerald)"
                    opacity="0.98"
                  />
                )}

                {/* Milestone Point Markers */}
                {cfdData.map((d, i) => {
                  const x = getX(i);
                  const doneVal = metricMode === 'COUNT' ? d.doneCount : d.doneSP;
                  const wipVal = metricMode === 'COUNT' ? d.wipCount : d.wipSP;
                  const totalVal = metricMode === 'COUNT' ? d.totalCount : d.totalSP;
                  const prev = i > 0 ? cfdData[i - 1] : null;
                  const isChange = !prev || d.doneCount !== prev.doneCount || d.wipCount !== prev.wipCount || d.todoCount !== prev.todoCount || i === cfdData.length - 1;

                  if (!isChange) return null;

                  return (
                    <g key={`marker-${i}`} pointerEvents="none">
                      {doneVal > 0 && (
                        <circle cx={x} cy={getY(doneVal)} r="3" fill="#FFFFFF" stroke="#059669" strokeWidth="2" />
                      )}
                      {wipVal > 0 && (
                        <circle cx={x} cy={getY(doneVal + wipVal)} r="3" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
                      )}
                      {totalVal > 0 && (
                        <circle cx={x} cy={getY(totalVal)} r="3" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2" />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* X-Axis Date Labels with Intelligent Spacing */}
            {cfdData.map((d, i) => {
              const x = getX(i);
              const isFirst = i === 0;
              const isLast = i === cfdData.length - 1;
              const step = Math.max(1, Math.ceil(cfdData.length / 8));
              const isStep = i % step === 0;

              // Collision avoidance
              if (!isFirst && !isLast && !isStep) return null;
              if (!isLast && Math.abs(x - getX(cfdData.length - 1)) < 35) return null;

              return (
                <g key={d.date}>
                  <line
                    x1={x}
                    y1={padding.top + innerHeight}
                    x2={x}
                    y2={padding.top + innerHeight + 4}
                    stroke="#94A3B8"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padding.top + innerHeight + 14}
                    textAnchor="middle"
                    className="text-[9.5px] font-bold fill-[#6B778C]"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Interactive Hover Hit Zones */}
            {cfdData.map((d, i) => {
              const x = getX(i);
              const w = innerWidth / (cfdData.length || 1);
              return (
                <rect
                  key={i}
                  x={x - w / 2}
                  y={padding.top}
                  width={w}
                  height={innerHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              );
            })}

            {/* Active Vertical Crosshair & Floating Tooltip */}
            {hoveredIndex !== null && activeHoverPoint && (
              <g pointerEvents="none">
                <line
                  x1={getX(hoveredIndex)}
                  y1={padding.top}
                  x2={getX(hoveredIndex)}
                  y2={padding.top + innerHeight}
                  stroke="#172B4D"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(metricMode === 'COUNT' ? activeHoverPoint.doneCount : activeHoverPoint.doneSP)}
                  r="4"
                  fill="#10B981"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(metricMode === 'COUNT' ? activeHoverPoint.doneCount + activeHoverPoint.wipCount : activeHoverPoint.doneSP + activeHoverPoint.wipSP)}
                  r="4"
                  fill="#3B82F6"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(metricMode === 'COUNT' ? activeHoverPoint.totalCount : activeHoverPoint.totalSP)}
                  r="4"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip HTML Card */}
          {hoveredIndex !== null && activeHoverPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-white p-3 rounded-lg shadow-xl border border-[#DFE1E6] text-xs space-y-1.5 transition-all duration-75 animate-in fade-in"
              style={{
                left: `${Math.min(85, Math.max(15, (getX(hoveredIndex) / chartWidth) * 100))}%`,
                top: '20px',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="font-bold text-[#172B4D] border-b border-[#EBECF0] pb-1 flex items-center justify-between gap-4">
                <span>{activeHoverPoint.date}</span>
                <span className="text-[10px] text-[#5E6C84]">Scope: {activeHoverPoint.totalCount} tasks ({activeHoverPoint.totalSP} SP)</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Done:
                </span>
                <b className="text-[#172B4D]">{metricMode === 'COUNT' ? `${activeHoverPoint.doneCount} tasks` : `${activeHoverPoint.doneSP} SP`}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> In Progress (WIP):
                </span>
                <b className="text-[#172B4D]">{metricMode === 'COUNT' ? `${activeHoverPoint.wipCount} tasks` : `${activeHoverPoint.wipSP} SP`}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> To Do:
                </span>
                <b className="text-[#172B4D]">{metricMode === 'COUNT' ? `${activeHoverPoint.todoCount} tasks` : `${activeHoverPoint.todoSP} SP`}</b>
              </div>
            </div>
          )}
        </div>

        {/* Legend (Down of the graph) */}
        <div className="flex items-center justify-center mt-2 pt-3 border-t border-[#F4F5F7] flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-500 shadow-2xs"></span>
            <span className="text-xs font-bold text-[#172B4D]">Done</span>
            <span className="text-[11px] text-[#5E6C84]">
              ({throughputMetrics.doneCount} items / {throughputMetrics.doneSP} SP)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500 shadow-2xs"></span>
            <span className="text-xs font-bold text-[#172B4D]">In Progress (WIP)</span>
            <span className="text-[11px] text-[#5E6C84]">
              ({wipMetrics.currentWIP} items / {wipMetrics.currentWIPSP} SP)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-400 shadow-2xs"></span>
            <span className="text-xs font-bold text-[#172B4D]">To Do</span>
            <span className="text-[11px] text-[#5E6C84]">
              ({Math.max(0, activeTasks.length - throughputMetrics.doneCount - wipMetrics.currentWIP)} items)
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 8.3 THROUGHPUT INTELLIGENCE                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm relative">
        {/* Header with Title and Week/Date Range Customizer */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Throughput & Delivery Velocity
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[10px] bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-800 border border-emerald-300/70 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Output Rate
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Weekly throughput and delivery velocity tracking with customizable timeline analysis
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">

            {/* Calendar Popover for Custom Dates (See Before Days) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThroughputDatePicker(!showThroughputDatePicker)}
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${showThroughputDatePicker || throughputRange === 'CUSTOM'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                title="Customize Dates & Weeks (See Before Days)"
              >
                <Calendar size={14} />
                <span className="text-[11px] hidden sm:inline">Customize Dates</span>
              </button>

              {showThroughputDatePicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowThroughputDatePicker(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar size={14} className="text-indigo-600" />
                        Customize Dates & Weeks
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowThroughputDatePicker(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quick Historical Jumps */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Quick Historical Jumps
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const d = new Date(now.getTime() - 28 * 86400000);
                            setThroughputStartDate(d.toISOString().split('T')[0]);
                            setThroughputEndDate(now.toISOString().split('T')[0]);
                            setThroughputRange('CUSTOM');
                            setShowThroughputDatePicker(false);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 font-bold text-[11px] text-left transition-colors cursor-pointer"
                        >
                          ← Past 4 Weeks
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const d = new Date(now.getTime() - 56 * 86400000);
                            setThroughputStartDate(d.toISOString().split('T')[0]);
                            setThroughputEndDate(now.toISOString().split('T')[0]);
                            setThroughputRange('CUSTOM');
                            setShowThroughputDatePicker(false);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 font-bold text-[11px] text-left transition-colors cursor-pointer"
                        >
                          ← Past 8 Weeks
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const d = new Date(now.getTime() - 84 * 86400000);
                            setThroughputStartDate(d.toISOString().split('T')[0]);
                            setThroughputEndDate(now.toISOString().split('T')[0]);
                            setThroughputRange('CUSTOM');
                            setShowThroughputDatePicker(false);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 font-bold text-[11px] text-left transition-colors cursor-pointer"
                        >
                          ← Past 12 Weeks
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const d = new Date(now.getTime() - 90 * 86400000);
                            setThroughputStartDate(d.toISOString().split('T')[0]);
                            setThroughputEndDate(now.toISOString().split('T')[0]);
                            setThroughputRange('CUSTOM');
                            setShowThroughputDatePicker(false);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 font-bold text-[11px] text-left transition-colors cursor-pointer"
                        >
                          ← Past 90 Days
                        </button>
                      </div>
                    </div>

                    {/* Date Inputs */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          From (See Before Days)
                        </label>
                        <input
                          type="date"
                          value={throughputStartDate}
                          onChange={e => setThroughputStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={throughputEndDate}
                          onChange={e => setThroughputEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setThroughputRange('6W');
                          setShowThroughputDatePicker(false);
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Reset (6W)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (throughputStartDate && throughputEndDate) {
                            setThroughputRange('CUSTOM');
                            setShowThroughputDatePicker(false);
                          }
                        }}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md text-xs shadow-2xs cursor-pointer"
                      >
                        Apply Range
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Throughput Trend Pill */}
            <div className="flex items-center gap-1.5">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-2xs ${throughputMetrics.throughputTrend === 'ACCELERATING'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                : throughputMetrics.throughputTrend === 'DECELERATING'
                  ? 'bg-amber-50 text-amber-700 border border-amber-300'
                  : 'bg-blue-50 text-blue-700 border border-blue-300'
                }`}>
                {throughputMetrics.throughputTrend === 'ACCELERATING' && <TrendingUp size={13} />}
                {throughputMetrics.throughputTrend === 'DECELERATING' && <TrendingDown size={13} />}
                {throughputMetrics.throughputTrend === 'STEADY' && <Activity size={13} />}
                <span>{throughputMetrics.throughputTrend}</span>
                {throughputMetrics.throughputTrendPercent !== 0 && (
                  <span className="text-[10.5px]">({throughputMetrics.throughputTrendPercent > 0 ? `+${throughputMetrics.throughputTrendPercent}%` : `${throughputMetrics.throughputTrendPercent}%`})</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ONLY The 2 Core Cards: Tasks Completed Per Week & Story Points Completed Per Week */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Tasks Completed Per Week */}
          <div className="p-6 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-700 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700"><BarChart2 size={16} /></span>
                  Tasks Completed Per Week
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                  {throughputMetrics.rangeLabel}
                </span>
              </div>

              {/* Completed by Week Bar Chart */}
              <div className="pt-2">
                <svg viewBox="0 0 500 155" className="w-full h-44 overflow-visible">
                  {(() => {
                    const chartLeft = 28;
                    const chartRight = 485;
                    const chartTop = 15;
                    const chartBottom = 115;
                    const chartHeight = chartBottom - chartTop;
                    const list = throughputMetrics.weeklyList;
                    const n = Math.max(1, list.length);
                    const maxVal = Math.max(1, ...list.map(w => w.tasksCompleted));
                    const yMax = Math.max(4, Math.ceil(maxVal * 1.25));
                    const getY = (val: number) => chartBottom - (Math.min(val, yMax) / yMax) * chartHeight;
                    const slotW = (chartRight - chartLeft) / n;
                    const barW = Math.min(36, Math.max(14, slotW * 0.42));
                    const ticks = [Math.round(yMax * 0.33), Math.round(yMax * 0.66), yMax];

                    return (
                      <>
                        {/* Light horizontal grid lines & Y-axis labels */}
                        {ticks.map(t => {
                          const y = getY(t);
                          return (
                            <g key={`task-grid-${t}`}>
                              <line
                                x1={chartLeft}
                                y1={y}
                                x2={chartRight}
                                y2={y}
                                stroke="#F1F5F9"
                                strokeWidth="1"
                              />
                              <text
                                x={chartLeft - 8}
                                y={y + 3.5}
                                textAnchor="end"
                                className="text-[10px] font-medium fill-[#94A3B8]"
                              >
                                {t}
                              </text>
                            </g>
                          );
                        })}

                        {/* Zero tick label */}
                        <text
                          x={chartLeft - 8}
                          y={chartBottom + 3.5}
                          textAnchor="end"
                          className="text-[10px] font-medium fill-[#94A3B8]"
                        >
                          0
                        </text>

                        {/* Baseline */}
                        <line
                          x1={chartLeft}
                          y1={chartBottom}
                          x2={chartRight}
                          y2={chartBottom}
                          stroke="#CBD5E1"
                          strokeWidth="1"
                        />

                        {/* Bars & X-axis Weeks */}
                        {list.map((w, i) => {
                          const centerX = chartLeft + (i + 0.5) * slotW;
                          const completedVal = w.tasksCompleted || 0;
                          const completedH = (completedVal / yMax) * chartHeight;
                          const x = centerX - barW / 2;
                          const y = chartBottom - completedH;

                          return (
                            <g key={w.weekKey}>
                              {/* Completed Bar (Blue) */}
                              {completedVal > 0 ? (
                                <>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barW}
                                    height={completedH}
                                    rx="3"
                                    fill="#1D4ED8"
                                  />
                                  <text
                                    x={centerX}
                                    y={y - 4}
                                    textAnchor="middle"
                                    className="text-[10.5px] font-bold fill-[#1D4ED8]"
                                  >
                                    {completedVal}
                                  </text>
                                </>
                              ) : (
                                <circle cx={centerX} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                              )}

                              {/* Week Label */}
                              <text
                                x={centerX}
                                y={chartBottom + 16}
                                textAnchor="middle"
                                className={`text-[10px] font-bold ${w.isCurrentWeek ? 'fill-[#1D4ED8]' : 'fill-[#64748B]'}`}
                              >
                                Week {i + 1}{w.isCurrentWeek ? ' (Now)' : ''}
                              </text>
                              <text
                                x={centerX}
                                y={chartBottom + 27}
                                textAnchor="middle"
                                className="text-[8.5px] font-medium fill-[#94A3B8]"
                              >
                                {w.weekLabel}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>


              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-200/80">
              <span className="font-medium">Weekly Cadence:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Stable Flow
              </span>
            </div>
          </div>

          {/* 2. Story Points Completed Per Week */}
          <div className="p-6 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/30 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-700 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100/70 text-emerald-700"><Zap size={16} /></span>
                  Story Points Completed Per Week
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Velocity
                </span>
              </div>

              {/* Completed by Week Bar Chart */}
              <div className="pt-2">
                <svg viewBox="0 0 500 155" className="w-full h-44 overflow-visible">
                  {(() => {
                    const chartLeft = 28;
                    const chartRight = 485;
                    const chartTop = 15;
                    const chartBottom = 115;
                    const chartHeight = chartBottom - chartTop;
                    const list = throughputMetrics.weeklyList;
                    const n = Math.max(1, list.length);
                    const maxVal = Math.max(1, ...list.map(w => w.spCompleted));
                    const yMax = Math.max(5, Math.ceil(maxVal * 1.25));
                    const getY = (val: number) => chartBottom - (Math.min(val, yMax) / yMax) * chartHeight;
                    const slotW = (chartRight - chartLeft) / n;
                    const barW = Math.min(36, Math.max(14, slotW * 0.42));
                    const ticks = [Math.round(yMax * 0.33), Math.round(yMax * 0.66), yMax];

                    return (
                      <>
                        {/* Light horizontal grid lines & Y-axis labels */}
                        {ticks.map(t => {
                          const y = getY(t);
                          return (
                            <g key={`sp-grid-${t}`}>
                              <line
                                x1={chartLeft}
                                y1={y}
                                x2={chartRight}
                                y2={y}
                                stroke="#F1F5F9"
                                strokeWidth="1"
                              />
                              <text
                                x={chartLeft - 8}
                                y={y + 3.5}
                                textAnchor="end"
                                className="text-[10px] font-medium fill-[#94A3B8]"
                              >
                                {t}
                              </text>
                            </g>
                          );
                        })}

                        {/* Zero tick label */}
                        <text
                          x={chartLeft - 8}
                          y={chartBottom + 3.5}
                          textAnchor="end"
                          className="text-[10px] font-medium fill-[#94A3B8]"
                        >
                          0
                        </text>

                        {/* Baseline */}
                        <line
                          x1={chartLeft}
                          y1={chartBottom}
                          x2={chartRight}
                          y2={chartBottom}
                          stroke="#CBD5E1"
                          strokeWidth="1"
                        />

                        {/* Bars & X-axis Weeks */}
                        {list.map((w, i) => {
                          const centerX = chartLeft + (i + 0.5) * slotW;
                          const completedVal = w.spCompleted || 0;
                          const completedH = (completedVal / yMax) * chartHeight;
                          const x = centerX - barW / 2;
                          const y = chartBottom - completedH;

                          return (
                            <g key={w.weekKey}>
                              {/* Completed Bar (Emerald Green) */}
                              {completedVal > 0 ? (
                                <>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barW}
                                    height={completedH}
                                    rx="3"
                                    fill="#10B981"
                                  />
                                  <text
                                    x={centerX}
                                    y={y - 4}
                                    textAnchor="middle"
                                    className="text-[10.5px] font-bold fill-[#10B981]"
                                  >
                                    {completedVal} SP
                                  </text>
                                </>
                              ) : (
                                <circle cx={centerX} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                              )}

                              {/* Week Label */}
                              <text
                                x={centerX}
                                y={chartBottom + 16}
                                textAnchor="middle"
                                className={`text-[10px] font-bold ${w.isCurrentWeek ? 'fill-[#10B981]' : 'fill-[#64748B]'}`}
                              >
                                Week {i + 1}{w.isCurrentWeek ? ' (Now)' : ''}
                              </text>
                              <text
                                x={centerX}
                                y={chartBottom + 27}
                                textAnchor="middle"
                                className="text-[8.5px] font-medium fill-[#94A3B8]"
                              >
                                {w.weekLabel}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>


              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-200/80">
              <span className="font-medium">Delivery Velocity:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1.5">
                <Activity size={12} className="text-indigo-600" />
                {throughputMetrics.avgSPPerWeek > 0 ? `${throughputMetrics.avgSPPerWeek} SP Velocity` : 'Initial Baseline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CumulativeFlowIntelligenceTab;
