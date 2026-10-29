import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Briefcase,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowUpDown,
  BatteryCharging,
  Calendar,
  Flame,
  UserX,
  ExternalLink,
  ShieldAlert,
  Percent,
  CheckSquare,
  Table,
  List,
  X
} from 'lucide-react';
import type { Task, Sprint, User as UserType, Project, TeamCapacity } from '../types';
import velocityService from '../services/velocityService';

interface ResourceWorkloadAnalyticsProps {
  projectId: number;
  selectedSprintId?: number | 'all';
  sprints?: Sprint[];
  sprintTasksMap?: Record<number, Task[]>;
  tasks: Task[];
  users: UserType[];
  project?: Project | null;
  onSelectTask?: (taskId: number) => void;
}

export type WorkloadStatusType = 'OVERLOADED' | 'OPTIMAL' | 'UNDER_UTILIZED' | 'COMPLETED' | 'IDLE';

export interface MemberMetrics {
  user: UserType;
  assignedTasksCount: number;
  completedTasksCount: number;
  assignedPoints: number;
  completedPoints: number;
  remainingPoints: number;
  estimatedHours: number;
  loggedHours: number;
  remainingHours: number;
  overdueTasksCount: number;
  blockedTasksCount: number;
  utilizationRate: number; // Completed / Assigned % (as in user prompt example)
  capacityUtilization: number | null; // Assigned / Capacity %
  workloadStatus: WorkloadStatusType;
  statusLabel: string;
  memberCapacitySp: number;
  memberCapacityHours: number;
  tasks: Task[];
  overdueTasks: Task[];
  blockedTasks: Task[];
}

