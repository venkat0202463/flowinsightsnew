import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  Info,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Zap,
  BarChart2,
  PieChart
} from 'lucide-react';
import type { Task, Sprint, Project, User } from '../types';
import api from '../services/api';
import { getTaskCode } from '../services/projectUtils';
import {
  type TaskHistoryItem,
  type CycleStage,
  computeTaskStageBreakdown,
  calculateCycleTimePercentiles,
  identifyAgingTasks,
  isTaskCompleted,
  isTaskBlocked
} from '../services/cycleTimeCalculations';

interface CycleTimeIntelligenceTabProps {
  projectId: number;
  selectedSprintId: number | 'all';
  sprints: Sprint[];
  sprintTasksMap: Record<number, Task[]>;
  tasks: Task[];
  project: Project | null;
  users: User[];
  onSelectTask?: (taskId: number) => void;
}

export const CycleTimeIntelligenceTab: React.FC<CycleTimeIntelligenceTabProps> = ({
  projectId,
  selectedSprintId,
  sprints,
  sprintTasksMap,
  tasks,
  project,
  users,
  onSelectTask
}) => {
  // History cache for tasks
  const [taskHistories, setTaskHistories] = useState<Record<number, TaskHistoryItem[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoadedCount, setHistoryLoadedCount] = useState(0);

  // User configurable expected SLA threshold in days (defaults to dynamic P85)
  const [customExpectedDays, setCustomExpectedDays] = useState<number | null>(null);

  // Filter tabs for aging work
  const [agingFilter, setAgingFilter] = useState<'ALL' | 'INVESTIGATE' | 'BLOCKED' | 'DEV' | 'REVIEW' | 'QA'>('ALL');
  const [stageViewMode, setStageViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedStageCard, setSelectedStageCard] = useState<'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'UAT' | 'DONE' | null>(null);

  // Fetch status histories for completed and in-flight tasks
  useEffect(() => {
    let isMounted = true;
    const fetchHistories = async () => {
      if (!tasks || tasks.length === 0) return;
      setLoadingHistory(true);

      const tasksToFetch = tasks.slice(0, 40); // Priority fetch
      const historiesMap: Record<number, TaskHistoryItem[]> = { ...taskHistories };
      let loaded = 0;

      // Batch fetch in chunks of 5 to avoid flooding
      const chunkSize = 5;
      for (let i = 0; i < tasksToFetch.length; i += chunkSize) {
        if (!isMounted) break;
        const chunk = tasksToFetch.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (t) => {
            if (historiesMap[t.id]) {
              loaded++;
              return;
            }
            try {
              const res = await api.get(`/tasks/${t.id}/history`);
              if (res.data && Array.isArray(res.data)) {
                historiesMap[t.id] = res.data;
              } else {
                historiesMap[t.id] = [];
              }
            } catch {
              historiesMap[t.id] = [];
            }
            loaded++;
          })
        );
        if (isMounted) {
          setHistoryLoadedCount(loaded);
          setTaskHistories({ ...historiesMap });
        }
      }

      if (isMounted) {
        setLoadingHistory(false);
      }
    };

    fetchHistories();
    return () => {
      isMounted = false;
    };
  }, [tasks]);

  const isKanban = project?.projectType?.toUpperCase() === 'KANBAN' || sprints.length === 0;

  // Completed tasks in current scope
  const completedTasks = useMemo(() => {
    return tasks.filter(t => isTaskCompleted(t));
  }, [tasks]);

  // Stage breakdowns for completed tasks
  const completedBreakdowns = useMemo(() => {
    return completedTasks.map(t => ({
      task: t,
      breakdown: computeTaskStageBreakdown(t, taskHistories[t.id])
    }));
  }, [completedTasks, taskHistories]);


  // Array of cycle time days
  const cycleTimes = useMemo(() => {
    return completedBreakdowns.map(item => item.breakdown.totalCycleDays);
  }, [completedBreakdowns]);

  // Percentiles (7.2)
  const percentiles = useMemo(() => {
    return calculateCycleTimePercentiles(cycleTimes);
  }, [cycleTimes]);

  // Expected SLA threshold: either custom set or derived from P85 (defaulting to 5 days if low or no data)
  const effectiveExpectedDays = useMemo(() => {
    if (customExpectedDays !== null && customExpectedDays > 0) {
      return customExpectedDays;
    }
    if (percentiles.p85 > 0) {
      return Math.max(3, Math.ceil(percentiles.p85));
    }
    return 5; // Default reference as in user prompt: "Expected: <5 days"
  }, [customExpectedDays, percentiles.p85]);

  // Aggregate Stage Totals (7.1)
  const stageAggregates = useMemo(() => {
    const totalTasks = completedBreakdowns.length;
    if (totalTasks === 0) {
      return {
        todoAvg: 0,
        inProgAvg: 0,
        reviewAvg: 0,
        qaAvg: 0,
        blockedAvg: 0,
        doneAvg: 0,
        activeAvg: 0,
        waitingAvg: 0,
        totalCycleAvg: 0,
        flowEfficiency: 100,
        bottleneck: null as null | { stage: CycleStage; avgDays: number; pct: number; hint: string }
      };
    }

    const sum = (fn: (b: typeof completedBreakdowns[0]['breakdown']) => number) =>
      completedBreakdowns.reduce((acc, cur) => acc + fn(cur.breakdown), 0);

    const todoAvg = parseFloat((sum(b => b.todoDays) / totalTasks).toFixed(1));
    const inProgAvg = parseFloat((sum(b => b.inProgressDays) / totalTasks).toFixed(1));
    const reviewAvg = parseFloat((sum(b => b.reviewDays) / totalTasks).toFixed(1));
    const qaAvg = parseFloat((sum(b => b.qaDays) / totalTasks).toFixed(1));
    const blockedAvg = parseFloat((sum(b => b.blockedDays) / totalTasks).toFixed(1));
    const doneAvg = parseFloat((sum(b => b.doneDays) / totalTasks).toFixed(1));

    const activeAvg = parseFloat((inProgAvg + reviewAvg + qaAvg).toFixed(1));
    const waitingAvg = parseFloat((todoAvg + blockedAvg).toFixed(1));
    const totalCycleAvg = parseFloat((activeAvg + waitingAvg).toFixed(1)) || 0.1;

    const flowEfficiency = Math.min(100, Math.round((activeAvg / (activeAvg + waitingAvg || 1)) * 100));

    // Find bottleneck stage (stage with largest non-zero average duration)
    const stages: { stage: CycleStage; avgDays: number; hint: string }[] = [
      { stage: 'To Do', avgDays: todoAvg, hint: 'Tasks linger in the backlog before work begins. Consider reducing WIP or starting pull triggers.' },
      { stage: 'In Progress', avgDays: inProgAvg, hint: 'Execution time is high. Consider slicing stories smaller or pairing on complex tasks.' },
      { stage: 'Review', avgDays: reviewAvg, hint: 'Pull requests / peer reviews take long to approve. Schedule daily review blocks.' },
      { stage: 'QA', avgDays: qaAvg, hint: 'UAT latency is high. Verify user acceptance testing workflows and sign-offs.' },
      { stage: 'Blocked', avgDays: blockedAvg, hint: 'External dependencies or blockers impede velocity. Escalate blockers proactively.' }
    ];

    stages.sort((a, b) => b.avgDays - a.avgDays);
    const dominant = stages[0];
    const pct = totalCycleAvg > 0 ? Math.round((dominant.avgDays / totalCycleAvg) * 100) : 0;

    return {
      todoAvg,
      inProgAvg,
      reviewAvg,
      qaAvg,
      blockedAvg,
      doneAvg,
      activeAvg,
      waitingAvg,
      totalCycleAvg,
      flowEfficiency,
      bottleneck: dominant.avgDays > 0 ? { ...dominant, pct } : null
    };
  }, [completedBreakdowns]);

  // Aging Work (7.3)
  const agingTasks = useMemo(() => {
    return identifyAgingTasks(tasks, effectiveExpectedDays, taskHistories);
  }, [tasks, effectiveExpectedDays, taskHistories]);

  const filteredAgingTasks = useMemo(() => {
    return agingTasks.filter(item => {
      if (agingFilter === 'INVESTIGATE') return item.requiresInvestigation;
      if (agingFilter === 'BLOCKED') return item.isBlocked;
      if (agingFilter === 'DEV') return item.currentStage === 'In Progress';
      if (agingFilter === 'REVIEW') return item.currentStage === 'Review';
      if (agingFilter === 'QA') return item.currentStage === 'QA';
      return true;
    });
  }, [agingTasks, agingFilter]);

  const agingSummary = useMemo(() => {
    const totalOpen = agingTasks.length;
    const requiringInvestigation = agingTasks.filter(t => t.requiresInvestigation).length;
    const blockedCount = agingTasks.filter(t => t.isBlocked).length;
    const avgAge = totalOpen > 0
      ? parseFloat((agingTasks.reduce((acc, t) => acc + t.daysOpen, 0) / totalOpen).toFixed(1))
      : 0;
    const maxAge = totalOpen > 0
      ? Math.max(...agingTasks.map(t => t.daysOpen))
      : 0;

    return {
      totalOpen,
      requiringInvestigation,
      blockedCount,
      avgAge,
      maxAge
    };
  }, [agingTasks]);

  // Trend data for Line Chart (Scrum sprint trend or Kanban weekly trend)
  const cycleTimeTrendData = useMemo(() => {
    if (isKanban) {
      const weeks: { label: string; start: number; end: number; times: number[] }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - (i + 1) * 7);
        const end = new Date(now);
        end.setDate(now.getDate() - i * 7);

        let label = `${i} wks ago`;
        if (i === 0) label = 'This Week';
        else if (i === 1) label = '1 wk ago';

        weeks.push({
          label,
          start: start.getTime(),
          end: end.getTime(),
          times: []
        });
      }

      completedBreakdowns.forEach(({ task, breakdown }) => {
        const completionTime = task.completedAt
          ? new Date(task.completedAt).getTime()
          : (task.updatedAt ? new Date(task.updatedAt).getTime() : 0);
        if (!completionTime) return;

        for (const w of weeks) {
          if (completionTime >= w.start && completionTime < w.end) {
            w.times.push(breakdown.totalCycleDays);
            break;
          }
        }
      });

      return weeks.map(w => {
        const avg = w.times.length > 0 ? w.times.reduce((a, b) => a + b, 0) / w.times.length : 0;
        return {
          name: w.label,
          value: parseFloat(avg.toFixed(1))
        };
      });
    } else {
      // Scrum sprints
      const completedSprints = sprints.filter(s => s.status?.toUpperCase() === 'COMPLETED').slice(-6);
      if (completedSprints.length === 0 && sprints.length > 0) {
        return sprints.slice(-5).map(s => {
          const sTasks = sprintTasksMap[s.id] || [];
          const done = sTasks.filter(isTaskCompleted);
          const times = done.map(t => {
            const b = computeTaskStageBreakdown(t, taskHistories[t.id]);
            return b.totalCycleDays;
          });
          const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
          return { name: s.name, value: parseFloat(avg.toFixed(1)) };
        });
      }

      return completedSprints.map(s => {
        const sprintTasks = sprintTasksMap[s.id] || [];
        const doneTasks = sprintTasks.filter(isTaskCompleted);
        let avg = 0;
        if (doneTasks.length > 0) {
          const times = doneTasks.map(t => computeTaskStageBreakdown(t, taskHistories[t.id]).totalCycleDays);
          avg = times.reduce((a, b) => a + b, 0) / times.length;
        }
        return {
          name: s.name,
          value: parseFloat(avg.toFixed(1))
        };
      });
    }
  }, [isKanban, sprints, sprintTasksMap, completedBreakdowns, taskHistories]);

  // Distribution buckets (retained & polished)
  const cycleTimeDistribution = useMemo(() => {
    const buckets = {
      '0-1 Day': 0,
      '1-2 Days': 0,
      '2-3 Days': 0,
      '3-5 Days': 0,
      '5-8 Days': 0,
      '> 8 Days': 0
    };

    cycleTimes.forEach(d => {
      if (d <= 1) buckets['0-1 Day']++;
      else if (d <= 2) buckets['1-2 Days']++;
      else if (d <= 3) buckets['2-3 Days']++;
      else if (d <= 5) buckets['3-5 Days']++;
      else if (d <= 8) buckets['5-8 Days']++;
      else buckets['> 8 Days']++;
    });

    return Object.entries(buckets).map(([bucket, count]) => ({
      bucket,
      count
    }));
  }, [cycleTimes]);

  // Priority cycle time breakdown (Urgent, High, Medium, Low)
  const priorityAnalytics = useMemo(() => {
    const priorityDefs: {
      key: string;
      label: string;
      color: string;
      bgColor: string;
      barColor: string;
    }[] = [
        { key: 'URGENT', label: 'Urgent', color: '#DE350B', bgColor: 'bg-red-50 text-red-700 border-red-200', barColor: 'bg-red-500' },
        { key: 'HIGH', label: 'High', color: '#FF8B00', bgColor: 'bg-amber-50 text-amber-700 border-amber-200', barColor: 'bg-amber-500' },
        { key: 'MEDIUM', label: 'Medium', color: '#0052CC', bgColor: 'bg-blue-50 text-blue-700 border-blue-200', barColor: 'bg-blue-500' },
        { key: 'LOW', label: 'Low', color: '#42526E', bgColor: 'bg-slate-100 text-slate-700 border-slate-200', barColor: 'bg-slate-400' }
      ];

    const map: Record<string, { days: number[]; tasks: Task[] }> = {
      URGENT: { days: [], tasks: [] },
      HIGH: { days: [], tasks: [] },
      MEDIUM: { days: [], tasks: [] },
      LOW: { days: [], tasks: [] }
    };

    completedBreakdowns.forEach(({ task, breakdown }) => {
      const p = (task.priority || 'MEDIUM').toUpperCase();
      const norm = p === 'CRITICAL' || p === 'URGENT' ? 'URGENT' : (p === 'HIGH' ? 'HIGH' : (p === 'LOW' ? 'LOW' : 'MEDIUM'));
      map[norm].days.push(breakdown.totalCycleDays);
      map[norm].tasks.push(task);
    });

    const items = priorityDefs.map(def => {
      const list = map[def.key].days;
      const count = list.length;
      const sum = list.reduce((a, b) => a + b, 0);
      const avg = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;
      const sorted = [...list].sort((a, b) => a - b);
      const median = count > 0
        ? (count % 2 === 1 ? sorted[Math.floor(count / 2)] : parseFloat(((sorted[count / 2 - 1] + sorted[count / 2]) / 2).toFixed(1)))
        : 0;

      return {
        ...def,
        count,
        daysList: list,
        avgDays: avg,
        medianDays: median,
        tasks: map[def.key].tasks
      };
    });

    const maxAvg = Math.max(1, ...items.map(i => i.avgDays));

    return {
      items,
      maxAvg
    };
  }, [completedBreakdowns]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">



      {/* 7.1 SEPARATE WAITING TIME AND ACTIVE TIME */}
      <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1E6] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172B4D]">Time Spent by Stage</h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Stage Breakdown
              </span>
            </div>
            <p className="text-xs text-[#5E6C84] mt-0.5">
              Average duration tasks spend in each stage: To Do, In Progress, Review, UAT, and Done.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStageViewMode('CARDS')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${stageViewMode === 'CARDS' ? 'bg-[#1F6FEB] text-white' : 'bg-[#F4F5F7] text-[#42526E] hover:bg-slate-200'}`}
            >
              Stage Cards
            </button>
            <button
              onClick={() => setStageViewMode('TABLE')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${stageViewMode === 'TABLE' ? 'bg-[#1F6FEB] text-white' : 'bg-[#F4F5F7] text-[#42526E] hover:bg-slate-200'}`}
            >
              Task Breakdown Table
            </button>
          </div>
        </div>


        {/* 5 Stage Breakdown View */}
        {stageViewMode === 'CARDS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. To Do Time */}
            <div
              onClick={() => setSelectedStageCard(prev => prev === 'TODO' ? null : 'TODO')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${selectedStageCard === 'TODO'
                ? 'bg-amber-50/30 border-amber-500 ring-2 ring-amber-400 shadow-md'
                : 'bg-[#F8F9FA] border-[#DFE1E6] hover:border-amber-400 hover:shadow-sm'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider">1. To Do Time</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Waiting</span>
                </div>
                <div className="text-xl font-black text-[#172B4D]">{stageAggregates.todoAvg}d</div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  {stageAggregates.totalCycleAvg > 0 ? Math.round((stageAggregates.todoAvg / stageAggregates.totalCycleAvg) * 100) : 0}% of cycle
                </p>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, (stageAggregates.todoAvg / (stageAggregates.totalCycleAvg || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100 min-w-0">
                  <span className="text-[9.5px] text-[#6B778C] font-semibold truncate min-w-0" title="Queue / Ready to start">Queue / Ready to start</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#0052CC] group-hover:text-white transition-all inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap shrink-0">
                    View tasks &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* 2. In Progress Time */}
            <div
              onClick={() => setSelectedStageCard(prev => prev === 'IN_PROGRESS' ? null : 'IN_PROGRESS')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${selectedStageCard === 'IN_PROGRESS'
                ? 'bg-blue-50/30 border-blue-500 ring-2 ring-blue-400 shadow-md'
                : 'bg-[#F8F9FA] border-[#DFE1E6] hover:border-blue-400 hover:shadow-sm'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider">2. In Progress</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Active</span>
                </div>
                <div className="text-xl font-black text-[#172B4D]">{stageAggregates.inProgAvg}d</div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  {stageAggregates.totalCycleAvg > 0 ? Math.round((stageAggregates.inProgAvg / stageAggregates.totalCycleAvg) * 100) : 0}% of cycle
                </p>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (stageAggregates.inProgAvg / (stageAggregates.totalCycleAvg || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100 min-w-0">
                  <span className="text-[9.5px] text-[#6B778C] font-semibold truncate min-w-0" title="Active development">Active development</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#0052CC] group-hover:text-white transition-all inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap shrink-0">
                    View tasks &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Review Time */}
            <div
              onClick={() => setSelectedStageCard(prev => prev === 'REVIEW' ? null : 'REVIEW')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${selectedStageCard === 'REVIEW'
                ? 'bg-purple-50/30 border-purple-500 ring-2 ring-purple-400 shadow-md'
                : 'bg-[#F8F9FA] border-[#DFE1E6] hover:border-purple-400 hover:shadow-sm'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider">3. Review Time</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">Active</span>
                </div>
                <div className="text-xl font-black text-[#172B4D]">{stageAggregates.reviewAvg}d</div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  {stageAggregates.totalCycleAvg > 0 ? Math.round((stageAggregates.reviewAvg / stageAggregates.totalCycleAvg) * 100) : 0}% of cycle
                </p>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, (stageAggregates.reviewAvg / (stageAggregates.totalCycleAvg || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100 min-w-0">
                  <span className="text-[9.5px] text-[#6B778C] font-semibold truncate min-w-0" title="PR / Code approval">PR / Code approval</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#0052CC] group-hover:text-white transition-all inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap shrink-0">
                    View tasks &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* 4. UAT Time */}
            <div
              onClick={() => setSelectedStageCard(prev => prev === 'UAT' ? null : 'UAT')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${selectedStageCard === 'UAT'
                ? 'bg-teal-50/30 border-teal-500 ring-2 ring-teal-400 shadow-md'
                : 'bg-[#F8F9FA] border-[#DFE1E6] hover:border-teal-400 hover:shadow-sm'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider">4. UAT Time</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">Active</span>
                </div>
                <div className="text-xl font-black text-[#172B4D]">{stageAggregates.qaAvg}d</div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  {stageAggregates.totalCycleAvg > 0 ? Math.round((stageAggregates.qaAvg / stageAggregates.totalCycleAvg) * 100) : 0}% of cycle
                </p>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${Math.min(100, (stageAggregates.qaAvg / (stageAggregates.totalCycleAvg || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100 min-w-0">
                  <span className="text-[9.5px] text-[#6B778C] font-semibold truncate min-w-0" title="UAT / Testing">UAT / Testing</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#0052CC] group-hover:text-white transition-all inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap shrink-0">
                    View tasks &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Done */}
            <div
              onClick={() => setSelectedStageCard(prev => prev === 'DONE' ? null : 'DONE')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${selectedStageCard === 'DONE'
                ? 'bg-emerald-50/30 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                : 'bg-[#F8F9FA] border-[#DFE1E6] hover:border-emerald-400 hover:shadow-sm'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider">5. Done</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Resolved</span>
                </div>
                <div className="text-xl font-black text-emerald-900">{completedBreakdowns.length}</div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  Tasks delivered
                </p>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100 min-w-0">
                  <span className="text-[9.5px] text-[#6B778C] font-semibold truncate min-w-0" title="Target delivered">Target delivered</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#0052CC] group-hover:text-white transition-all inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap shrink-0">
                    View tasks &rarr;
                  </span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Table breakdown per task */
          <div className="overflow-x-auto border border-[#DFE1E6] rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6] text-[#5E6C84] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Task</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3 text-center">To Do</th>
                  <th className="py-2.5 px-3 text-center">In Progress</th>
                  <th className="py-2.5 px-3 text-center">Review</th>
                  <th className="py-2.5 px-3 text-center">UAT</th>
                  <th className="py-2.5 px-3 text-right">Cycle Time</th>
                  <th className="py-2.5 px-3 text-right">Flow Eff.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE1E6] bg-white">
                {completedBreakdowns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#5E6C84]">
                      No completed tasks found in the active scope.
                    </td>
                  </tr>
                ) : (
                  completedBreakdowns.slice(0, 15).map(({ task, breakdown }) => (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask?.(task.id)}
                      className="hover:bg-[#F4F5F7]/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-medium text-[#172B4D]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#1F6FEB]">
                            {getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}
                          </span>
                          <span className="truncate max-w-[200px]" title={task.title}>{task.title}</span>
                          {breakdown.hasHistory && (
                            <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-1 rounded border border-purple-200">
                              Audit Log
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#42526E]">
                        {task.assignee?.name || 'Unassigned'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">{breakdown.todoDays}d</td>
                      <td className="py-2.5 px-3 text-center text-blue-700 font-bold">{breakdown.inProgressDays}d</td>
                      <td className="py-2.5 px-3 text-center text-purple-700 font-semibold">{breakdown.reviewDays}d</td>
                      <td className="py-2.5 px-3 text-center text-teal-700 font-semibold">{breakdown.qaDays}d</td>
                      <td className="py-2.5 px-3 text-right font-black text-[#172B4D]">
                        {breakdown.totalCycleDays}d
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {breakdown.flowEfficiency}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Bottom Row - Distribution & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Cycle Time Distribution */}
        <div className="bg-white p-8 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[#172B4D]">Cycle Time Distribution</h3>
            <p className="text-[11px] text-[#5E6C84] mt-1">Breakdown of task delivery speeds across duration buckets</p>
          </div>
          <div className="flex items-end justify-between h-56 px-2 pt-8 pb-2">
            {cycleTimeDistribution.map((d, i) => {
              const maxCount = Math.max(...cycleTimeDistribution.map(x => x.count), 1);
              const barHeightPx = d.count > 0 ? Math.max(12, Math.round((d.count / maxCount) * 120)) : 2;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group justify-end">
                  <span className="text-[11px] font-bold text-[#172B4D]">{d.count}</span>
                  <div className="w-8 h-32 flex items-end justify-center relative">
                    <svg width="32" height="128" className="w-8 h-32 overflow-visible">
                      <rect
                        x="2"
                        y={128 - barHeightPx}
                        width="28"
                        height={barHeightPx}
                        fill={d.count > 0 ? '#1F6FEB' : '#E2E8F0'}
                        rx="2"
                        className="transition-all duration-300 hover:fill-[#0747A6]"
                      />
                    </svg>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#172B4D] text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                      {d.count} tasks in {d.bucket}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-[#5E6C84] mt-2 whitespace-nowrap uppercase tracking-tighter">{d.bucket}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Cycle Time by Priority */}
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#172B4D]">Cycle Time by Priority</h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Priority Breakdown
              </span>
            </div>
            <p className="text-[11px] text-[#5E6C84] mt-1">Average turnaround comparison across task priority levels</p>
          </div>

          <div className="space-y-4 my-auto py-4">
            {priorityAnalytics.items.map(p => {
              const barPercent = priorityAnalytics.maxAvg > 0 && p.count > 0
                ? Math.min(100, Math.max(10, (p.avgDays / priorityAnalytics.maxAvg) * 100))
                : 0;

              return (
                <div key={p.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-bold text-[#172B4D]">{p.label} Priority</span>
                      <span className="text-[10px] text-[#6B778C] font-semibold">
                        ({p.count} {p.count === 1 ? 'task' : 'tasks'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.count > 0 ? (
                        <span className="font-black text-[#172B4D] text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {p.avgDays}d avg
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-slate-400 italic">No resolved tasks</span>
                      )}
                    </div>
                  </div>

                  {/* Comparison Bar - SVG ensures print graphics retain fill */}
                  <div className="h-2.5 w-full rounded-full overflow-hidden">
                    <svg className="w-full h-2.5 rounded-full" style={{ height: '10px', display: 'block' }}>
                      <rect x="0" y="0" width="100%" height="10" fill="#F1F5F9" rx="5" />
                      {barPercent > 0 && (
                        <rect
                          x="0"
                          y="0"
                          width={`${barPercent}%`}
                          height="10"
                          fill={p.color}
                          rx="5"
                          className="transition-all duration-500"
                        />
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#F4F5F7] flex items-center justify-end text-[11px] text-[#6B778C]">
            <span className="font-semibold text-blue-600">Higher urgency tasks should resolve fastest</span>
          </div>
        </div>
      </div>

      {/* Modal Dialog for clicked Stage Card */}
      {selectedStageCard && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedStageCard(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE1E6] bg-[#F8F9FA]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#172B4D]">
                    {selectedStageCard === 'TODO' && '1. To Do Stage'}
                    {selectedStageCard === 'IN_PROGRESS' && '2. In Progress Stage'}
                    {selectedStageCard === 'REVIEW' && '3. Review Stage'}
                    {selectedStageCard === 'UAT' && '4. UAT Stage'}
                    {selectedStageCard === 'DONE' && '5. Delivered Tasks'}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedStageCard === 'TODO' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                    selectedStageCard === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                      selectedStageCard === 'REVIEW' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                        selectedStageCard === 'UAT' ? 'bg-teal-100 text-teal-900 border border-teal-200' :
                          'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                    Avg:{' '}
                    {selectedStageCard === 'TODO' ? `${stageAggregates.todoAvg}d` :
                      selectedStageCard === 'IN_PROGRESS' ? `${stageAggregates.inProgAvg}d` :
                        selectedStageCard === 'REVIEW' ? `${stageAggregates.reviewAvg}d` :
                          selectedStageCard === 'UAT' ? `${stageAggregates.qaAvg}d` :
                            `${stageAggregates.totalCycleAvg}d`}
                  </span>
                </div>
                <p className="text-[11px] text-[#5E6C84] mt-0.5">
                  {selectedStageCard === 'TODO' && 'Days each task spent waiting in backlog before work began'}
                  {selectedStageCard === 'IN_PROGRESS' && 'Days each task spent in active development'}
                  {selectedStageCard === 'REVIEW' && 'Days each task spent in PR / code review'}
                  {selectedStageCard === 'UAT' && 'Days each task spent in User Acceptance Testing'}
                  {selectedStageCard === 'DONE' && 'All completed tasks delivered'}
                </p>
              </div>

              <button
                onClick={() => setSelectedStageCard(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 text-sm font-bold transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Task List */}
            <div className="p-4 overflow-y-auto divide-y divide-slate-100">
              {completedBreakdowns.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5E6C84]">
                  No completed tasks found in this scope.
                </div>
              ) : (
                completedBreakdowns.map(({ task, breakdown }) => {
                  const stageDays =
                    selectedStageCard === 'TODO' ? breakdown.todoDays :
                      selectedStageCard === 'IN_PROGRESS' ? breakdown.inProgressDays :
                        selectedStageCard === 'REVIEW' ? breakdown.reviewDays :
                          selectedStageCard === 'UAT' ? breakdown.qaDays :
                            breakdown.totalCycleDays;

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedStageCard(null);
                        onSelectTask?.(task.id);
                      }}
                      className="py-3 px-3 rounded-xl hover:bg-[#F4F5F7] transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <span className="font-mono font-bold text-xs text-[#1F6FEB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                          {getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#172B4D] truncate group-hover:text-[#1F6FEB] transition-colors" title={task.title}>
                              {task.title}
                            </span>
                            {breakdown.hasHistory && (
                              <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.2 rounded border border-purple-200 shrink-0">
                                Audit Log
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#5E6C84]">
                            Assignee: {task.assignee?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`inline-block px-3 py-1 rounded-lg font-black text-xs ${selectedStageCard === 'TODO' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                          selectedStageCard === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                            selectedStageCard === 'REVIEW' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                              selectedStageCard === 'UAT' ? 'bg-teal-100 text-teal-900 border border-teal-200' :
                                'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}>
                          {stageDays}d
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#FAFBFC] border-t border-slate-100 flex items-center justify-between text-xs text-[#5E6C84]">
              <span>{completedBreakdowns.length} tasks completed</span>
              <button
                onClick={() => setSelectedStageCard(null)}
                className="px-4 py-1.5 bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