export const ResourceWorkloadAnalytics: React.FC<ResourceWorkloadAnalyticsProps> = ({
  projectId,
  selectedSprintId,
  sprints = [],
  sprintTasksMap = {},
  tasks,
  users,
  project,
  onSelectTask
}) => {
  // State
  const [capacity, setCapacity] = useState<TeamCapacity | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkloadStatusType>('ALL');
  const [viewUnit, setViewUnit] = useState<'POINTS' | 'HOURS'>('POINTS');
  const [sortBy, setSortBy] = useState<'POINTS' | 'UTILIZATION' | 'OVERDUE' | 'NAME'>('POINTS');
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(false);
  const [displayMode, setDisplayMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Active sprint details
  const activeSprint = useMemo(() => {
    if (selectedSprintId && selectedSprintId !== 'all') {
      return sprints.find(s => s.id === selectedSprintId) || null;
    }
    return sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') || null;
  }, [sprints, selectedSprintId]);

  // Load team capacity from API
  useEffect(() => {
    let isMounted = true;
    const fetchCap = async () => {
      if (!projectId) return;
      setLoadingCapacity(true);
      try {
        const sprintId = selectedSprintId && selectedSprintId !== 'all' ? Number(selectedSprintId) : null;
        const cap = await velocityService.getTeamCapacity(projectId, sprintId);
        if (isMounted) setCapacity(cap);
      } catch (err) {
        console.warn('Could not load team capacity in ResourceWorkloadAnalytics:', err);
      } finally {
        if (isMounted) setLoadingCapacity(false);
      }
    };
    fetchCap();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedSprintId]);

  // Helper: check if task is completed
  const isDone = (t: Task | any): boolean => {
    if (!t) return false;
    if (t.completed === true || Boolean(t.completedAt)) return true;
    const s = (t.status || '').toUpperCase().replace(/_/g, ' ').trim();
    return s === 'DONE' || s === 'COMPLETED' || s === 'CLOSED' || s === 'RESOLVED' || s === 'FINISHED';
  };

  // Helper: check if task is blocked
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

  // Helper: check if task is overdue
  const isOverdueTask = (t: Task): boolean => {
    if (!t.dueDate || isDone(t)) return false;
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Helper: parse textual estimate into hours
  const parseEstimateHours = (est?: string): number => {
    if (!est) return 0;
    let total = 0;
    const dMatch = est.match(/(\d+)\s*d/i);
    const hMatch = est.match(/(\d+)\s*h/i);
    const mMatch = est.match(/(\d+)\s*m/i);
    if (dMatch) total += parseInt(dMatch[1], 10) * 8;
    if (hMatch) total += parseInt(hMatch[1], 10);
    if (mMatch) total += parseInt(mMatch[1], 10) / 60;
    return total;
  };

  // Unified list of all team members (from project members, lead, and task assignees)
  const allMembers = useMemo(() => {
    const map = new Map<string, UserType>();

    // If project has team members or creator defined, strictly use project members
    if (project && (project.createdBy || (project.teamMembers && project.teamMembers.length > 0))) {
      if (project.createdBy) {
        const key = String(project.createdBy.id || project.createdBy.email || project.createdBy.name);
        map.set(key, project.createdBy);
      }
      (project.teamMembers || []).forEach(m => {
        const key = String(m.id || m.email || m.name);
        map.set(key, m);
      });
    } else {
      users.forEach(u => {
        const key = String(u.id || u.email || u.name);
        map.set(key, u);
      });
    }

    // Always include any task assignees who have tasks in this project
    tasks.forEach(t => {
      if (t.assignee && t.assignee.name) {
        const key = String(t.assignee.id || t.assignee.email || t.assignee.name);
        if (!map.has(key)) {
          map.set(key, t.assignee);
        }
      }
    });
    return Array.from(map.values());
  }, [project, users, tasks]);

  // Unassigned tasks
  const unassignedTasks = useMemo(() => {
    return tasks.filter(t => !t.assignee && !t.assigneeId);
  }, [tasks]);

  const unassignedPoints = useMemo(() => {
    return unassignedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  }, [unassignedTasks]);

  const unassignedHours = useMemo(() => {
    return unassignedTasks.reduce((sum, t) => {
      if (t.originalEstimateSeconds && t.originalEstimateSeconds > 0) return sum + (t.originalEstimateSeconds / 3600);
      if (t.originalEstimate) return sum + parseEstimateHours(t.originalEstimate);
      return sum;
    }, 0);
  }, [unassignedTasks]);

  // Compute metrics per team member
  const memberMetricsList: MemberMetrics[] = useMemo(() => {
    const hoursPerSp = capacity?.hoursPerStoryPoint || 8;
    const workingDays = capacity?.workingDays || 10;
    const defaultDailyHours = 8;
    const defaultMemberCapacityHours = workingDays * defaultDailyHours;
    const defaultMemberCapacitySp = Math.round(defaultMemberCapacityHours / hoursPerSp);

    return allMembers.map(u => {
      // Find tasks assigned to this user
      const userTasks = tasks.filter(t => {
        if (t.assigneeId === u.id) return true;
        if (t.assignee?.id === u.id) return true;
        if (u.email && t.assignee?.email && t.assignee.email.toLowerCase() === u.email.toLowerCase()) return true;
        if (u.name && t.assignee?.name && t.assignee.name.toLowerCase() === u.name.toLowerCase()) return true;
        return false;
      });

      const assignedTasksCount = userTasks.length;
      const completedTasks = userTasks.filter(isDone);
      const completedTasksCount = completedTasks.length;
      const activeTasks = userTasks.filter(t => !isDone(t));

      const assignedPoints = userTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const remainingPoints = Math.max(0, assignedPoints - completedPoints);

      // Hours calculations (strictly as per task original estimates)
      const estimatedHours = userTasks.reduce((sum, t) => {
        if (t.originalEstimateSeconds && t.originalEstimateSeconds > 0) {
          return sum + (t.originalEstimateSeconds / 3600);
        }
        if (t.originalEstimate) {
          return sum + parseEstimateHours(t.originalEstimate);
        }
        return sum;
      }, 0);

      const loggedHours = userTasks.reduce((sum, t) => {
        return sum + ((t.timeSpentSeconds || 0) / 3600);
      }, 0);

      const remainingHours = userTasks.reduce((sum, t) => {
        if (isDone(t)) return sum;
        if (t.remainingEstimateSeconds !== undefined && t.remainingEstimateSeconds !== null) {
          return sum + (t.remainingEstimateSeconds / 3600);
        }
        const taskEst = t.originalEstimateSeconds
          ? (t.originalEstimateSeconds / 3600)
          : (t.originalEstimate ? parseEstimateHours(t.originalEstimate) : 0);
        const taskSpent = (t.timeSpentSeconds || 0) / 3600;
        return sum + Math.max(0, taskEst - taskSpent);
      }, 0);

      // Overdue & Blocked
      const overdueTasks = userTasks.filter(t => isOverdueTask(t));
      const blockedTasks = userTasks.filter(t => isBlockedTask(t));

      // Member Capacity from backend or defaults
      const capMember = capacity?.memberCapacities?.find(
        m => (u.empId && m.empId === u.empId) || (u.name && m.memberName?.toLowerCase() === u.name.toLowerCase())
      );

      const memberCapacitySp = capMember?.storyPointsCapacity && capMember.storyPointsCapacity > 0
        ? capMember.storyPointsCapacity
        : defaultMemberCapacitySp;

      const memberCapacityHours = capMember?.availableHours && capMember.availableHours > 0
        ? capMember.availableHours
        : defaultMemberCapacityHours;

      // Utilization rates
      // Utilization Rate = Completed / Assigned % (as in user prompt example: 18 SP / 24 SP = 75%)
      const utilizationRate = assignedPoints > 0
        ? Math.round((completedPoints / assignedPoints) * 100)
        : (assignedTasksCount > 0 && completedTasksCount === assignedTasksCount ? 100 : 0);

      const capacityUtilization = memberCapacitySp > 0
        ? Math.round((assignedPoints / memberCapacitySp) * 100)
        : null;

      // Workload Status Classification
      let workloadStatus: WorkloadStatusType = 'OPTIMAL';
      let statusLabel = 'Optimal';

      if (assignedTasksCount === 0) {
        workloadStatus = 'IDLE';
        statusLabel = 'Available / Idle';
      } else if (assignedPoints > 0 && completedPoints === assignedPoints) {
        workloadStatus = 'COMPLETED';
        statusLabel = 'Completed';
      } else if (capacityUtilization !== null && capacityUtilization > 115) {
        workloadStatus = 'OVERLOADED';
        statusLabel = 'Overloaded';
      } else if (capacityUtilization === null && assignedPoints > 20) {
        workloadStatus = 'OVERLOADED';
        statusLabel = 'Overloaded';
      } else if (capacityUtilization !== null && capacityUtilization < 70) {
        workloadStatus = 'UNDER_UTILIZED';
        statusLabel = 'Under-utilized';
      } else if (capacityUtilization === null && assignedPoints < 8) {
        workloadStatus = 'UNDER_UTILIZED';
        statusLabel = 'Under-utilized';
      } else {
        workloadStatus = 'OPTIMAL';
        statusLabel = 'Optimal';
      }

      return {
        user: u,
        assignedTasksCount,
        completedTasksCount,
        assignedPoints,
        completedPoints,
        remainingPoints,
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        loggedHours: Math.round(loggedHours * 10) / 10,
        remainingHours: Math.round(remainingHours * 10) / 10,
        overdueTasksCount: overdueTasks.length,
        blockedTasksCount: blockedTasks.length,
        utilizationRate,
        capacityUtilization,
        workloadStatus,
        statusLabel,
        memberCapacitySp,
        memberCapacityHours,
        tasks: userTasks,
        overdueTasks,
        blockedTasks
      };
    });
  }, [allMembers, tasks, capacity]);

  // Team-Level Aggregate Metrics
  const teamMetrics = useMemo(() => {
    const totalTeamCapacitySp = capacity?.capacityStoryPoints && capacity.capacityStoryPoints > 0
      ? capacity.capacityStoryPoints
      : memberMetricsList.reduce((sum, m) => sum + m.memberCapacitySp, 0);

    const totalTeamCapacityHours = capacity?.totalAvailableHours && capacity.totalAvailableHours > 0
      ? capacity.totalAvailableHours
      : memberMetricsList.reduce((sum, m) => sum + m.memberCapacityHours, 0);

    const totalAssignedPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const totalAssignedTasks = tasks.length;

    const totalCompletedTasks = tasks.filter(isDone).length;
    const totalCompletedPoints = tasks.filter(isDone).reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const totalRemainingPoints = Math.max(0, totalAssignedPoints - totalCompletedPoints);

    const totalCompletionRate = totalAssignedPoints > 0
      ? Math.round((totalCompletedPoints / totalAssignedPoints) * 100)
      : (totalAssignedTasks > 0 ? Math.round((totalCompletedTasks / totalAssignedTasks) * 100) : 0);

    const totalAssignedHours = memberMetricsList.reduce((sum, m) => sum + m.estimatedHours, 0) + unassignedHours;
    const totalLoggedHours = memberMetricsList.reduce((sum, m) => sum + m.loggedHours, 0);

    const overloadedMembers = memberMetricsList.filter(m => m.workloadStatus === 'OVERLOADED');
    const underutilizedMembers = memberMetricsList.filter(m => m.workloadStatus === 'UNDER_UTILIZED' || m.workloadStatus === 'IDLE');
    const optimalMembers = memberMetricsList.filter(m => m.workloadStatus === 'OPTIMAL' || m.workloadStatus === 'COMPLETED');

    const totalOverdueCount = tasks.filter(isOverdueTask).length;
    const totalBlockedCount = tasks.filter(isBlockedTask).length;

    // Capacity Commitment %
    const capacityCommitmentPct = totalTeamCapacitySp > 0
      ? Math.round((totalAssignedPoints / totalTeamCapacitySp) * 100)
      : 0;

    return {
      totalTeamCapacitySp: Math.round(totalTeamCapacitySp),
      totalTeamCapacityHours: Math.round(totalTeamCapacityHours),
      totalAssignedPoints,
      totalAssignedTasks,
      totalCompletedPoints,
      totalCompletedTasks,
      totalRemainingPoints,
      totalCompletionRate,
      totalAssignedHours: Math.round(totalAssignedHours * 10) / 10,
      totalLoggedHours: Math.round(totalLoggedHours * 10) / 10,
      unassignedTasksCount: unassignedTasks.length,
      unassignedPoints,
      unassignedHours: Math.round(unassignedHours * 10) / 10,
      overloadedCount: overloadedMembers.length,
      overloadedMembers,
      underutilizedCount: underutilizedMembers.length,
      underutilizedMembers,
      optimalCount: optimalMembers.length,
      totalOverdueCount,
      totalBlockedCount,
      capacityCommitmentPct
    };
  }, [capacity, memberMetricsList, tasks, unassignedTasks, unassignedPoints, unassignedHours]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    let result = [...memberMetricsList];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m =>
        (m.user.name && m.user.name.toLowerCase().includes(q)) ||
        (m.user.email && m.user.email.toLowerCase().includes(q)) ||
        (m.user.empId && m.user.empId.toLowerCase().includes(q)) ||
        (m.user.department && m.user.department.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(m => m.workloadStatus === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'POINTS') {
        return b.assignedPoints - a.assignedPoints;
      }
      if (sortBy === 'UTILIZATION') {
        return b.utilizationRate - a.utilizationRate;
      }
      if (sortBy === 'OVERDUE') {
        const aRisk = a.overdueTasksCount * 2 + a.blockedTasksCount;
        const bRisk = b.overdueTasksCount * 2 + b.blockedTasksCount;
        return bRisk - aRisk;
      }
      if (sortBy === 'NAME') {
        return (a.user.name || '').localeCompare(b.user.name || '');
      }
      return 0;
    });

    return result;
  }, [memberMetricsList, searchQuery, statusFilter, sortBy]);

  const toggleExpand = (id: string) => {
    setExpandedMemberIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getStatusBadgeStyle = (status: WorkloadStatusType) => {
    switch (status) {
      case 'OVERLOADED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'OPTIMAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UNDER_UTILIZED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IDLE':
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusDotColor = (status: WorkloadStatusType) => {
    switch (status) {
      case 'OVERLOADED':
        return 'bg-rose-500';
      case 'OPTIMAL':
        return 'bg-emerald-500';
      case 'UNDER_UTILIZED':
        return 'bg-amber-500';
      case 'COMPLETED':
        return 'bg-blue-500';
      case 'IDLE':
      default:
        return 'bg-gray-400';
    }
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-600 to-indigo-600 text-white',
      'from-emerald-600 to-teal-600 text-white',
      'from-violet-600 to-purple-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-rose-500 to-pink-600 text-white',
      'from-sky-500 to-cyan-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ========================================================================= */}
      {/* 2. TEAM-LEVEL VIEW: 6 EXECUTIVE KPIS */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase size={14} className="text-[#1F6FEB]" />
            Team-Level Capacity & Workload View
          </h3>
          <span className="text-[11px] text-[#6B778C]">
            {memberMetricsList.length} Team Members • {tasks.length} Total Tasks
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Team Capacity */}
          <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] shadow-xs hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">
                Total Team Members
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-50 text-[#1F6FEB] flex items-center justify-center">
                <Users size={13} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#172B4D]">
                {allMembers.length}
              </span>
              <span className="text-xs font-bold text-[#5E6C84]">
                Members
              </span>
            </div>
            <p className="text-[10.5px] text-[#6B778C] mt-1 truncate">
              Active team size
            </p>
          </div>

          {/* Card 2: Total Assigned Work */}
          <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] shadow-xs hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">
                Total Assigned Work
              </span>
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CheckSquare size={13} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#172B4D]">
                {viewUnit === 'POINTS' ? `${teamMetrics.totalAssignedPoints}` : `${teamMetrics.totalAssignedHours}`}
              </span>
              <span className="text-xs font-bold text-[#5E6C84]">
                {viewUnit === 'POINTS' ? 'SP' : 'hrs'}
              </span>
              <span className="text-[10.5px] text-[#6B778C] ml-auto">
                {teamMetrics.totalAssignedTasks} tasks
              </span>
            </div>
            <p className="text-[10.5px] text-[#6B778C] mt-1 truncate">
              Workload allocated
            </p>
          </div>

          {/* Card 3: Total Completed Work */}
          <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] shadow-xs hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">
                Total Completed Work
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-[#10B981] flex items-center justify-center">
                <CheckCircle2 size={13} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#10B981]">
                {viewUnit === 'POINTS' ? `${teamMetrics.totalCompletedPoints}` : `${teamMetrics.totalLoggedHours}`}
              </span>
              <span className="text-xs font-bold text-[#5E6C84]">
                {viewUnit === 'POINTS' ? 'SP' : 'hrs'}
              </span>
              <span className="text-[10.5px] text-[#6B778C] ml-auto">
                {teamMetrics.totalCompletedTasks} done
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-[#EBECF0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full"
                  style={{ width: `${Math.min(100, teamMetrics.totalCompletionRate)}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-bold text-[#10B981]">
                {teamMetrics.totalCompletionRate}%
              </span>
            </div>
          </div>

          {/* Card 4: Unassigned Work */}
          <div
            onClick={() => setIsUnassignedExpanded(prev => !prev)}
            className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">
                Unassigned Work
              </span>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${teamMetrics.unassignedTasksCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                }`}>
                <UserX size={13} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-black ${teamMetrics.unassignedTasksCount > 0 ? 'text-amber-600' : 'text-[#172B4D]'
                }`}>
                {teamMetrics.unassignedTasksCount}
              </span>
              <span className="text-xs font-bold text-[#5E6C84]">Tasks</span>
              <span className="text-[11px] font-bold text-amber-700 ml-auto bg-amber-50 px-1.5 py-0.5 rounded">
                {viewUnit === 'POINTS' ? `${teamMetrics.unassignedPoints} SP` : `${teamMetrics.unassignedHours}h`}
              </span>
            </div>
            <p className="text-[10px] text-[#6B778C] mt-1 flex items-center justify-between">
              <span>{teamMetrics.unassignedTasksCount > 0 ? 'Requires allocation' : 'All work assigned'}</span>
              <span className="text-[9.5px] text-[#1F6FEB] font-bold group-hover:underline">
                {isUnassignedExpanded ? 'Hide' : 'View'}
              </span>
            </p>
          </div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 4. UNASSIGNED WORK DRAWER (If expanded or unassigned tasks exist) */}
      {/* ========================================================================= */}
      {isUnassignedExpanded && (
        <div className="bg-amber-50/60 p-5 rounded-xl border border-amber-200 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <h4 className="text-sm font-bold text-[#172B4D]">
                Unassigned Work Queue ({unassignedTasks.length} {unassignedTasks.length === 1 ? 'Task' : 'Tasks'} • {unassignedPoints} SP)
              </h4>
            </div>
            <button
              onClick={() => setIsUnassignedExpanded(false)}
              className="text-xs font-bold text-[#5E6C84] hover:text-[#172B4D]"
            >
              Close
            </button>
          </div>

          {unassignedTasks.length === 0 ? (
            <p className="text-xs text-[#5E6C84]">All tasks in this scope are assigned to team members.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-amber-200 text-[#5E6C84] font-bold">
                    <th className="pb-2">Key / Title</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2 text-right">Story Points</th>
                    <th className="pb-2 text-right">Estimated Effort</th>
                    <th className="pb-2 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {unassignedTasks.map(t => (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTask && onSelectTask(t.id)}
                      className="hover:bg-amber-100/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-3 font-semibold text-[#172B4D]">
                        <span className="text-[#1F6FEB] font-bold mr-2">#{t.id}</span>
                        {t.title}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-[#42526E]">
                          {t.status || 'Todo'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.priority === 'HIGH'
                          ? 'bg-red-100 text-red-700'
                          : t.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                          {t.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-black text-[#172B4D]">
                        {t.storyPoints || 0} SP
                      </td>
                      <td className="py-2 pr-3 text-right text-[#5E6C84]">
                        {t.originalEstimateSeconds ? `${Math.round(t.originalEstimateSeconds / 3600)}h` : t.originalEstimate || '—'}
                      </td>
                      <td className="py-2 text-right text-[#5E6C84]">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FILTER & SEARCH TOOLBAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search member name, email or department..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
            <Users size={12} className="text-slate-500" />
            <span>{filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}</span>
          </span>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setDisplayMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${displayMode === 'TABLE'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Users size={13} />
              <span>Team View</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${displayMode === 'CARDS'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <User size={13} />
              <span>Member View</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. TEAM MEMBER METRICS CARDS (DETAILED BREAKDOWN) */}
      {/* ========================================================================= */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center shadow-xs">
          <Users size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">No team members match the filter criteria</p>
          <p className="text-xs text-slate-500 mt-1">Try resetting the status filter or clearing the search query.</p>
        </div>
      ) : displayMode === 'TABLE' ? (
        /* ALL-IN-ONE TABLE UI */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Team Member</th>
                  <th className="py-3.5 px-3 min-w-[170px] font-semibold">Workload</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Assigned Tasks</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Story Points</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Completed / Rem</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Effort (Est/Log)</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Remaining</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map(member => {
                  const isExpanded = !!expandedMemberIds[String(member.user.id || member.user.name)];
                  const userInitial = (member.user.name || 'U')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  const hasWork = member.assignedTasksCount > 0;
                  const completionPercent = member.assignedPoints > 0
                    ? (member.completedPoints / member.assignedPoints) * 100
                    : (member.assignedTasksCount > 0 ? (member.completedTasksCount / member.assignedTasksCount) * 100 : 0);

                  const activePercent = 100 - completionPercent;

                  return (
                    <React.Fragment key={member.user.id || member.user.name}>
                      <tr className="hover:bg-slate-50/70 transition-colors group">
                        {/* Member */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(member.user.name || '')} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ring-2 ring-white`}>
                              {userInitial}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {member.user.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                {member.user.role || 'Member'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Workload & Utilization */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="font-bold text-slate-900">{member.utilizationRate}%</span>
                              <span className="text-[11px] font-medium text-slate-500">({member.completedPoints}/{member.assignedPoints} SP)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                              {completionPercent > 0 && (
                                <div
                                  className="h-full bg-emerald-500 transition-all rounded-full"
                                  style={{ width: `${completionPercent}%` }}
                                  title={`Completed: ${member.completedPoints} SP`}
                                ></div>
                              )}
                              {activePercent > 0 && hasWork && (
                                <div
                                  className="h-full bg-blue-500 transition-all rounded-full"
                                  style={{ width: `${activePercent}%` }}
                                  title={`Remaining: ${member.remainingPoints} SP`}
                                ></div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assigned Tasks */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 block tabular-nums">{member.assignedTasksCount} tasks</span>
                          <span className="text-[10.5px] text-emerald-600 font-semibold">{member.completedTasksCount} done</span>
                        </td>

                        {/* Story Points */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 block tabular-nums">{member.assignedPoints} SP</span>
                          <span className="text-[10.5px] text-slate-400 font-medium">allocated</span>
                        </td>

                        {/* Completed / Remaining */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 tabular-nums font-bold">
                            <span className="text-emerald-600">{member.completedPoints}</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-blue-600">{member.remainingPoints} SP</span>
                          </div>
                          <span className="text-[10.5px] text-slate-400 font-medium">{member.remainingPoints} pending</span>
                        </td>

                        {/* Estimated / Logged */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 block tabular-nums">{member.estimatedHours}h est</span>
                          <span className="text-[10.5px] text-emerald-600 font-semibold tabular-nums">{member.loggedHours}h logged</span>
                        </td>

                        {/* Remaining Hours */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 block tabular-nums">{member.remainingHours}h</span>
                          <span className="text-[10.5px] text-slate-400 font-medium">effort left</span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(String(member.user.id || member.user.name))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${isExpanded
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs hover:bg-blue-700'
                                : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200/90 hover:border-blue-200 shadow-2xs'
                              }`}
                          >
                            <span>{isExpanded ? 'Hide' : 'Tasks'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Task Detail Table */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-slate-50/70 border-b border-slate-200/80">
                            <div className="p-4 pl-12 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <CheckSquare size={13} />
                                  </div>
                                  Tasks assigned to {member.user.name}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/70 text-blue-700">
                                    {member.tasks.length}
                                  </span>
                                </h5>
                              </div>
                              {member.tasks.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">No tasks assigned to this team member.</p>
                              ) : (
                                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold text-[10.5px] uppercase tracking-wider">
                                        <th className="py-2.5 px-3">Key & Title</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Priority</th>
                                        <th className="py-2.5 px-3 text-right">Story Points</th>
                                        <th className="py-2.5 px-3 text-right">Effort (Est / Logged)</th>
                                        <th className="py-2.5 px-3 text-right">Due Date</th>
                                        <th className="py-2.5 px-3 text-right">Flags</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {member.tasks.map(t => {
                                        const tDone = isDone(t);
                                        const tOverdue = isOverdueTask(t);
                                        const tBlocked = isBlockedTask(t);
                                        return (
                                          <tr
                                            key={t.id}
                                            onClick={() => onSelectTask && onSelectTask(t.id)}
                                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                                          >
                                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                                              <span className="text-blue-600 font-bold mr-1.5">#{t.id}</span>
                                              {t.title}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                                                {t.status || 'Todo'}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${t.priority === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-200/60' : t.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                                }`}>
                                                {t.priority || 'MEDIUM'}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                              {t.storyPoints || 0} SP
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">
                                              {t.originalEstimateSeconds ? `${Math.round(t.originalEstimateSeconds / 3600)}h` : t.originalEstimate || '—'} / {Math.round((t.timeSpentSeconds || 0) / 360) / 10}h
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">
                                              {t.dueDate ? (
                                                <span className={tOverdue ? 'text-red-600 font-bold' : ''}>
                                                  {new Date(t.dueDate).toLocaleDateString()}
                                                </span>
                                              ) : '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                              <div className="flex items-center justify-end gap-1">
                                                {tOverdue && (
                                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[9.5px]">
                                                    Overdue
                                                  </span>
                                                )}
                                                {tBlocked && (
                                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[9.5px]">
                                                    Blocked
                                                  </span>
                                                )}
                                                {!tOverdue && !tBlocked && tDone && (
                                                  <span className="text-emerald-600 font-bold text-[10px]">
                                                    ✓ Done
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMembers.map(member => {
            const isExpanded = !!expandedMemberIds[String(member.user.id || member.user.name)];
            const userInitial = (member.user.name || 'U')
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const hasWork = member.assignedTasksCount > 0;
            const completionPercent = member.assignedPoints > 0
              ? (member.completedPoints / member.assignedPoints) * 100
              : (member.assignedTasksCount > 0 ? (member.completedTasksCount / member.assignedTasksCount) * 100 : 0);

            const activePercent = 100 - completionPercent;

            return (
              <div
                key={member.user.id || member.user.name}
                className="bg-white rounded-xl border border-[#DFE1E6] shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Member Card Header */}
                <div className="p-4 sm:p-5 border-b border-[#EBECF0]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Avatar + Name + Workload Status */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#DEEBFF] text-[#1F6FEB] font-black text-xs flex items-center justify-center border-2 border-white shadow-xs shrink-0">
                        {userInitial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#172B4D]">
                            {member.user.name}
                          </h4>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${getStatusBadgeStyle(member.workloadStatus)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(member.workloadStatus)}`}></span>
                            {member.statusLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B778C] font-semibold mt-0.5">
                          {member.user.role || 'Team Member'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Quick Delivery Rate & SP Badge */}
                    <div className="flex items-center gap-4 sm:text-right">
                      <div>
                        <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                          Utilization Rate
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 sm:justify-end">
                          <span className="text-lg font-black text-[#172B4D]">
                            {member.utilizationRate}%
                          </span>
                          <span className="text-[11px] text-[#5E6C84]">
                            ({member.completedPoints} / {member.assignedPoints} SP)
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleExpand(String(member.user.id || member.user.name))}
                        className="px-2.5 py-1.5 rounded-lg border border-[#DFE1E6] hover:bg-[#F4F5F7] text-[#42526E] text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className="hidden sm:inline">{isExpanded ? 'Hide Tasks' : 'View Tasks'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Progress Bar */}
                  <div className="mt-3.5 space-y-1">
                    <div className="h-2.5 bg-[#F4F5F7] rounded-full overflow-hidden flex shadow-inner">
                      {completionPercent > 0 && (
                        <div
                          className="h-full bg-[#10B981] transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${completionPercent}%` }}
                          title={`Completed: ${member.completedPoints} SP (${Math.round(completionPercent)}%)`}
                        ></div>
                      )}
                      {activePercent > 0 && hasWork && (
                        <div
                          className="h-full bg-[#1F6FEB] transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${activePercent}%` }}
                          title={`Remaining: ${member.remainingPoints} SP (${Math.round(activePercent)}%)`}
                        ></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* Exact Required 11 Team Member Metrics Grid */}
                {/* ============================================================= */}
                <div className="p-4 sm:p-5 bg-[#FAFBFC] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  {/* Metric 1 & 2: Assigned & Completed Tasks */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#EBECF0]">
                    <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                      Assigned Tasks
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-base font-black text-[#172B4D]">{member.assignedTasksCount}</span>
                      <span className="text-[10.5px] text-[#6B778C]">tasks</span>
                    </div>
                    <span className="text-[10.5px] text-[#10B981] font-bold block mt-0.5">
                      {member.completedTasksCount} completed
                    </span>
                  </div>

                  {/* Metric 3: Story Points (Assigned) */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#EBECF0]">
                    <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                      Story Points
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-base font-black text-[#172B4D]">{member.assignedPoints}</span>
                      <span className="text-[10.5px] text-[#6B778C]">SP</span>
                    </div>
                    <span className="text-[10.5px] text-[#6B778C] font-semibold block mt-0.5">
                      Workload allocated
                    </span>
                  </div>

                  {/* Metric 4 & 5: Completed & Remaining Points */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#EBECF0]">
                    <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                      Completed / Remaining
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-base font-black text-[#10B981]">{member.completedPoints}</span>
                      <span className="text-xs text-[#5E6C84]">/</span>
                      <span className="text-base font-black text-[#1F6FEB]">{member.remainingPoints}</span>
                      <span className="text-[10.5px] text-[#6B778C]">SP</span>
                    </div>
                    <span className="text-[10.5px] text-[#5E6C84] font-semibold block mt-0.5">
                      {member.remainingPoints} SP pending
                    </span>
                  </div>

                  {/* Metric 6 & 7: Estimated & Logged Hours */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#EBECF0]">
                    <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                      Estimated / Logged
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-base font-black text-[#172B4D]">{member.estimatedHours}h</span>
                      <span className="text-[10.5px] text-[#6B778C]">est</span>
                    </div>
                    <span className="text-[10.5px] text-[#10B981] font-bold block mt-0.5">
                      {member.loggedHours}h logged
                    </span>
                  </div>

                  {/* Metric 8: Remaining Hours */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#EBECF0]">
                    <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider block">
                      Remaining Hours
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-base font-black text-[#172B4D]">{member.remainingHours}h</span>
                      <span className="text-[10.5px] text-[#6B778C]">rem</span>
                    </div>
                    <span className="text-[10.5px] text-[#5E6C84] font-semibold block mt-0.5">
                      effort to complete
                    </span>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* Expandable Task Detail Table */}
                {/* ============================================================= */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-[#EBECF0] bg-white animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                        <CheckSquare size={14} className="text-[#1F6FEB]" />
                        Assigned Tasks Breakdown ({member.tasks.length})
                      </h5>
                    </div>

                    {member.tasks.length === 0 ? (
                      <p className="text-xs text-[#5E6C84] italic">No tasks assigned to this team member.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#EBECF0] text-[#5E6C84] font-bold">
                              <th className="pb-2">Key & Title</th>
                              <th className="pb-2">Status</th>
                              <th className="pb-2">Priority</th>
                              <th className="pb-2 text-right">Story Points</th>
                              <th className="pb-2 text-right">Effort (Est / Logged)</th>
                              <th className="pb-2 text-right">Due Date</th>
                              <th className="pb-2 text-right">Flags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F4F5F7]">
                            {member.tasks.map(t => {
                              const tDone = isDone(t);
                              const tOverdue = isOverdueTask(t);
                              const tBlocked = isBlockedTask(t);

                              return (
                                <tr
                                  key={t.id}
                                  onClick={() => onSelectTask && onSelectTask(t.id)}
                                  className="hover:bg-[#F4F5F7]/70 cursor-pointer transition-colors"
                                >
                                  <td className="py-2.5 pr-3 font-semibold text-[#172B4D]">
                                    <span className="text-[#1F6FEB] font-bold mr-2">#{t.id}</span>
                                    <span className={tDone ? 'line-through text-[#8993A4]' : ''}>{t.title}</span>
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tDone
                                      ? 'bg-emerald-50 text-[#10B981]'
                                      : 'bg-blue-50 text-[#1F6FEB]'
                                      }`}>
                                      {t.status || 'Todo'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.priority === 'HIGH'
                                      ? 'bg-red-50 text-red-700'
                                      : t.priority === 'MEDIUM'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-blue-50 text-blue-700'
                                      }`}>
                                      {t.priority || 'MEDIUM'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right font-black text-[#172B4D]">
                                    {t.storyPoints || 0} SP
                                  </td>
                                  <td className="py-2.5 pr-3 text-right text-[#5E6C84]">
                                    {t.originalEstimateSeconds ? `${Math.round(t.originalEstimateSeconds / 3600)}h` : t.originalEstimate || '—'}
                                    {' / '}
                                    <span className="text-[#10B981] font-bold">
                                      {t.timeSpentSeconds ? `${Math.round((t.timeSpentSeconds / 3600) * 10) / 10}h` : '0h'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right text-[#5E6C84]">
                                    {t.dueDate ? (
                                      <span className={tOverdue ? 'text-red-600 font-bold' : ''}>
                                        {new Date(t.dueDate).toLocaleDateString()}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {tOverdue && (
                                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[9.5px]">
                                          Overdue
                                        </span>
                                      )}
                                      {tBlocked && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[9.5px]">
                                          Blocked
                                        </span>
                                      )}
                                      {!tOverdue && !tBlocked && tDone && (
                                        <span className="text-[#10B981] font-bold text-[10px]">
                                          ✓ Done
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResourceWorkloadAnalytics;
