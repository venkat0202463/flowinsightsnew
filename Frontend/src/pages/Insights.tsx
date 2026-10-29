import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Flame,
  Zap,
  Users,
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  FileText,
  Printer,
  AlertTriangle,
  CheckCircle,
  Info,
  HelpCircle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  History,
  GitCommit,
  RefreshCw,
  Filter,
  Sparkles,
  Lightbulb,
  BarChart3,
  PieChart,
  ArrowRight,
  X
} from 'lucide-react';
import api from '../services/api';
import burndownService from '../services/burndownService';
import type {
  Task,
  Sprint,
  User,
  Project,
  BurndownResponse,
  BurndownDailyPoint,
  SprintScopeChange,
  BurndownAlert,
  BurndownSummary
} from '../types';
import { getTaskCode } from '../services/projectUtils';
import { calculateKPIOverview, type KPICardData } from '../services/kpiCalculations';
import { KPIDrillDownModal } from '../components/KPIDrillDownModal';
import TaskDetailModal from '../components/TaskDetailModal';
import VelocityAnalyticsTab from '../components/VelocityAnalyticsTab';
import ResourceWorkloadAnalytics from '../components/ResourceWorkloadAnalytics';
import { CycleTimeIntelligenceTab } from '../components/CycleTimeIntelligenceTab';
import { CumulativeFlowIntelligenceTab } from '../components/CumulativeFlowIntelligenceTab';


const Insights = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = (searchParams.get('tab') as 'Burndown' | 'Velocity' | 'Workload' | 'Cycle Time' | 'Cumulative Flow' | 'Time Tracking') || 'Burndown';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'Burndown' | 'Velocity' | 'Workload' | 'Cycle Time' | 'Cumulative Flow' | 'Time Tracking'>(initialTab);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Drill-down Modal State
  const [selectedKPIForDrillDown, setSelectedKPIForDrillDown] = useState<KPICardData | null>(null);
  const [isKPIDrillDownOpen, setIsKPIDrillDownOpen] = useState(false);
  const [activeTaskIdForDetail, setActiveTaskIdForDetail] = useState<number | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  // Update active tab if the URL search params change
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as 'Burndown' | 'Velocity' | 'Workload' | 'Cycle Time' | 'Cumulative Flow' | 'Time Tracking';
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [location.search]);
  const [sprintTasksMap, setSprintTasksMap] = useState<Record<number, Task[]>>({});
  const [project, setProject] = useState<Project | null>(null);

  // Burndown Analytics State
  const [burndownResponse, setBurndownResponse] = useState<BurndownResponse | null>(null);
  const [burndownLoading, setBurndownLoading] = useState(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'ADDED' | 'ESTIMATION' | 'STATUS'>('ALL');
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [showSciTooltip, setShowSciTooltip] = useState(false);
  const [createdVsCompletedMode, setCreatedVsCompletedMode] = useState<'LINE' | 'BAR' | 'DONUT'>('BAR');
  const [curveStyle, setCurveStyle] = useState<'SMOOTH' | 'LINEAR'>('SMOOTH');
  const [showAllSprints, setShowAllSprints] = useState(false);
  const [showAllScopeChanges, setShowAllScopeChanges] = useState(false);
  const [priorityViewMode, setPriorityViewMode] = useState<'DONUT' | 'BAR'>('DONUT');
  const [typeViewMode, setTypeViewMode] = useState<'DONUT' | 'BAR'>('DONUT');
  const [priorityBarSubMode, setPriorityBarSubMode] = useState<'OVERALL' | 'SPRINT'>('OVERALL');
  const [typeBarSubMode, setTypeBarSubMode] = useState<'OVERALL' | 'SPRINT'>('OVERALL');
  const [hoveredPriorityBarIdx, setHoveredPriorityBarIdx] = useState<number | null>(null);
  const [hoveredTypeBarIdx, setHoveredTypeBarIdx] = useState<number | null>(null);
  const [hoveredEffortWeekIdx, setHoveredEffortWeekIdx] = useState<number | null>(null);
  const [effortChartMode, setEffortChartMode] = useState<'BAR' | 'LINE'>('BAR');
  const [showAllWorkItems, setShowAllWorkItems] = useState(false);
  const [showAllTeamMembers, setShowAllTeamMembers] = useState(false);
  const [effortMetricFilters, setEffortMetricFilters] = useState<{
    estimated: boolean;
    logged: boolean;
    remaining: boolean;
  }>({
    estimated: true,
    logged: true,
    remaining: true
  });

  const fetchBurndownData = async (sprintId: number) => {
    setBurndownLoading(true);
    try {
      const data = await burndownService.getBurndown(sprintId);
      setBurndownResponse(data);
    } catch (err) {
      console.error('Failed to fetch burndown data:', err);
    } finally {
      setBurndownLoading(false);
    }
  };

  const fetchAllSprintsBurndown = async () => {
    if (!sprints || sprints.length === 0) {
      return;
    }

    setBurndownLoading(true);
    try {
      const results = await Promise.all(
        sprints.map(s => burndownService.getBurndown(s.id).catch(() => null))
      );
      const validResults = results.filter((r): r is BurndownResponse => r !== null && !!r.summary);

      if (validResults.length === 0) {
        return;
      }

      if (validResults.length === 1) {
        setBurndownResponse({
          ...validResults[0],
          summary: {
            ...validResults[0].summary,
            sprintName: `All Sprints (${validResults[0].summary.sprintName || 'Sprint 1'})`
          }
        });
        return;
      }

      // Aggregate multiple sprints
      const allScopeChanges = validResults.flatMap(r => r.scopeChanges || []);
      allScopeChanges.sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());

      const allAnomalies = validResults.flatMap(r => r.anomalies || []);

      const totalInitial = validResults.reduce((sum, r) => sum + (r.summary.initialCommitment || 0), 0);
      const totalCurrent = validResults.reduce((sum, r) => sum + (r.summary.currentScope || 0), 0);
      const totalAdded = validResults.reduce((sum, r) => sum + (r.summary.addedPoints || 0), 0);
      const totalRemoved = validResults.reduce((sum, r) => sum + (r.summary.removedPoints || 0), 0);
      const totalCompleted = validResults.reduce((sum, r) => sum + (r.summary.completedPoints || 0), 0);
      const totalRemaining = validResults.reduce((sum, r) => sum + (r.summary.remainingPoints || 0), 0);
      const avgSci = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + (r.summary.scopeCreepIndex || 0), 0) / validResults.length
        : 0;
      const totalAlerts = validResults.reduce((sum, r) => sum + (r.summary.activeAlertsCount || 0), 0);

      const aggregatedSummary: BurndownSummary = {
        sprintId: 0,
        sprintName: 'All Sprints',
        status: 'ACTIVE',
        initialCommitment: totalInitial,
        currentScope: totalCurrent,
        addedPoints: totalAdded,
        removedPoints: totalRemoved,
        completedPoints: totalCompleted,
        remainingPoints: totalRemaining,
        scopeCreepIndex: parseFloat(avgSci.toFixed(1)),
        completionPercentage: totalCurrent > 0 ? (totalCompleted / totalCurrent) * 100 : 0,
        activeAlertsCount: totalAlerts
      };

      const aggregatedDailyPoints: BurndownDailyPoint[] = validResults.map((r, idx) => ({
        dayIndex: idx,
        date: r.summary.startDate || '',
        dayLabel: r.summary.sprintName || `Sprint ${idx + 1}`,
        idealRemaining: r.summary.initialCommitment || 0,
        actualRemaining: r.summary.remainingPoints || 0,
        originalCommitment: r.summary.initialCommitment || 0,
        currentScope: r.summary.currentScope || 0,
        completedPoints: r.summary.completedPoints || 0,
        addedPoints: r.summary.addedPoints || 0,
        removedPoints: r.summary.removedPoints || 0,
        dailyCreated: r.summary.currentScope || 0,
        dailyCompleted: r.summary.completedPoints || 0,
        events: []
      }));

      setBurndownResponse({
        summary: aggregatedSummary,
        dailyPoints: aggregatedDailyPoints,
        scopeChanges: allScopeChanges,
        anomalies: allAnomalies
      });
    } catch (err) {
      console.error('Failed to aggregate all sprints burndown:', err);
    } finally {
      setBurndownLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSprintId && selectedSprintId !== 'all') {
      fetchBurndownData(Number(selectedSprintId));
    } else if (selectedSprintId === 'all') {
      fetchAllSprintsBurndown();
    }
  }, [selectedSprintId, sprints]);


  const exportCurrentPDF = () => {
    setIsPrintingAll(false);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const exportAllPDF = () => {
    setIsPrintingAll(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrintingAll(false);
      }, 1500);
    }, 400);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      // Background refresh without showing global loader
      fetchData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchData = async (background = false) => {
    if (!background) setLoading(true);
    try {
      let activeProjId = projectId ? Number(projectId) : null;
      if (!activeProjId) {
        const stored = localStorage.getItem('lastProjectId') || localStorage.getItem('currentProjectId');
        if (stored && !isNaN(Number(stored))) {
          activeProjId = Number(stored);
        }
      }

      if (!activeProjId) {
        const projsRes = await api.get('/projects');
        const projList: Project[] = projsRes.data || [];
        if (projList.length > 0) {
          activeProjId = projList[0].id;
        }
      }

      if (!activeProjId) {
        setLoading(false);
        return;
      }

      localStorage.setItem('lastProjectId', String(activeProjId));

      const [tasksRes, sprintsRes, usersRes, projectRes] = await Promise.all([
        api.get(`/tasks?projectId=${activeProjId}`),
        api.get(`/projects/${activeProjId}/sprints`),
        api.get(`/auth/users?projectId=${activeProjId}`),
        api.get(`/projects/${activeProjId}`)
      ]);

      const fetchedSprints: Sprint[] = sprintsRes.data || [];
      setSprints(fetchedSprints);
      setUsers(usersRes.data || []);
      setProject(projectRes.data || null);

      // Fetch tasks per sprint for accurate velocity data
      const nonPlanned = fetchedSprints.filter(s => s.status?.toUpperCase() !== 'PLANNED');
      const perSprintResults = await Promise.all(
        nonPlanned.map(s => api.get(`/tasks?sprintId=${s.id}`))
      );
      const newSprintTasksMap: Record<number, Task[]> = {};
      nonPlanned.forEach((s, idx) => {
        newSprintTasksMap[s.id] = perSprintResults[idx].data || [];
      });
      setSprintTasksMap(newSprintTasksMap);

      const activeSprint = fetchedSprints.find(s => s.status === 'ACTIVE');
      if (activeSprint) {
        setSelectedSprintId(activeSprint.id);
        setTasks(newSprintTasksMap[activeSprint.id] || []);
      } else {
        setTasks(tasksRes.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSprintChange = async (sprintId: number | 'all') => {
    setSelectedSprintId(sprintId);
    setLoading(true);
    try {
      const activeProjId = projectId || project?.id || localStorage.getItem('lastProjectId') || 1;
      if (sprintId === 'all') {
        const res = await api.get(`/tasks?projectId=${activeProjId}`);
        setTasks(res.data || []);
      } else {
        const res = await api.get(`/tasks?sprintId=${sprintId}`);
        setTasks(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentSprint = useMemo(() =>
    sprints.find(s => s.id === selectedSprintId) || null
    , [sprints, selectedSprintId]);

  // Filter data by selected team member
  const displayTasks = useMemo(() => {
    if (selectedMember === 'all') return tasks;
    const target = selectedMember.trim().toLowerCase();
    return tasks.filter(t => {
      const a = t.assignee;
      const aName = typeof t.assignee === 'string' ? t.assignee : a?.name;
      const co = t.coAssignee;
      const coName = typeof t.coAssignee === 'string' ? t.coAssignee : co?.name;
      return (
        String(t.assigneeId) === selectedMember ||
        (a && String(a.id) === selectedMember) ||
        (aName && aName.trim().toLowerCase() === target) ||
        (a?.empId && a.empId.trim().toLowerCase() === target) ||
        (a?.email && a.email.trim().toLowerCase() === target) ||
        String(t.coAssigneeId) === selectedMember ||
        (co && String(co.id) === selectedMember) ||
        (coName && coName.trim().toLowerCase() === target) ||
        (co?.empId && co.empId.trim().toLowerCase() === target) ||
        (co?.email && co.email.trim().toLowerCase() === target)
      );
    });
  }, [tasks, selectedMember]);

  const displayUsers = useMemo(() => {
    if (selectedMember === 'all') return users;
    const target = selectedMember.trim().toLowerCase();
    const filtered = users.filter(u =>
      String(u.id) === selectedMember ||
      (u.name && u.name.trim().toLowerCase() === target) ||
      (u.empId && u.empId.trim().toLowerCase() === target) ||
      (u.email && u.email.trim().toLowerCase() === target)
    );
    return filtered.length > 0 ? filtered : users;
  }, [users, selectedMember]);

  const displaySprintTasksMap = useMemo(() => {
    if (selectedMember === 'all') return sprintTasksMap;
    const target = selectedMember.trim().toLowerCase();
    const map: Record<number, Task[]> = {};
    Object.entries(sprintTasksMap).forEach(([sprintId, sTasks]) => {
      map[Number(sprintId)] = (sTasks || []).filter(t => {
        const a = t.assignee;
        const aName = typeof t.assignee === 'string' ? t.assignee : a?.name;
        const co = t.coAssignee;
        const coName = typeof t.coAssignee === 'string' ? t.coAssignee : co?.name;
        return (
          String(t.assigneeId) === selectedMember ||
          (a && String(a.id) === selectedMember) ||
          (aName && aName.trim().toLowerCase() === target) ||
          (a?.empId && a.empId.trim().toLowerCase() === target) ||
          (a?.email && a.email.trim().toLowerCase() === target) ||
          String(t.coAssigneeId) === selectedMember ||
          (co && String(co.id) === selectedMember) ||
          (coName && coName.trim().toLowerCase() === target) ||
          (co?.empId && co.empId.trim().toLowerCase() === target) ||
          (co?.email && co.email.trim().toLowerCase() === target)
        );
      });
    });
    return map;
  }, [sprintTasksMap, selectedMember]);

  // Centralized 10 KPIs calculation
  const kpiOverview = useMemo(() => {
    return calculateKPIOverview(
      displayTasks,
      sprints,
      selectedSprintId,
      displayUsers,
      project,
      displaySprintTasksMap
    );
  }, [displayTasks, sprints, selectedSprintId, displayUsers, project, displaySprintTasksMap]);

  const handleOpenKPIDrillDown = (kpi: KPICardData) => {
    setSelectedKPIForDrillDown(kpi);
    setIsKPIDrillDownOpen(true);
  };

  const handleSelectTaskFromDrillDown = (taskId: number) => {
    setActiveTaskIdForDetail(taskId);
    setIsTaskDetailOpen(true);
  };

  // Dynamic Stat Calculations (preserved for other legacy references)
  const stats = useMemo(() => {
    const totalPoints = displayTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = displayTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const remainingPoints = totalPoints - completedPoints;
    const completionRate = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    // Scope change (tasks added in last 3 days)
    const scopeChange = displayTasks.filter(t => {
      if (!t.createdAt) return false;
      const created = new Date(t.createdAt);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return created > threeDaysAgo;
    }).length;

    return {
      totalPoints,
      completedPoints,
      remainingPoints,
      scopeChange,
      completionRate
    };
  }, [displayTasks]);



  const priorityBreakdown = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    displayTasks.forEach(t => {
      const p = (t.priority?.toUpperCase() || 'MEDIUM') as keyof typeof counts;
      if (counts[p] !== undefined) counts[p]++;
    });
    return counts;
  }, [displayTasks]);

  const typeSplit = useMemo(() => {
    const counts: Record<string, number> = {};
    displayTasks.forEach(t => {
      const type = t.issueType?.toUpperCase() || 'TASK';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [displayTasks]);

  const priorityTrendData = useMemo(() => {
    if (selectedSprintId === 'all' && sprints.length > 1) {
      return sprints.map(s => {
        const sTasks = displaySprintTasksMap[s.id] || displayTasks.filter(t => t.sprintId === s.id);
        const high = sTasks.filter(t => t.priority?.toUpperCase() === 'HIGH').length;
        const medium = sTasks.filter(t => t.priority?.toUpperCase() === 'MEDIUM').length;
        const low = sTasks.filter(t => t.priority?.toUpperCase() === 'LOW' || !t.priority).length;
        return {
          label: s.name.length > 8 ? `S${s.id}` : s.name,
          fullLabel: s.name,
          HIGH: high,
          MEDIUM: medium,
          LOW: low
        };
      });
    }

    const numPoints = 6;
    const sorted = [...displayTasks].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    const totalHigh = sorted.filter(t => t.priority?.toUpperCase() === 'HIGH').length;
    const totalMedium = sorted.filter(t => t.priority?.toUpperCase() === 'MEDIUM').length;
    const totalLow = sorted.filter(t => t.priority?.toUpperCase() === 'LOW' || !t.priority).length;

    const points: { label: string; fullLabel: string; HIGH: number; MEDIUM: number; LOW: number }[] = [];
    for (let i = 0; i < numPoints; i++) {
      const step = (i + 1) / numPoints;
      points.push({
        label: `D${i + 1}`,
        fullLabel: `Day ${i + 1}`,
        HIGH: Math.round(totalHigh * step),
        MEDIUM: Math.round(totalMedium * step),
        LOW: Math.round(totalLow * step)
      });
    }
    return points;
  }, [displayTasks, sprints, displaySprintTasksMap, selectedSprintId]);

  const typeTrendData = useMemo(() => {
    const activeTypes = ['TASK', 'BUG', 'STORY', 'IMPROVEMENT', 'EPIC', 'FEATURE'];

    if (selectedSprintId === 'all' && sprints.length > 1) {
      return sprints.map(s => {
        const sTasks = displaySprintTasksMap[s.id] || displayTasks.filter(t => t.sprintId === s.id);
        const row: { label: string; fullLabel: string;[key: string]: any } = {
          label: s.name.length > 8 ? `S${s.id}` : s.name,
          fullLabel: s.name
        };
        activeTypes.forEach(typeKey => {
          row[typeKey] = sTasks.filter(t => (t.issueType?.toUpperCase() || 'TASK') === typeKey).length;
        });
        return row;
      });
    }

    const numPoints = 6;
    const sorted = [...displayTasks].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    const typeTotals: Record<string, number> = {};
    activeTypes.forEach(typeKey => {
      typeTotals[typeKey] = sorted.filter(t => (t.issueType?.toUpperCase() || 'TASK') === typeKey).length;
    });

    const points: { label: string; fullLabel: string;[key: string]: any }[] = [];
    for (let i = 0; i < numPoints; i++) {
      const step = (i + 1) / numPoints;
      const row: { label: string; fullLabel: string;[key: string]: any } = {
        label: `D${i + 1}`,
        fullLabel: `Day ${i + 1}`
      };
      activeTypes.forEach(typeKey => {
        row[typeKey] = Math.round((typeTotals[typeKey] || 0) * step);
      });
      points.push(row);
    }
    return points;
  }, [displayTasks, sprints, displaySprintTasksMap, selectedSprintId]);

  const formatSecondsToHours = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0h';
    const hrs = seconds / 3600;
    if (hrs % 1 === 0) return `${hrs}h`;
    return `${hrs.toFixed(1)}h`;
  };

  const timeTrackingData = useMemo(() => {
    const userTimeMap: Record<string, { name: string; estimated: number; logged: number }> = {};

    displayUsers.forEach(u => {
      userTimeMap[u.empId || u.name] = { name: u.name, estimated: 0, logged: 0 };
    });

    let totalEstimatedSecs = 0;
    let totalLoggedSecs = 0;
    let totalRemainingSecs = 0;

    displayTasks.forEach(t => {
      const est = t.originalEstimateSeconds || 0;
      const spent = t.timeSpentSeconds || 0;
      const rem = t.remainingEstimateSeconds || 0;

      totalEstimatedSecs += est;
      totalLoggedSecs += spent;
      totalRemainingSecs += rem;

      const userName = t.assignee?.name || (typeof t.assignee === 'string' ? t.assignee : 'Unassigned');
      const userKey = t.assignee?.empId || userName;

      if (!userTimeMap[userKey]) {
        userTimeMap[userKey] = { name: userName, estimated: 0, logged: 0 };
      }
      userTimeMap[userKey].estimated += Math.round(est / 3600);
      userTimeMap[userKey].logged += Math.round(spent / 3600);
    });

    const chartData = Object.values(userTimeMap)
      .filter(d => d.estimated > 0 || d.logged > 0)
      .sort((a, b) => b.logged - a.logged || b.estimated - a.estimated);

    return {
      totalEstimatedHrs: Math.round(totalEstimatedSecs / 3600),
      totalLoggedHrs: Math.round(totalLoggedSecs / 3600),
      totalRemainingHrs: Math.round(totalRemainingSecs / 3600),
      chartData,
      tasksWithTime: displayTasks.filter(t => (t.originalEstimateSeconds || 0) > 0 || (t.timeSpentSeconds || 0) > 0)
    };
  }, [displayTasks, displayUsers]);

  const sprintHistory = useMemo(() => {
    const activeOrCompleted = sprints.filter(s => s.status?.toUpperCase() !== 'PLANNED');
    return activeOrCompleted.map(s => {
      const sprintTasks = displaySprintTasksMap[s.id] || [];
      const pts = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const doneTasks = sprintTasks.filter(t => {
        const status = t.status?.toUpperCase();
        return status === 'DONE' || status === 'COMPLETED';
      });
      const donePts = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return {
        name: s.name,
        points: pts,
        donePoints: donePts,
        status: s.status,
        startDate: s.startDate || 'N/A',
        endDate: s.endDate || 'N/A'
      };
    });
  }, [sprints, displaySprintTasksMap]);

  const burndownData = useMemo(() => {
    // If a specific team member is selected, calculate client-side burndown for their tasks
    if (selectedMember !== 'all') {
      const total = displayTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const doneTasks = displayTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');
      const doneTotal = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      if (currentSprint) {
        const start = new Date(currentSprint.startDate || new Date());
        const end = new Date(currentSprint.endDate || new Date());
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 10;
        const days = Array.from({ length: totalDays + 1 }, (_, i) => `D${i}`);
        const ideal = days.map((_, i) => Math.max(0, total - (total / totalDays) * i));
        const actual = new Array(totalDays + 1).fill(total);
        const doneTasksWithDate = displayTasks.filter(t => (t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED') && (t.updatedAt || t.createdAt));
        doneTasksWithDate.forEach(t => {
          const updateDate = new Date(t.updatedAt || t.createdAt!);
          const dayIndex = Math.floor((updateDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (dayIndex >= 0 && dayIndex <= totalDays) {
            for (let i = dayIndex; i <= totalDays; i++) {
              actual[i] -= (t.storyPoints || 0);
            }
          }
        });
        const todayIndex = Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const clippedActual = actual.map((v, i) => i <= todayIndex ? Math.max(0, v) : null);
        return { ideal, actual: clippedActual, days, totalPoints: total };
      }

      if (sprints.length > 0) {
        const days = sprints.map(s => s.name);
        const ideal = sprints.map((_, i) => Math.max(0, total - (total / Math.max(1, sprints.length)) * i));
        const actual = sprints.map(s => {
          const sTasks = displaySprintTasksMap[s.id] || displayTasks.filter(t => t.sprintId === s.id);
          const sTotal = sTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          const sDone = sTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          return Math.max(0, sTotal - sDone);
        });
        return { ideal, actual, days, totalPoints: total };
      }

      return { ideal: [total], actual: [Math.max(0, total - doneTotal)], days: ['All Tasks'], totalPoints: total };
    }

    // Default: If backend burndown analytics is loaded, use it
    if (burndownResponse && burndownResponse.dailyPoints && burndownResponse.dailyPoints.length > 0) {
      const days = burndownResponse.dailyPoints.map(p => p.dayLabel);
      const ideal = burndownResponse.dailyPoints.map(p => p.idealRemaining);
      const actual = burndownResponse.dailyPoints.map(p => p.actualRemaining);
      const totalPoints = burndownResponse.summary?.currentScope || burndownResponse.summary?.initialCommitment || 0;
      return { ideal, actual, days, totalPoints };
    }

    // Fallback if no sprint selected or awaiting API response
    if (!currentSprint) {
      const total = displayTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const doneTasks = displayTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');
      const doneTotal = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      if (sprints.length > 0) {
        const days = sprints.map(s => s.name);
        const ideal = sprints.map((_, i) => Math.max(0, total - (total / Math.max(1, sprints.length)) * i));
        const actual = sprints.map(s => {
          const sTasks = displaySprintTasksMap[s.id] || displayTasks.filter(t => t.sprintId === s.id);
          const sTotal = sTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          const sDone = sTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          return Math.max(0, sTotal - sDone);
        });
        return { ideal, actual, days, totalPoints: total };
      }

      return { ideal: [total], actual: [Math.max(0, total - doneTotal)], days: ['All Tasks'], totalPoints: total };
    }

    const start = new Date(currentSprint.startDate || new Date());
    const end = new Date(currentSprint.endDate || new Date());
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 10;

    const days = Array.from({ length: totalDays + 1 }, (_, i) => `D${i}`);
    const totalPoints = displayTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    const ideal = days.map((_, i) => totalPoints - (totalPoints / totalDays) * i);

    // Calculate actual burn
    const actual = new Array(totalDays + 1).fill(totalPoints);
    const doneTasks = displayTasks.filter(t => (t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED') && (t.updatedAt || t.createdAt));

    doneTasks.forEach(t => {
      const updateDate = new Date(t.updatedAt || t.createdAt!);
      const dayIndex = Math.floor((updateDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex <= totalDays) {
        for (let i = dayIndex; i <= totalDays; i++) {
          actual[i] -= (t.storyPoints || 0);
        }
      }
    });

    // Don't show future actual points
    const todayIndex = Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const clippedActual = actual.map((v, i) => i <= todayIndex ? v : null);

    return { ideal, actual: clippedActual, days, totalPoints };
  }, [displayTasks, currentSprint, burndownResponse, selectedMember, sprints, displaySprintTasksMap]);

  const workloadData = useMemo(() => {
    return displayUsers.map(u => {
      const userTasks = displayTasks.filter(t =>
        (t.assigneeId === u.id) || (t.assignee?.id === u.id)
      );
      const completedTasks = userTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');
      const activeTasks = userTasks.filter(t => t.status?.toUpperCase() !== 'DONE' && t.status?.toUpperCase() !== 'COMPLETED');

      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const activePoints = activeTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const totalPoints = completedPoints + activePoints;

      return {
        name: u.name,
        completedPoints,
        activePoints,
        totalPoints,
        activeCount: activeTasks.length,
        completedCount: completedTasks.length,
        totalCount: userTasks.length
      };
    });
  }, [displayTasks, displayUsers]);

  const completedTasks = useMemo(() => {
    return displayTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');
  }, [displayTasks]);

  const taskCycleTimes = useMemo(() => {
    return completedTasks.map(t => {
      let days = 0;
      if (t.createdAt) {
        const created = new Date(t.createdAt).getTime();
        const end = t.completedAt ? new Date(t.completedAt).getTime() : (t.updatedAt ? new Date(t.updatedAt).getTime() : 0);
        if (end && end >= created) {
          const diff = (end - created) / (1000 * 60 * 60 * 24);
          days = Math.max(0.1, diff);
        } else {
          days = 0.1;
        }
      }
      return {
        task: t,
        days: parseFloat(days.toFixed(1))
      };
    });
  }, [completedTasks]);



  const cycleTimeTrendData = useMemo(() => {
    const isKanban = project?.projectType?.toUpperCase() === 'KANBAN' || sprints.length === 0;

    if (isKanban) {
      // Generate weekly trend for Kanban projects (last 6 weeks)
      const weeks: {
        label: string;
        start: number;
        end: number;
        times: number[];
      }[] = [];
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
          times: [] as number[]
        });
      }

      taskCycleTimes.forEach(({ task, days }) => {
        const completionTime = task.updatedAt ? new Date(task.updatedAt).getTime() : (task.createdAt ? new Date(task.createdAt).getTime() : 0);
        if (!completionTime) return;

        for (const w of weeks) {
          if (completionTime >= w.start && completionTime < w.end) {
            w.times.push(days);
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
      // Scrum project: Sprint-based trend (only completed sprints)
      const completedSprints = sprints.filter(s => s.status?.toUpperCase() === 'COMPLETED').slice(-6);

      if (completedSprints.length === 0) {
        return [];
      }

      return completedSprints.map((s) => {
        const sprintTasks = displaySprintTasksMap[s.id] || [];
        const doneTasks = sprintTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED');

        let avg = 0;
        if (doneTasks.length > 0) {
          const times = doneTasks.map(t => {
            let days = 0.1;
            if (t.createdAt) {
              const created = new Date(t.createdAt).getTime();
              const end = t.completedAt ? new Date(t.completedAt).getTime() : (t.updatedAt ? new Date(t.updatedAt).getTime() : 0);
              if (end && end >= created) {
                days = Math.max(0.1, (end - created) / (1000 * 60 * 60 * 24));
              }
            }
            return days;
          });
          avg = times.reduce((a, b) => a + b, 0) / times.length;
        }

        return {
          name: s.name,
          value: parseFloat(avg.toFixed(1))
        };
      });
    }
  }, [project, sprints, displaySprintTasksMap, taskCycleTimes]);

  const cycleTimeDistribution = useMemo(() => {
    const buckets = {
      '0-1 Day': 0,
      '1-2 Days': 0,
      '2-3 Days': 0,
      '3-5 Days': 0,
      '5-8 Days': 0,
      '> 8 Days': 0
    };

    taskCycleTimes.forEach(t => {
      const d = t.days;
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
  }, [taskCycleTimes]);

  const cycleTimeBreakdown = useMemo(() => {
    const buckets = {
      '0-2 Days': 0,
      '2-5 Days': 0,
      '5-8 Days': 0,
      '> 8 Days': 0
    };

    taskCycleTimes.forEach(t => {
      const d = t.days;
      if (d <= 2) buckets['0-2 Days']++;
      else if (d <= 5) buckets['2-5 Days']++;
      else if (d <= 8) buckets['5-8 Days']++;
      else buckets['> 8 Days']++;
    });

    const total = Object.values(buckets).reduce((a, b) => a + b, 0);

    return {
      total,
      segments: [
        { label: '0-2 Days', count: buckets['0-2 Days'], color: '#36B37E', pct: total > 0 ? Math.round((buckets['0-2 Days'] / total) * 100) : 0 },
        { label: '2-5 Days', count: buckets['2-5 Days'], color: '#1F6FEB', pct: total > 0 ? Math.round((buckets['2-5 Days'] / total) * 100) : 0 },
        { label: '5-8 Days', count: buckets['5-8 Days'], color: '#FFAB00', pct: total > 0 ? Math.round((buckets['5-8 Days'] / total) * 100) : 0 },
        { label: '> 8 Days', count: buckets['> 8 Days'], color: '#FF5630', pct: total > 0 ? Math.round((buckets['> 8 Days'] / total) * 100) : 0 }
      ]
    };
  }, [taskCycleTimes]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-bold text-[#5E6C84] uppercase tracking-widest animate-pulse">Compiling Analytics...</p>
    </div>
  );

  // --- TAB RENDER HELPERS ---
  const renderBurndownContent = () => {
    const summary: BurndownSummary = (selectedMember !== 'all' || !burndownResponse?.summary) ? {
      sprintId: typeof selectedSprintId === 'number' ? selectedSprintId : 0,
      sprintName: currentSprint?.name || 'Current Sprint',
      status: currentSprint?.status || 'ACTIVE',
      startDate: currentSprint?.startDate,
      endDate: currentSprint?.endDate,
      initialCommitment: stats.totalPoints,
      currentScope: stats.totalPoints,
      addedPoints: 0,
      removedPoints: 0,
      completedPoints: stats.completedPoints,
      remainingPoints: stats.remainingPoints,
      scopeCreepIndex: 0.0,
      completionPercentage: stats.completionRate,
      activeAlertsCount: 0
    } : burndownResponse.summary;

    const rawDailyPoints: BurndownDailyPoint[] = (selectedMember === 'all' && burndownResponse?.dailyPoints && burndownResponse.dailyPoints.length > 0)
      ? burndownResponse.dailyPoints
      : burndownData.days.map((dayLabel, idx) => ({
        dayIndex: idx,
        date: '',
        dayLabel,
        idealRemaining: burndownData.ideal[idx] ?? 0,
        actualRemaining: burndownData.actual[idx] ?? null,
        originalCommitment: summary.initialCommitment,
        currentScope: summary.currentScope,
        completedPoints: Math.max(0, summary.currentScope - (burndownData.actual[idx] ?? summary.currentScope)),
        addedPoints: 0,
        removedPoints: 0,
        dailyCreated: 0,
        dailyCompleted: idx === 0 ? 0 : Math.max(0, (burndownData.actual[idx - 1] ?? summary.currentScope) - (burndownData.actual[idx] ?? summary.currentScope)),
        events: []
      }));

    // Explicit day-by-day calculations for exact created vs completed story points
    const dailyPointsData = rawDailyPoints.map((d, i) => {
      const prevD = i > 0 ? rawDailyPoints[i - 1] : null;

      // Exact story points created on this day (tracks added scope / tasks created)
      const createdDaily = (d.dailyCreated !== undefined && d.dailyCreated !== null)
        ? d.dailyCreated
        : (d.addedPoints !== undefined && d.removedPoints !== undefined
          ? Math.max(0, (d.addedPoints || 0) - (d.removedPoints || 0))
          : (d.addedPoints > 0
            ? d.addedPoints
            : (i > 0 && prevD ? Math.max(0, (d.currentScope || 0) - (prevD.currentScope || 0)) : 0)));

      // Exact story points completed on this day
      const completedDaily = (d.dailyCompleted !== undefined && d.dailyCompleted !== null)
        ? d.dailyCompleted
        : (prevD && prevD.completedPoints !== null
          ? Math.max(0, (d.completedPoints ?? 0) - (prevD.completedPoints ?? 0))
          : (d.completedPoints ?? 0));

      const cumulativeScope = d.currentScope || summary.currentScope;
      const cumulativeCompleted = d.completedPoints ?? 0;

      // Active value plotted on the chart: exact story points created and completed on each day
      const createdVal = createdDaily;
      const completedVal = completedDaily;

      return {
        ...d,
        createdDaily,
        completedDaily,
        cumulativeScope,
        cumulativeCompleted,
        createdVal,
        completedVal
      };
    });

    const maxVal = Math.max(
      summary.currentScope || 0,
      summary.initialCommitment || 0,
      ...dailyPointsData.map(p => Math.max(
        p.createdVal || 0,
        p.completedVal || 0
      )),
      5
    );

    const chartLeft = 55;
    const chartRight = 815;
    const chartTop = 24;
    const chartBottom = 180;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;

    const numDays = Math.max(1, dailyPointsData.length - 1);
    const getY = (val: number | null | undefined) => {
      if (val === null || val === undefined) return chartBottom;
      return chartBottom - ((val / (maxVal || 1)) * chartHeight);
    };
    const getX = (idx: number) => {
      return chartLeft + (idx / numDays) * chartWidth;
    };

    // Smooth curve generator with monotonic bounds (no negative dips below baseline or overshooting ceilings)
    const getCurvedPath = (pts: { x: number; y: number }[]): string => {
      const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
      if (validPts.length === 0) return '';
      if (validPts.length === 1) return `M ${validPts[0].x.toFixed(1)} ${validPts[0].y.toFixed(1)}`;
      let path = `M ${validPts[0].x.toFixed(1)} ${validPts[0].y.toFixed(1)}`;
      for (let i = 0; i < validPts.length - 1; i++) {
        const p0 = validPts[i === 0 ? 0 : i - 1] || validPts[0];
        const p1 = validPts[i] || validPts[0];
        const p2 = validPts[i + 1] || validPts[0];
        const p3 = (i + 2 < validPts.length ? validPts[i + 2] : p2) || p2;

        // If consecutive points have identical or near-identical Y, keep completely flat
        if (Math.abs(p1.y - p2.y) < 0.5) {
          path += ` L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
          continue;
        }

        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        let cp1x = p1.x + (p2.x - p0.x) / 6;
        let cp1y = p1.y + (p2.y - p0.y) / 6;
        let cp2x = p2.x - (p3.x - p1.x) / 6;
        let cp2y = p2.y - (p3.y - p1.y) / 6;

        // Clamp control points strictly between p1 and p2 and within chart bounds
        cp1y = Math.max(Math.max(minY, chartTop), Math.min(Math.min(maxY, chartBottom), cp1y));
        cp2y = Math.max(Math.max(minY, chartTop), Math.min(Math.min(maxY, chartBottom), cp2y));

        path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return path;
    };

    const getLinearPath = (pts: { x: number; y: number }[]): string => {
      const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
      if (validPts.length === 0) return '';
      return validPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    const getAreaPath = (pts: { x: number; y: number }[], baseY: number, isSmooth: boolean): string => {
      const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
      if (validPts.length === 0) return '';
      const line = isSmooth ? getCurvedPath(validPts) : getLinearPath(validPts);
      if (!line) return '';
      const first = validPts[0];
      const last = validPts[validPts.length - 1];
      if (!first || !last) return '';
      return `${line} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    };

    // Calculate ticks for Y axis
    let ticks: number[] = [];
    if (maxVal === 0) {
      ticks = [0, 1, 2, 3, 4, 5];
    } else if (maxVal <= 5) {
      for (let i = 0; i <= maxVal; i++) ticks.push(i);
    } else {
      const step = Math.ceil(maxVal / 4);
      for (let i = 0; i <= 4; i++) {
        const val = Math.min(maxVal, i * step);
        if (!ticks.includes(val)) ticks.push(val);
      }
    }

    // Today marker position (exact date matching with local timezone support and fallback)
    const localNow = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localTodayStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())}`;
    const isoTodayStr = localNow.toISOString().split('T')[0];

    let todayIndex = dailyPointsData.findIndex(p => p.date === localTodayStr || p.date === isoTodayStr);
    if (todayIndex === -1) {
      todayIndex = dailyPointsData.findIndex(p => {
        if (!p.date) return false;
        return p.date.endsWith(`${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())}`);
      });
    }
    if (todayIndex === -1 && currentSprint?.startDate) {
      const startD = new Date(currentSprint.startDate);
      const diff = Math.floor((localNow.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < dailyPointsData.length) {
        todayIndex = diff;
      }
    }

    const scopeChanges = burndownResponse?.scopeChanges || [];
    const filteredScopeChanges = scopeChanges.filter(c => {
      if (scopeFilter === 'ALL') return true;
      if (scopeFilter === 'ADDED') return c.changeType === 'TASK_ADDED';
      if (scopeFilter === 'ESTIMATION') return c.changeType === 'POINTS_INCREASED' || c.changeType === 'POINTS_DECREASED';
      if (scopeFilter === 'STATUS') return c.changeType === 'TASK_COMPLETED' || c.changeType === 'TASK_REOPENED';
      return true;
    });
    const hasMoreThan5ScopeChanges = filteredScopeChanges.length > 5;
    const displayedScopeChanges = showAllScopeChanges
      ? filteredScopeChanges
      : filteredScopeChanges.slice(0, 5);

    const anomalies = burndownResponse?.anomalies || [];
    const filteredAnomalies = anomalies.filter(a => {
      if (alertFilter === 'ALL') return true;
      return a.severity?.toUpperCase() === alertFilter;
    });

    // Recorded points & pace status
    const recordedPoints = dailyPointsData.filter(p => p.actualRemaining !== null);
    const lastRecorded = recordedPoints[recordedPoints.length - 1];
    const isBehind = lastRecorded && lastRecorded.actualRemaining !== null && lastRecorded.idealRemaining !== null
      ? (lastRecorded.actualRemaining > lastRecorded.idealRemaining)
      : false;

    const isSmooth = curveStyle === 'SMOOTH';

    // 1. STORY POINTS CREATED (Scope / Created Work across timeline)
    const createdPointsList = dailyPointsData.map(p => ({
      x: getX(p.dayIndex),
      y: getY(p.createdVal),
      val: p.createdVal,
      dailyVal: p.createdDaily,
      cumulativeVal: p.cumulativeScope,
      dayIndex: p.dayIndex
    }));
    const createdPathStr = isSmooth ? getCurvedPath(createdPointsList) : getLinearPath(createdPointsList);
    const createdAreaStr = getAreaPath(createdPointsList, chartBottom, isSmooth);

    // 2. STORY POINTS COMPLETED (Completed Work across timeline)
    const activeRecorded = dailyPointsData.filter(p => p.actualRemaining !== null || p.dayIndex <= (todayIndex >= 0 ? todayIndex : dailyPointsData.length - 1));
    const completedPointsList = (activeRecorded.length > 0 ? activeRecorded : dailyPointsData).map(p => ({
      x: getX(p.dayIndex),
      y: getY(p.completedVal),
      val: p.completedVal,
      dailyVal: p.completedDaily,
      cumulativeVal: p.cumulativeCompleted,
      dayIndex: p.dayIndex
    }));
    const completedPathStr = isSmooth ? getCurvedPath(completedPointsList) : getLinearPath(completedPointsList);
    const completedAreaStr = getAreaPath(completedPointsList, chartBottom, isSmooth);

    const hoveredPoint = hoveredPointIndex !== null && hoveredPointIndex >= 0 && hoveredPointIndex < dailyPointsData.length
      ? dailyPointsData[hoveredPointIndex]
      : null;

    return (
      <div className="space-y-4">
        {/* ALL SPRINTS BANNER IF 'all' IS SELECTED */}
        {selectedSprintId === 'all' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between text-blue-900 shadow-sm">
            <div className="flex items-center gap-3">
              <Info size={20} className="text-[#1F6FEB] shrink-0" />
              <div>
                <p className="text-xs font-bold">Aggregate Project Overview Selected</p>
                <p className="text-[11px] text-blue-700">Select a specific active or completed sprint from the top dropdown to view sprint-specific Scope Creep Index (SCI), anomaly detection alerts, and scope change audits.</p>
              </div>
            </div>
            {sprints.length > 0 && (
              <button
                onClick={() => handleSprintChange(sprints[0].id)}
                className="px-3 py-1.5 bg-[#1F6FEB] text-white text-[11px] font-bold rounded-lg hover:bg-blue-600 transition-colors shrink-0 shadow-sm"
              >
                View {sprints[0].name}
              </button>
            )}
          </div>
        )}

        {/* 1. ENHANCED SPRINT SUMMARY & SCOPE CREEP INDEX (SCI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 break-inside-avoid">
          {/* Hero Card: Scope Creep Index (SCI) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-white to-[#F8FAFC] p-6 rounded-xl border border-[#DFE1E6] shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100">
                  <Flame size={16} />
                </span>
                <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">Scope Creep Index (SCI)</h4>
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setShowSciTooltip(!showSciTooltip)}
                    className="text-[#6B778C] hover:text-[#172B4D] transition-colors p-0.5 rounded"
                    title="Explain SCI Formula"
                  >
                    <HelpCircle size={14} />
                  </button>
                  {showSciTooltip && (
                    <div className="absolute z-30 left-0 top-6 w-72 p-3 bg-[#172B4D] text-white text-[11px] rounded-lg shadow-xl leading-relaxed border border-gray-700">
                      <p className="font-bold text-yellow-300 mb-1">Formula & Standard:</p>
                      <p className="font-mono text-[10px] bg-black/40 p-1.5 rounded mb-2">SCI = (Points Added ÷ Initial Commitment) × 100</p>
                      <p className="text-gray-200">Tracks scope expansion introduced after sprint start. Target is ≤ 15%. Handles zero initial commitment safely as N/A.</p>
                      <button
                        onClick={() => setShowSciTooltip(false)}
                        className="mt-2 text-[10px] text-blue-300 hover:underline block"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                {summary.initialCommitment === 0 ? (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full border border-gray-200">
                    N/A (Zero Commitment)
                  </span>
                ) : (summary.scopeCreepIndex ?? 0) === 0 ? (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                    0% Scope Creep
                  </span>
                ) : (summary.scopeCreepIndex ?? 0) <= 15 ? (
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                    Healthy (≤15%)
                  </span>
                ) : (summary.scopeCreepIndex ?? 0) <= 30 ? (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                    Moderate Creep (16-30%)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full border border-rose-200">
                    High Scope Creep (&gt;30%)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-black text-[#172B4D] tracking-tight">
                {summary.initialCommitment === 0
                  ? 'N/A'
                  : `${(summary.scopeCreepIndex ?? 0).toFixed(1)}%`}
              </span>
              <span className="text-[11px] text-[#5E6C84]">
                {summary.initialCommitment === 0
                  ? 'Initial sprint commitment was zero'
                  : `+${summary.addedPoints} SP added post-planning`}
              </span>
            </div>

            {/* Sub-breakdown metrics */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#DFE1E6]">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6B778C]">Initial Commitment</p>
                <p className="text-sm font-black text-[#172B4D]">{summary.initialCommitment} <span className="text-[10px] font-medium text-[#6B778C]">SP</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6B778C]">Added Scope</p>
                <p className="text-sm font-black text-amber-600">+{summary.addedPoints} <span className="text-[10px] font-medium text-[#6B778C]">SP</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6B778C]">Removed Scope</p>
                <p className="text-sm font-black text-rose-600">-{summary.removedPoints} <span className="text-[10px] font-medium text-[#6B778C]">SP</span></p>
              </div>
            </div>
          </div>

          {/* Metric Card 2: Current Sprint Scope & Completed */}
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-[#6B778C]">
                  {selectedSprintId === 'all' ? 'Project Scope' : 'Current Sprint Scope'}
                </span>
                <span className="px-2 py-0.5 bg-blue-50 text-[#1F6FEB] text-[10px] font-bold rounded">
                  {selectedSprintId === 'all' ? 'All Sprints' : 'Active'}
                </span>
              </div>
              <p className="text-2xl font-black text-[#172B4D] mb-1">
                {summary.currentScope} <span className="text-xs font-medium text-[#6B778C]">SP</span>
              </p>
              <p className="text-[11px] text-[#5E6C84]">
                {selectedSprintId === 'all' ? 'Total active story points across all sprints' : 'Total active story points in sprint'}
              </p>
            </div>
            <div className="pt-3 border-t border-[#DFE1E6] mt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#6B778C]">Completed Work:</span>
              <span className="text-xs font-black text-emerald-600">{summary.completedPoints} SP ({(summary.completionPercentage ?? 0).toFixed(0)}%)</span>
            </div>
          </div>

          {/* Metric Card 3: Remaining Work & Anomalies */}
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-[#6B778C]">Remaining Work</span>
                {summary.activeAlertsCount > 0 ? (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded border border-rose-200 animate-pulse">
                    {summary.activeAlertsCount} {summary.activeAlertsCount === 1 ? 'Alert' : 'Alerts'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                    Normal
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-[#172B4D] mb-1">
                {summary.remainingPoints} <span className="text-xs font-medium text-[#6B778C]">SP</span>
              </p>
              <p className="text-[11px] text-[#5E6C84]">Unfinished story points remaining</p>
            </div>
            <div className="pt-3 border-t border-[#DFE1E6] mt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#6B778C]">Burn Rate Status:</span>
              <span className={`text-xs font-black ${isBehind ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isBehind ? 'Behind Schedule' : 'Pacing Well'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. BURNDOWN CHART & STATUS BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 break-inside-avoid">
          {/* Dedicated Story Points: Created vs Completed Chart */}
          <div className="lg:col-span-2 bg-white p-6 pb-4 rounded-xl border border-[#DFE1E6] shadow-sm break-inside-avoid relative">
            {/* Header: Title + Subtitle + View Switchers + Status + Refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-[#172B4D]">Story Points: Created vs Completed</h3>
                  {burndownLoading && (
                    <RefreshCw size={13} className="text-[#1F6FEB] animate-spin" />
                  )}
                </div>
                <p className="text-[11px] text-[#5E6C84]">
                  {selectedSprintId === 'all'
                    ? 'Comparing total story points created against completed work across all project sprints'
                    : 'Comparing total story points created against completed work across the sprint'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Switcher: Daily Bars vs Line Trend vs Donut */}
                <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-white">
                  <button
                    type="button"
                    onClick={() => setCreatedVsCompletedMode('BAR')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${createdVsCompletedMode === 'BAR'
                      ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                      : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                      }`}
                  >
                    <BarChart3 size={13} />
                    <span>Daily Bars</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatedVsCompletedMode('LINE')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${createdVsCompletedMode === 'LINE'
                      ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                      : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                      }`}
                  >
                    <TrendingUp size={13} />
                    <span>Line Trend</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatedVsCompletedMode('DONUT')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${createdVsCompletedMode === 'DONUT'
                      ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                      : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                      }`}
                  >
                    <PieChart size={13} />
                    <span>Donut</span>
                  </button>
                </div>

                {/* Curve Style Toggle (Only for Line view - in ONE box) */}
                {createdVsCompletedMode === 'LINE' && (
                  <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-white">
                    <button
                      type="button"
                      onClick={() => setCurveStyle('SMOOTH')}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${curveStyle === 'SMOOTH'
                        ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                        : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                        }`}
                      title="Smooth Bezier Curve"
                    >
                      Curved
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurveStyle('LINEAR')}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${curveStyle === 'LINEAR'
                        ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                        : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                        }`}
                      title="Straight Point-to-Point"
                    >
                      Straight
                    </button>
                  </div>
                )}

                {/* Status Badge */}
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${isBehind
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                  {isBehind ? 'Behind Track' : 'On Track'}
                </span>
              </div>
            </div>

            {/* Quick Metric Ribbon (Single Unified Compact Box) */}
            <div className="mb-3.5 pb-2.5 border-b border-[#F4F5F7]">
              <div className="inline-flex items-center bg-white border border-[#DFE1E6] rounded-md divide-x divide-[#EBECF0] shadow-2xs overflow-hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[#FAFBFC] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-[#1F6FEB]"></span>
                  <span className="text-[10.5px] font-bold text-[#5E6C84]">Created:</span>
                  <span className="text-[11px] font-black text-[#1F6FEB]">{summary.currentScope} SP</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[#FAFBFC] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span className="text-[10.5px] font-bold text-[#5E6C84]">Completed:</span>
                  <span className="text-[11px] font-black text-[#10B981]">{summary.completedPoints} SP ({(summary.completionPercentage ?? 0).toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[#FAFBFC] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-[#94A3B8]"></span>
                  <span className="text-[10.5px] font-bold text-[#5E6C84]">Remaining:</span>
                  <span className="text-[11px] font-black text-[#172B4D]">{summary.remainingPoints} SP</span>
                </div>
              </div>
            </div>

            {/* Render Donut View OR SVG Chart */}
            {createdVsCompletedMode === 'DONUT' ? (
              /* DONUT VIEW: STORY POINTS CREATED VS COMPLETED */
              (() => {
                const totalPoints = summary.currentScope || tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0) || 0;

                const doneSp = tasks.filter(t => {
                  const s = (t.status || '').toUpperCase().replace('_', ' ');
                  return s === 'DONE' || s === 'COMPLETED';
                }).reduce((sum, t) => sum + (t.storyPoints || 0), 0);

                const inProgSp = tasks.filter(t => {
                  const s = (t.status || '').toUpperCase().replace('_', ' ');
                  return s === 'IN PROGRESS';
                }).reduce((sum, t) => sum + (t.storyPoints || 0), 0);

                const todoSp = tasks.filter(t => {
                  const s = (t.status || '').toUpperCase().replace('_', ' ');
                  return s === 'TO DO' || !s || (s !== 'DONE' && s !== 'COMPLETED' && s !== 'IN PROGRESS');
                }).reduce((sum, t) => sum + (t.storyPoints || 0), 0);

                const completedPoints = (doneSp > 0 || inProgSp > 0 || todoSp > 0) ? doneSp : (summary.completedPoints || 0);
                const inProgressPoints = inProgSp;
                const remainingPoints = (doneSp > 0 || inProgSp > 0 || todoSp > 0)
                  ? (inProgSp + todoSp)
                  : (summary.remainingPoints ?? Math.max(0, totalPoints - completedPoints));
                const totalCalc = Math.max(totalPoints, completedPoints + remainingPoints, 1);
                const completionPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

                const donutSlices = [
                  { label: 'Completed', sp: completedPoints, color: '#10B981' },
                  { label: 'In Progress', sp: inProgressPoints, color: '#1F6FEB' },
                  { label: 'To Do', sp: todoSp > 0 ? todoSp : Math.max(0, remainingPoints - inProgressPoints), color: '#FFAB00' }
                ].filter(s => s.sp > 0);

                const displaySlices = donutSlices.length > 0
                  ? donutSlices
                  : [{ label: 'Remaining', sp: totalCalc, color: '#94A3B8' }];

                const radius = 54;
                const circumference = 2 * Math.PI * radius;
                let cumulativeRatio = 0;

                return (
                  <div className="w-full py-2">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 py-2">
                      {/* Donut Chart Ring */}
                      <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 140 140">
                          {/* Background Track */}
                          <circle
                            cx="70"
                            cy="70"
                            r={radius}
                            fill="transparent"
                            stroke="#F1F5F9"
                            strokeWidth="14"
                          />
                          {displaySlices.map((slice, idx) => {
                            const ratio = slice.sp / totalCalc;
                            const sliceLength = ratio * circumference;
                            const dashLength = Math.max(0, sliceLength - (displaySlices.length > 1 ? 2.5 : 0));
                            const strokeDasharray = `${dashLength} ${circumference}`;
                            const strokeDashoffset = -cumulativeRatio * circumference;
                            cumulativeRatio += ratio;

                            return (
                              <circle
                                key={`created-donut-${idx}`}
                                cx="70"
                                cy="70"
                                r={radius}
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth="14"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-700 ease-out"
                              />
                            );
                          })}
                        </svg>

                        {/* Center Stats */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                          <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider">
                            COMPLETED
                          </span>
                          <span className="text-2xl font-black text-[#172B4D] tracking-tight leading-none mt-0.5">
                            {completionPct}%
                          </span>
                          <span className="text-[10px] font-semibold text-[#5E6C84] mt-0.5">
                            {completedPoints} / {totalPoints} SP
                          </span>
                        </div>
                      </div>

                      {/* Right Breakdown Grid */}
                      <div className="flex-1 w-full space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-[#F8FAFC] border border-[#DFE1E6] rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-[#6B778C] uppercase">Completed</span>
                              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                            </div>
                            <div className="text-base font-black text-[#10B981]">{completedPoints} SP</div>
                            <div className="text-[10px] text-[#5E6C84] mt-0.5">
                              {totalPoints > 0 ? `${Math.round((completedPoints / totalPoints) * 100)}% of scope` : '0%'}
                            </div>
                          </div>

                          <div className="bg-[#F8FAFC] border border-[#DFE1E6] rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-[#6B778C] uppercase">In Progress</span>
                              <span className="w-2 h-2 rounded-full bg-[#1F6FEB]"></span>
                            </div>
                            <div className="text-base font-black text-[#1F6FEB]">{inProgressPoints} SP</div>
                            <div className="text-[10px] text-[#5E6C84] mt-0.5">
                              {totalPoints > 0 ? `${Math.round((inProgressPoints / totalPoints) * 100)}% active` : '0%'}
                            </div>
                          </div>

                          <div className="bg-[#F8FAFC] border border-[#DFE1E6] rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-[#6B778C] uppercase">Remaining</span>
                              <span className="w-2 h-2 rounded-full bg-[#FFAB00]"></span>
                            </div>
                            <div className="text-base font-black text-[#172B4D]">{remainingPoints} SP</div>
                            <div className="text-[10px] text-[#5E6C84] mt-0.5">
                              {totalPoints > 0 ? `${Math.round((remainingPoints / totalPoints) * 100)}% pending` : '0%'}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar Strip */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#172B4D]">
                            <span>Delivery Progress</span>
                            <span>{completedPoints} of {totalPoints} SP Delivered</span>
                          </div>
                          <div className="h-2 w-full rounded-full overflow-hidden">
                            <svg className="w-full h-2 rounded-full" style={{ height: '8px', display: 'block' }}>
                              <rect x="0" y="0" width="100%" height="8" fill="#F1F5F9" rx="4" />
                              {(() => {
                                const cPct = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;
                                const ipPct = totalPoints > 0 ? (inProgressPoints / totalPoints) * 100 : 0;
                                const remPct = totalPoints > 0 ? (Math.max(0, remainingPoints - inProgressPoints) / totalPoints) * 100 : 0;
                                return (
                                  <>
                                    {cPct > 0 && <rect x="0" y="0" width={`${cPct}%`} height="8" fill="#10B981" rx="4" />}
                                    {ipPct > 0 && <rect x={`${cPct}%`} y="0" width={`${ipPct}%`} height="8" fill="#1F6FEB" rx="4" />}
                                    {remPct > 0 && <rect x={`${cPct + ipPct}%`} y="0" width={`${remPct}%`} height="8" fill="#FFAB00" rx="4" />}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Donut Legend Bar */}
                    <div className="flex flex-wrap items-center justify-center gap-7 px-6 pt-2.5 pb-1 border-t border-[#F4F5F7]">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#10B981]"></div>
                        <span className="text-xs font-bold text-[#172B4D]">Completed ({completedPoints} SP)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#1F6FEB]"></div>
                        <span className="text-xs font-bold text-[#172B4D]">In Progress ({inProgressPoints} SP)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#FFAB00]"></div>
                        <span className="text-xs font-bold text-[#172B4D]">Remaining ({remainingPoints} SP)</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* SVG Chart Container */
              <div className="w-full relative pt-2 pb-1">
              <svg className="w-full h-auto overflow-visible" viewBox="0 0 850 215">
                <defs>
                  {/* Gradients */}
                  <linearGradient id="spCreatedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1F6FEB" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#1F6FEB" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="spCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                  </linearGradient>
                  {/* Tooltip Drop Shadow */}
                  <filter id="tooltipShadow" x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#091E42" floodOpacity="0.15" />
                  </filter>
                </defs>

                {/* Y-Axis Label */}
                <text x={chartLeft} y={chartTop - 10} textAnchor="start" className="text-[10px] font-bold fill-[#6B778C] tracking-wider">
                  STORY POINTS (SP)
                </text>

                {/* Grid Lines & Y-Axis Ticks */}
                {ticks.map(tickVal => {
                  const y = getY(tickVal);
                  return (
                    <g key={tickVal}>
                      <line x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
                      <text x={chartLeft - 10} y={y + 3.5} textAnchor="end" className="text-[10px] font-bold fill-[#6B778C]">
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {/* Y-Axis Vertical Baseline */}
                <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#CBD5E1" strokeWidth="1" />

                {/* X-Axis Horizontal Baseline */}
                <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#CBD5E1" strokeWidth="1" />

                {/* X-Axis Labels with Intelligent Spacing */}
                {(() => {
                  const totalCount = dailyPointsData.length;
                  const step = totalCount > 50
                    ? 10
                    : totalCount > 25
                      ? 5
                      : totalCount > 14
                        ? 2
                        : 1;

                  // Minimum center-to-center SVG coordinate distance between labels to prevent overlap
                  const MIN_LABEL_GAP = 30;
                  const lastStepIndex = Math.floor((totalCount - 1) / step) * step;

                  return dailyPointsData.map((d, i) => {
                    const x = getX(i);
                    const isToday = i === todayIndex;
                    const isFirst = i === 0;
                    const isLast = i === totalCount - 1;
                    const isStep = i % step === 0;

                    const tooCloseToToday = todayIndex !== -1 && !isToday && Math.abs(x - getX(todayIndex)) < MIN_LABEL_GAP;

                    // Priority: Today > Regular Step Intervals (D0, D10... D80) > Non-step boundaries
                    let showLabel = false;
                    if (isToday) {
                      showLabel = true;
                    } else if (isStep) {
                      // Regular interval step (e.g. D0, D10, D20, D30... D70, D80)
                      showLabel = !tooCloseToToday;
                    } else if (isLast) {
                      // Only show the last day label if it is far enough from the last step (not colliding) and not near today
                      const closeToLastStep = Math.abs(x - getX(lastStepIndex)) < MIN_LABEL_GAP;
                      showLabel = !closeToLastStep && !tooCloseToToday;
                    }

                    const showTick = showLabel || totalCount <= 30;

                    return (
                      <g key={i}>
                        {showTick && (
                          <line
                            x1={x}
                            y1={chartBottom}
                            x2={x}
                            y2={chartBottom + (showLabel ? 5 : 3)}
                            stroke={isToday ? '#FF5630' : '#CBD5E1'}
                            strokeWidth={isToday ? 1.5 : 1}
                          />
                        )}
                        {showLabel && (
                          <>
                            <text
                              x={x}
                              y={chartBottom + 16}
                              textAnchor="middle"
                              className={`text-[10px] font-bold ${isToday ? 'fill-[#FF5630]' : 'fill-[#6B778C]'}`}
                            >
                              {d.dayLabel}
                            </text>
                            {d.date && (
                              <text
                                x={x}
                                y={chartBottom + 27}
                                textAnchor="middle"
                                className={`text-[8.5px] font-medium ${isToday ? 'fill-[#FF5630] font-bold' : 'fill-[#94A3B8]'}`}
                              >
                                {d.date.substring(5)}
                              </text>
                            )}
                          </>
                        )}
                      </g>
                    );
                  });
                })()}

                {/* ==================== LINE TREND VIEW ==================== */}
                {createdVsCompletedMode === 'LINE' && (
                  <>
                    {/* 1. Story Points Created (Area + Line) */}
                    {createdAreaStr && (
                      <path d={createdAreaStr} fill="url(#spCreatedGradient)" />
                    )}
                    {createdPathStr && (
                      <path
                        d={createdPathStr}
                        fill="none"
                        stroke="#1F6FEB"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Nodes for Created */}
                    {createdPointsList.map((p, i) => {
                      const isHovered = hoveredPointIndex === i;
                      const hasPoints = p.val > 0;
                      return (
                        <g key={`created-node-${i}`}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 7 : (hasPoints ? 5 : 3.5)}
                            fill="white"
                            stroke="#1F6FEB"
                            strokeWidth={isHovered ? 3 : 2}
                            className="transition-all"
                          />
                          <circle cx={p.x} cy={p.y} r={isHovered ? 3.5 : (hasPoints ? 2.5 : 1.5)} fill="#1F6FEB" />
                        </g>
                      );
                    })}

                    {/* 2. Story Points Completed (Area + Line) */}
                    {completedAreaStr && (
                      <path d={completedAreaStr} fill="url(#spCompletedGradient)" />
                    )}
                    {completedPathStr && (
                      <path
                        d={completedPathStr}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Nodes for Completed */}
                    {completedPointsList.map((p, i) => {
                      const isHovered = hoveredPointIndex === p.dayIndex;
                      const hasPoints = p.val > 0;
                      return (
                        <g key={`completed-node-${i}`}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 7 : (hasPoints ? 5 : 3.5)}
                            fill="white"
                            stroke="#10B981"
                            strokeWidth={isHovered ? 3 : 2}
                            className="transition-all"
                          />
                          <circle cx={p.x} cy={p.y} r={isHovered ? 3.5 : (hasPoints ? 2.5 : 1.5)} fill="#10B981" />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ==================== BAR VIEW ==================== */}
                {createdVsCompletedMode === 'BAR' && (() => {
                  const barWidth = Math.max(3.5, Math.min(18, (chartWidth / numDays) * 0.36));
                  const showEmptyDots = numDays <= 30;
                  return (
                    <>
                      {dailyPointsData.map((d, i) => {
                        const x = getX(i);
                        const isHovered = hoveredPointIndex === i;
                        const createdH = Math.max(0, chartBottom - getY(d.createdVal));
                        const completedH = Math.max(0, chartBottom - getY(d.completedVal));

                        return (
                          <g key={`bar-group-${i}`} opacity={isHovered ? 1 : 0.95}>
                            {/* Created Bar (Blue) */}
                            {d.createdVal > 0 ? (
                              <rect
                                x={x - barWidth - 1.5}
                                y={chartBottom - createdH}
                                width={barWidth}
                                height={createdH}
                                rx="1"
                                fill="#1F6FEB"
                                stroke={isHovered ? '#1557B0' : 'none'}
                                strokeWidth={isHovered ? 1.5 : 0}
                                className="transition-all"
                              />
                            ) : (
                              showEmptyDots && <circle cx={x - (barWidth / 2) - 1.5} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                            )}

                            {/* Completed Bar (Green) */}
                            {d.completedVal > 0 ? (
                              <rect
                                x={x + 1.5}
                                y={chartBottom - completedH}
                                width={barWidth}
                                height={completedH}
                                rx="1"
                                fill="#10B981"
                                stroke={isHovered ? '#059669' : 'none'}
                                strokeWidth={isHovered ? 1.5 : 0}
                                className="transition-all"
                              />
                            ) : (
                              showEmptyDots && <circle cx={x + (barWidth / 2) + 1.5} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                            )}
                          </g>
                        );
                      })}
                    </>
                  );
                })()}

                {/* ==================== TODAY MARKER ==================== */}
                {todayIndex >= 0 && todayIndex < dailyPointsData.length && (() => {
                  const x = getX(todayIndex);
                  return (
                    <g key="today-marker">
                      <line
                        x1={x}
                        y1={chartTop - 4}
                        x2={x}
                        y2={chartBottom + 4}
                        stroke="#FF5630"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                      />
                      <rect
                        x={x - 19}
                        y={chartTop - 18}
                        width="38"
                        height="14"
                        rx="3"
                        fill="#FF5630"
                      />
                      <text
                        x={x}
                        y={chartTop - 8}
                        textAnchor="middle"
                        fill="white"
                        fontSize="8"
                        fontWeight="bold"
                        letterSpacing="0.5"
                      >
                        TODAY
                      </text>
                    </g>
                  );
                })()}

                {/* ==================== INTERACTIVE HOVER STRIPS ==================== */}
                {dailyPointsData.map((p, i) => {
                  const x = getX(i);
                  const stripWidth = chartWidth / numDays;
                  return (
                    <rect
                      key={`hover-strip-${i}`}
                      x={x - stripWidth / 2}
                      y={chartTop - 20}
                      width={stripWidth}
                      height={chartHeight + 50}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(i)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    />
                  );
                })}

                {/* Hover Guide Line */}
                {hoveredPointIndex !== null && (
                  <line
                    x1={getX(hoveredPointIndex)}
                    y1={chartTop - 10}
                    x2={getX(hoveredPointIndex)}
                    y2={chartBottom + 10}
                    stroke="#1F6FEB"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    strokeOpacity="0.8"
                  />
                )}

                {/* Unified Date & Story Points Tooltip on Hover - Medium Size */}
                {hoveredPointIndex !== null && (() => {
                  const d = dailyPointsData[hoveredPointIndex];
                  if (!d) return null;
                  const x = getX(hoveredPointIndex);
                  const tipWidth = 175;
                  const tipHeight = 65;
                  const tipX = Math.max(chartLeft + 2, Math.min(chartRight - tipWidth - 2, x - (tipWidth / 2)));

                  const highestVal = Math.max(d.createdVal || 0, d.completedVal || 0);
                  const highestY = getY(highestVal);
                  const tipY = Math.max(chartTop - 18, Math.min(chartBottom - tipHeight - 4, highestY - tipHeight - 6));

                  return (
                    <g className="pointer-events-none transition-all">
                      {/* Tooltip Card Box */}
                      <rect
                        x={tipX}
                        y={tipY}
                        width={tipWidth}
                        height={tipHeight}
                        rx="6"
                        fill="#FFFFFF"
                        stroke="#DFE1E6"
                        strokeWidth="1"
                        filter="url(#tooltipShadow)"
                      />

                      {/* Header: Date */}
                      <text
                        x={tipX + 12}
                        y={tipY + 18}
                        fontSize="12"
                        fontWeight="bold"
                        fill="#172B4D"
                      >
                        {d.dayLabel} {d.date ? `• ${d.date}` : ''}
                      </text>

                      {/* Created SP */}
                      <circle cx={tipX + 16} cy={tipY + 35} r="3.5" fill="#1F6FEB" />
                      <text
                        x={tipX + 26}
                        y={tipY + 38.5}
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#5E6C84"
                      >
                        Created:
                      </text>
                      <text
                        x={tipX + tipWidth - 12}
                        y={tipY + 38.5}
                        textAnchor="end"
                        fontSize="10.5"
                        fontWeight="bold"
                        fill="#1F6FEB"
                      >
                        {d.createdVal || 0} SP
                      </text>

                      {/* Completed SP */}
                      <circle cx={tipX + 16} cy={tipY + 50} r="3.5" fill="#10B981" />
                      <text
                        x={tipX + 26}
                        y={tipY + 53.5}
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#5E6C84"
                      >
                        Completed:
                      </text>
                      <text
                        x={tipX + tipWidth - 12}
                        y={tipY + 53.5}
                        textAnchor="end"
                        fontSize="10.5"
                        fontWeight="bold"
                        fill="#10B981"
                      >
                        {d.completedVal || 0} SP
                      </text>
                    </g>
                  );
                })()}
              </svg>

              {/* Clean Legend Bar directly below the graph */}
              <div className="flex flex-wrap items-center justify-center gap-7 px-6 pt-2 pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#1F6FEB]"></div>
                  <span className="text-xs font-bold text-[#172B4D]">Story points created</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#10B981]"></div>
                  <span className="text-xs font-bold text-[#172B4D]">Story points completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 border-b-2 border-dashed border-[#FF5630]"></div>
                  <span className="text-xs font-bold text-[#5E6C84]">Today</span>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* STATUS BREAKDOWN */}
          <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-sm break-inside-avoid flex flex-col justify-between h-full">
            {(() => {
              const doneCount = tasks.filter(t => {
                const s = (t.status || '').toUpperCase().replace('_', ' ');
                return s === 'DONE' || s === 'COMPLETED';
              }).length;
              const inProgCount = tasks.filter(t => {
                const s = (t.status || '').toUpperCase().replace('_', ' ');
                return s === 'IN PROGRESS';
              }).length;
              const todoCount = tasks.filter(t => {
                const s = (t.status || '').toUpperCase().replace('_', ' ');
                return s === 'TO DO' || !s || (s !== 'DONE' && s !== 'COMPLETED' && s !== 'IN PROGRESS');
              }).length;

              const statusItems = [
                { label: 'Done', count: doneCount, color: '#36B37E' },
                { label: 'In Progress', count: inProgCount, color: '#1F6FEB' },
                { label: 'To Do', count: todoCount, color: '#FFAB00' }
              ];

              const totalTasks = tasks.length;
              const radius = 38;
              const circumference = 2 * Math.PI * radius;
              let cumulativeRatio = 0;
              const activeStatusItems = statusItems.filter(s => s.count > 0);

              return (
                <>
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <h3 className="text-[13.5px] font-bold text-[#172B4D]">Task Status Breakdown</h3>
                        <p className="text-[10px] text-[#5E6C84] truncate">
                          {selectedSprintId === 'all' ? 'All sprints' : currentSprint?.name} • {tasks.length} total tasks
                        </p>
                      </div>
                      {totalTasks > 0 && (
                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border shrink-0 ml-1 ${doneCount === totalTasks
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-[#1F6FEB] border-blue-200'
                          }`}>
                          {Math.round((doneCount / totalTasks) * 100)}% Done
                        </span>
                      )}
                    </div>

                    {/* Donut Chart Area */}
                    <div className="flex items-center justify-center my-3">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#F4F5F7" strokeWidth="11" />
                          {totalTasks > 0 && statusItems.map((s, idx) => {
                            if (s.count <= 0) return null;
                            const ratio = s.count / totalTasks;
                            const sliceLength = ratio * circumference;
                            const hasMultiple = activeStatusItems.length > 1;
                            const dashLength = Math.max(0, sliceLength - (hasMultiple ? 2 : 0));
                            const strokeDasharray = `${dashLength} ${circumference}`;
                            const strokeDashoffset = -cumulativeRatio * circumference;
                            cumulativeRatio += ratio;

                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="transparent"
                                stroke={s.color}
                                strokeWidth="11"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-700"
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-black text-[#172B4D] leading-none">{doneCount}</span>
                          <span className="text-[9px] font-bold text-[#5E6C84] uppercase tracking-wider mt-0.5">Done</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Rows with Mini Progress Bars */}
                    <div className="w-full space-y-2.5 my-2">
                      {statusItems.map((s, i) => {
                        const pct = totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-[11px] font-bold text-[#172B4D]">{s.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-black text-[#172B4D]">{s.count}</span>
                                <span className="text-[10px] text-[#6B778C] font-semibold">({pct}%)</span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 rounded-none overflow-hidden">
                              <svg className="w-full h-1.5" style={{ height: '6px', display: 'block' }}>
                                <rect x="0" y="0" width="100%" height="6" fill="#F4F5F7" />
                                {pct > 0 && (
                                  <rect
                                    x="0"
                                    y="0"
                                    width={`${pct}%`}
                                    height="6"
                                    fill={s.color}
                                    className="transition-all duration-500"
                                  />
                                )}
                              </svg>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Health Strip */}
                  <div className="mt-3 pt-2.5 border-t border-[#DFE1E6] flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[#6B778C] uppercase tracking-wider">Sprint Health</span>
                    <span className="font-bold text-[#172B4D]">
                      {doneCount} of {totalTasks} resolved
                      {totalTasks - doneCount > 0 && (
                        <span className="text-[#5E6C84] font-normal ml-1">({totalTasks - doneCount} open)</span>
                      )}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>


        {/* 4. SCOPE CHANGE HISTORY & AUDIT LOG */}
        <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-sm break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-3.5 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-blue-50 text-[#1F6FEB] rounded-lg border border-blue-100">
                <History size={18} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">Scope Change History</h3>
                <p className="text-[10px] text-[#5E6C84]">Audit trail of mid-sprint task additions, scope reductions, and point revisions</p>
              </div>
            </div>

            {/* Filter Tabs & View all toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#F4F5F7] p-1 rounded-lg">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'ADDED', label: 'Added' },
                  { id: 'ESTIMATION', label: 'Estimation' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setScopeFilter(f.id as any)}
                    className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${scopeFilter === f.id
                      ? 'bg-white text-[#172B4D] shadow-sm'
                      : 'text-[#6B778C] hover:text-[#172B4D]'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {hasMoreThan5ScopeChanges && (
                <button
                  type="button"
                  onClick={() => setShowAllScopeChanges(!showAllScopeChanges)}
                  className="text-[11px] font-semibold text-[#1F6FEB] hover:underline flex items-center gap-1 shrink-0 ml-1 cursor-pointer"
                  title={showAllScopeChanges ? 'Show first 5' : `View all (${filteredScopeChanges.length})`}
                >
                  <span>{showAllScopeChanges ? 'Show first 5' : `View all (${filteredScopeChanges.length})`}</span>
                  <ArrowRight size={12} className={showAllScopeChanges ? '-rotate-90 transition-transform' : 'transition-transform'} />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {filteredScopeChanges.length === 0 ? (
            <div className="p-8 text-center bg-[#F8FAFC] border border-dashed border-[#DFE1E6] rounded-xl text-[#5E6C84]">
              <GitCommit size={28} className="mx-auto mb-2 text-[#94A3B8]" />
              <p className="text-xs font-bold text-[#172B4D]">No Scope Changes Recorded</p>
              <p className="text-[11px] text-[#5E6C84] mt-0.5">Tasks created, deleted, or re-estimated during the sprint will appear here in real time.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DFE1E6] text-[10px] font-bold text-[#6B778C] uppercase tracking-wider bg-[#FAFBFC]">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Task / Story</th>
                      <th className="py-2.5 px-3">Change Type</th>
                      <th className="py-2.5 px-3 text-right">Previous</th>
                      <th className="py-2.5 px-3 text-right">New</th>
                      <th className="py-2.5 px-3 text-right">Difference</th>
                      <th className="py-2.5 px-3">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBECF0] text-xs">
                    {displayedScopeChanges.map((change) => {
                      const diff = change.pointsDiff || 0;
                      const isPlus = diff > 0;
                      const isMinus = diff < 0;

                      return (
                        <tr key={change.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3 text-[11px] text-[#5E6C84] whitespace-nowrap">
                            {change.changedAt ? new Date(change.changedAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {change.taskKey && (
                                <span className="font-mono text-[10px] font-bold text-[#1F6FEB] px-1.5 py-0.5 bg-blue-50 rounded">
                                  {change.taskKey}
                                </span>
                              )}
                              <span className="font-medium text-[#172B4D] truncate max-w-xs" title={change.taskTitle}>
                                {change.taskTitle || (change.taskId ? `Task #${change.taskId}` : 'Sprint Item')}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {change.changeType === 'TASK_ADDED' ? (
                              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                                Task Added
                              </span>
                            ) : change.changeType === 'TASK_REMOVED' ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full border border-rose-200">
                                Task Removed
                              </span>
                            ) : change.changeType === 'POINTS_INCREASED' ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                                Points Increased
                              </span>
                            ) : change.changeType === 'POINTS_DECREASED' ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
                                Points Decreased
                              </span>
                            ) : change.changeType === 'TASK_REOPENED' ? (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
                                Task Reopened
                              </span>
                            ) : change.changeType === 'TASK_COMPLETED' ? (
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-full border border-teal-200">
                                Task Completed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full">
                                {change.changeType}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] text-[#6B778C]">
                            {change.fromPoints !== null && change.fromPoints !== undefined ? `${change.fromPoints} SP` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] font-bold text-[#172B4D]">
                            {change.toPoints !== null && change.toPoints !== undefined ? `${change.toPoints} SP` : '-'}
                          </td>
                          <td className={`py-2.5 px-3 text-right text-[11px] font-black ${isPlus ? 'text-amber-600' : isMinus ? 'text-rose-600' : 'text-[#6B778C]'
                            }`}>
                            {isPlus ? `+${diff} SP` : isMinus ? `${diff} SP` : '0 SP'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#5E6C84] whitespace-nowrap">
                            {change.changedBy || 'System'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasMoreThan5ScopeChanges && (
                <div className="mt-3 pt-2.5 border-t border-[#DFE1E6] flex items-center justify-between">
                  <span className="text-[11px] text-[#5E6C84]">
                    Showing {displayedScopeChanges.length} of {filteredScopeChanges.length} scope changes
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllScopeChanges(!showAllScopeChanges)}
                    className="text-[11px] font-bold text-[#1F6FEB] hover:text-[#0052CC] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{showAllScopeChanges ? 'Show first 5 only' : `View all ${filteredScopeChanges.length} changes`}</span>
                    <ArrowRight size={12} className={showAllScopeChanges ? '-rotate-90 transition-transform' : 'transition-transform'} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 5. SPRINT HISTORY & PRIORITIES (3 Cards in One Line) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 break-inside-avoid">
          {/* CARD 1: SPRINT HISTORY */}
          {(() => {
            const hasMoreThan5 = sprintHistory.length > 5;
            const displayedSprints = showAllSprints ? sprintHistory : sprintHistory.slice(-5);

            return (
              <div className="bg-white py-3.5 px-4 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="p-1.5 bg-blue-50 text-[#1F6FEB] rounded-lg border border-blue-100 flex items-center justify-center shrink-0">
                        <History size={16} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold text-[#172B4D] truncate">Sprint History</h3>
                        <p className="text-[10px] text-[#5E6C84] truncate">
                          {hasMoreThan5 && !showAllSprints ? `Last 5 of ${sprintHistory.length} sprints` : 'Completed story points per sprint'}
                        </p>
                      </div>
                    </div>
                    {hasMoreThan5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSprints(!showAllSprints)}
                        className="text-[11px] font-semibold text-[#1F6FEB] hover:underline flex items-center gap-1 shrink-0 ml-1 cursor-pointer"
                      >
                        <span>{showAllSprints ? 'Show recent' : `View all (${sprintHistory.length})`}</span>
                        <ArrowRight size={12} className={showAllSprints ? '-rotate-90 transition-transform' : 'transition-transform'} />
                      </button>
                    )}
                  </div>

                  <div className={`space-y-2.5 my-1 ${showAllSprints ? 'max-h-[170px] overflow-y-auto pr-1' : ''}`}>
                    {displayedSprints.length === 0 ? (
                      <p className="text-xs text-[#6B778C] italic py-2">No completed sprints yet</p>
                    ) : (
                      displayedSprints.map((s, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-18 shrink-0">
                            <p className="text-[11px] font-bold text-[#172B4D] truncate">{s.name}</p>
                            <p className="text-[9px] text-[#5E6C84] truncate">{s.startDate} - {s.endDate}</p>
                          </div>
                          <div className="flex-1 h-2 bg-[#F4F5F7] rounded-full overflow-hidden flex">
                            <div className="h-full bg-[#1F6FEB]" style={{ width: `${s.points > 0 ? (s.donePoints / s.points) * 100 : 0}%` }}></div>
                          </div>
                          <div className="w-12 text-right shrink-0">
                            <span className="text-[11px] font-bold text-[#172B4D]">{s.donePoints} pts</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* CARD 2: TASK PRIORITY BREAKDOWN */}
          {(() => {
            const priorityItems = [
              { key: 'HIGH', label: 'High', count: priorityBreakdown.HIGH || 0, color: '#EF4444' },
              { key: 'MEDIUM', label: 'Medium', count: priorityBreakdown.MEDIUM || 0, color: '#F59E0B' },
              { key: 'LOW', label: 'Low', count: priorityBreakdown.LOW || 0, color: '#10B981' }
            ];
            const totalPriority = priorityItems.reduce((acc, curr) => acc + curr.count, 0);
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            let cumulativeRatio = 0;
            const activeItems = priorityItems.filter(p => p.count > 0);

            return (
              <div className="bg-white py-3.5 px-4 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1.5 bg-blue-50 text-[#1F6FEB] rounded-lg border border-blue-100 flex items-center justify-center shrink-0">
                        <Layers size={16} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold text-[#172B4D] truncate">Task Priority Breakdown</h3>
                        <p className="text-[10px] text-[#5E6C84] truncate">
                          {priorityViewMode === 'BAR' ? 'Task priority in bars' : 'Distribution of tasks by priority'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {/* View Switcher: Donut vs Bars */}
                      <div className="flex bg-[#F4F5F7] p-0.5 rounded-lg border border-[#DFE1E6]">
                        <button
                          type="button"
                          onClick={() => setPriorityViewMode('DONUT')}
                          className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${priorityViewMode === 'DONUT' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'
                            }`}
                          title="Donut Distribution"
                        >
                          <PieChart size={10} />
                          <span>Donut</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriorityViewMode('BAR')}
                          className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${priorityViewMode === 'BAR' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'
                            }`}
                          title="Bar Chart"
                        >
                          <BarChart3 size={10} />
                          <span>Bars</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {priorityViewMode === 'BAR' ? (
                    /* BAR CHART VIEW */
                    <div key="priority-bar-view" className="w-full my-1">
                      {/* Sub-header with Sub-toggle & Legend (if multiple sprints and All Sprints selected) */}
                      {selectedSprintId === 'all' && sprints.length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex bg-[#F4F5F7] p-0.5 rounded border border-[#DFE1E6]">
                            <button
                              type="button"
                              onClick={() => setPriorityBarSubMode('OVERALL')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer ${priorityBarSubMode === 'OVERALL' ? 'bg-white text-[#1F6FEB] shadow-xs' : 'text-[#5E6C84]'
                                }`}
                            >
                              Overall
                            </button>
                            <button
                              type="button"
                              onClick={() => setPriorityBarSubMode('SPRINT')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer ${priorityBarSubMode === 'SPRINT' ? 'bg-white text-[#1F6FEB] shadow-xs' : 'text-[#5E6C84]'
                                }`}
                            >
                              By Sprint
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-[9.5px] font-bold">
                            {priorityItems.map(item => (
                              <div key={item.key} className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-[#172B4D]">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chart Area */}
                      {selectedSprintId === 'all' && sprints.length > 1 && priorityBarSubMode === 'SPRINT' ? (
                        /* SPRINT-BY-SPRINT STACKED BARS */
                        <div className="w-full h-24 flex items-end justify-between gap-1.5 px-2 pt-2 border-b border-[#DFE1E6]">
                          {(() => {
                            const maxSprintTotal = Math.max(1, ...priorityTrendData.map(d => (d.HIGH || 0) + (d.MEDIUM || 0) + (d.LOW || 0)));
                            return priorityTrendData.map((d, i) => {
                              const high = d.HIGH || 0;
                              const med = d.MEDIUM || 0;
                              const low = d.LOW || 0;
                              const total = high + med + low;
                              const barHeightPct = total > 0 ? Math.max(14, Math.round((total / maxSprintTotal) * 100)) : 4;
                              const isHovered = hoveredPriorityBarIdx === i;

                              return (
                                <div
                                  key={`priority-sprint-${i}`}
                                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                                  onMouseEnter={() => setHoveredPriorityBarIdx(i)}
                                  onMouseLeave={() => setHoveredPriorityBarIdx(null)}
                                  title={`${d.fullLabel}: Total ${total} (High: ${high}, Med: ${med}, Low: ${low})`}
                                >
                                  {/* Value on top */}
                                  <span className={`text-[9px] font-black mb-1 transition-all ${isHovered ? 'text-[#1F6FEB] scale-110' : 'text-[#172B4D]'}`}>
                                    {total}
                                  </span>
                                  {/* Stacked bar */}
                                  <div
                                    className="w-full max-w-[28px] rounded-none flex flex-col-reverse overflow-hidden transition-[height] duration-300"
                                    style={{ height: `${barHeightPct}%` }}
                                  >
                                    {total > 0 ? (
                                      <>
                                        {low > 0 && <div style={{ height: `${(low / total) * 100}%`, backgroundColor: '#10B981' }} />}
                                        {med > 0 && <div style={{ height: `${(med / total) * 100}%`, backgroundColor: '#F59E0B' }} />}
                                        {high > 0 && <div style={{ height: `${(high / total) * 100}%`, backgroundColor: '#EF4444' }} />}
                                      </>
                                    ) : (
                                      <div className="w-full h-1 bg-gray-200" />
                                    )}
                                  </div>
                                  {/* Sprint label */}
                                  <span className="text-[8.5px] font-bold text-[#5E6C84] mt-1 truncate max-w-full">
                                    {d.label}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        /* OVERALL / SINGLE-SPRINT VERTICAL BARS */
                        <div className="w-full h-24 flex items-end justify-around gap-3 px-3 pt-2 border-b border-[#DFE1E6]">
                          {(() => {
                            const maxVal = Math.max(1, ...priorityItems.map(p => p.count));
                            return priorityItems.map(item => {
                              const barHeightPct = item.count > 0 ? Math.max(16, Math.round((item.count / maxVal) * 100)) : 4;
                              return (
                                <div key={`priority-bar-col-${item.key}`} className="flex-1 flex flex-col items-center justify-end h-full group">
                                  {/* Value on top */}
                                  <span className="text-[11px] font-black text-[#172B4D] mb-1 group-hover:scale-110 transition-transform">
                                    {item.count}
                                  </span>
                                  {/* Vertical bar */}
                                  <div className="w-full max-w-[36px] bg-[#F4F5F7] rounded-none overflow-hidden flex items-end h-[58px]">
                                    <div
                                      className="w-full rounded-none transition-[height] duration-500 ease-out group-hover:brightness-110"
                                      style={{
                                        backgroundColor: item.color,
                                        height: `${barHeightPct}%`,
                                        opacity: item.count > 0 ? 1 : 0.3
                                      }}
                                    />
                                  </div>
                                  {/* Label below */}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-[10px] font-bold text-[#172B4D]">{item.label}</span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* DONUT VIEW */
                    <div key="priority-donut-view" className="flex items-center gap-3.5 my-1">
                      {/* Donut Chart */}
                      <div className="relative w-22 h-22 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke="#F1F5F9"
                            strokeWidth="10"
                          />
                          {totalPriority > 0 && priorityItems.map((item, idx) => {
                            if (item.count <= 0) return null;
                            const ratio = item.count / totalPriority;
                            const sliceLength = ratio * circumference;
                            const hasMultiple = activeItems.length > 1;
                            const dashLength = Math.max(0, sliceLength - (hasMultiple ? 2.5 : 0));
                            const strokeDasharray = `${dashLength} ${circumference}`;
                            const strokeDashoffset = -cumulativeRatio * circumference;
                            cumulativeRatio += ratio;

                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="10"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-700"
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                          <span className="text-[8px] sm:text-[8.5px] font-extrabold text-[#64748B] uppercase tracking-tight leading-[1.15]">
                            Total
                          </span>
                          <span className="text-[8px] sm:text-[8.5px] font-extrabold text-[#64748B] uppercase tracking-tight leading-[1.15]">
                            Priority
                          </span>
                          <span className="text-lg font-black text-[#172B4D] leading-none mt-1">
                            {totalPriority}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown Items with Progress Bars */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {priorityItems.map(item => (
                          <div key={`priority-donut-row-${item.key}`} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="font-bold text-[#172B4D] text-[11px] truncate">{item.label}</span>
                              </div>
                              <span className="font-black text-[#172B4D] text-[11px] shrink-0 ml-1">{item.count}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-[width] duration-700"
                                style={{
                                  backgroundColor: item.color,
                                  width: `${totalPriority > 0 ? (item.count / totalPriority) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Insight Callout Box */}
                <div className="mt-2.5 p-2 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-1.5">
                  <span className="text-[#1F6FEB] shrink-0 mt-0.5">
                    <Lightbulb size={13} />
                  </span>
                  <p className="text-[10px] text-[#42526E] leading-relaxed">
                    {totalPriority === 0
                      ? 'No tasks recorded in this sprint yet.'
                      : priorityItems.reduce((max, cur) => cur.count > max.count ? cur : max, priorityItems[0]).label === 'Low'
                        ? 'Low priority tasks are currently the highest share of the workload.'
                        : priorityItems.reduce((max, cur) => cur.count > max.count ? cur : max, priorityItems[0]).label === 'High'
                          ? 'High priority tasks are currently highest. Ensure team capacity is focused on critical deliverables.'
                          : 'Medium priority tasks represent the majority of workload.'}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* CARD 3: TASK TYPE SPLIT */}
          {(() => {
            const TYPE_COLORS: Record<string, string> = {
              TASK: '#1F6FEB',
              BUG: '#8B5CF6',
              STORY: '#10B981',
              IMPROVEMENT: '#06B6D4',
              EPIC: '#EC4899',
              FEATURE: '#F59E0B'
            };

            const typeEntries = Object.entries(typeSplit);
            const typeItems = typeEntries.length > 0
              ? typeEntries.map(([type, count]) => {
                const upper = type.toUpperCase();
                return {
                  key: upper,
                  label: upper.charAt(0) + upper.slice(1).toLowerCase(),
                  count,
                  color: TYPE_COLORS[upper] || '#64748B'
                };
              })
              : [{ key: 'TASK', label: 'Task', count: 0, color: '#1F6FEB' }];

            const totalType = typeItems.reduce((sum, item) => sum + item.count, 0);
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            let cumulativeRatio = 0;
            const activeItems = typeItems.filter(p => p.count > 0);

            return (
              <div className="bg-white py-3.5 px-4 rounded-xl border border-[#DFE1E6] shadow-sm flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1.5 bg-blue-50 text-[#1F6FEB] rounded-lg border border-blue-100 flex items-center justify-center shrink-0">
                        <PieChart size={16} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold text-[#172B4D] truncate">Task Type Split</h3>
                        <p className="text-[10px] text-[#5E6C84] truncate">
                          {typeViewMode === 'BAR' ? 'Task types in bars' : 'Distribution of tasks by type'}
                        </p>
                      </div>
                    </div>

                    {/* View Switcher: Donut vs Bars */}
                    <div className="flex bg-[#F4F5F7] p-0.5 rounded-lg border border-[#DFE1E6] shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => setTypeViewMode('DONUT')}
                        className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${typeViewMode === 'DONUT' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'
                          }`}
                        title="Donut Distribution"
                      >
                        <PieChart size={10} />
                        <span>Donut</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeViewMode('BAR')}
                        className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${typeViewMode === 'BAR' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'
                          }`}
                        title="Bar Chart"
                      >
                        <BarChart3 size={10} />
                        <span>Bars</span>
                      </button>
                    </div>
                  </div>

                  {typeViewMode === 'BAR' ? (
                    /* BAR CHART VIEW */
                    <div key="type-bar-view" className="w-full my-1">
                      {/* Sub-header with Sub-toggle & Legend (if multiple sprints and All Sprints selected) */}
                      {selectedSprintId === 'all' && sprints.length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex bg-[#F4F5F7] p-0.5 rounded border border-[#DFE1E6]">
                            <button
                              type="button"
                              onClick={() => setTypeBarSubMode('OVERALL')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer ${typeBarSubMode === 'OVERALL' ? 'bg-white text-[#1F6FEB] shadow-xs' : 'text-[#5E6C84]'
                                }`}
                            >
                              Overall
                            </button>
                            <button
                              type="button"
                              onClick={() => setTypeBarSubMode('SPRINT')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer ${typeBarSubMode === 'SPRINT' ? 'bg-white text-[#1F6FEB] shadow-xs' : 'text-[#5E6C84]'
                                }`}
                            >
                              By Sprint
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] font-bold">
                            {typeItems.filter(t => t.count > 0).map(item => (
                              <div key={item.key} className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-[#172B4D]">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chart Area */}
                      {selectedSprintId === 'all' && sprints.length > 1 && typeBarSubMode === 'SPRINT' ? (
                        /* SPRINT-BY-SPRINT STACKED BARS */
                        <div className="w-full h-24 flex items-end justify-between gap-1.5 px-2 pt-2 border-b border-[#DFE1E6]">
                          {(() => {
                            const activeKeys = Object.keys(TYPE_COLORS);
                            const maxSprintTotal = Math.max(1, ...typeTrendData.map(d => activeKeys.reduce((sum, k) => sum + (d[k] || 0), 0)));
                            return typeTrendData.map((d, i) => {
                              const total = activeKeys.reduce((sum, k) => sum + (d[k] || 0), 0);
                              const barHeightPct = total > 0 ? Math.max(14, Math.round((total / maxSprintTotal) * 100)) : 4;
                              const isHovered = hoveredTypeBarIdx === i;

                              return (
                                <div
                                  key={`type-sprint-${i}`}
                                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                                  onMouseEnter={() => setHoveredTypeBarIdx(i)}
                                  onMouseLeave={() => setHoveredTypeBarIdx(null)}
                                  title={`${d.fullLabel}: Total ${total}`}
                                >
                                  {/* Value on top */}
                                  <span className={`text-[9px] font-black mb-1 transition-all ${isHovered ? 'text-[#1F6FEB] scale-110' : 'text-[#172B4D]'}`}>
                                    {total}
                                  </span>
                                  {/* Stacked bar */}
                                  <div
                                    className="w-full max-w-[28px] rounded-none flex flex-col-reverse overflow-hidden transition-[height] duration-300"
                                    style={{ height: `${barHeightPct}%` }}
                                  >
                                    {total > 0 ? (
                                      activeKeys.map(k => {
                                        const count = d[k] || 0;
                                        if (count <= 0) return null;
                                        return (
                                          <div
                                            key={k}
                                            style={{
                                              height: `${(count / total) * 100}%`,
                                              backgroundColor: TYPE_COLORS[k] || '#64748B'
                                            }}
                                          />
                                        );
                                      })
                                    ) : (
                                      <div className="w-full h-1 bg-gray-200" />
                                    )}
                                  </div>
                                  {/* Sprint label */}
                                  <span className="text-[8.5px] font-bold text-[#5E6C84] mt-1 truncate max-w-full">
                                    {d.label}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        /* OVERALL / SINGLE-SPRINT VERTICAL BARS */
                        <div className="w-full h-24 flex items-end justify-around gap-3 px-3 pt-2 border-b border-[#DFE1E6]">
                          {(() => {
                            const displayTypes = [...typeItems];
                            const presentKeys = new Set(displayTypes.map(t => t.key));
                            ['TASK', 'BUG', 'STORY'].forEach(k => {
                              if (!presentKeys.has(k) && displayTypes.length < 3) {
                                displayTypes.push({
                                  key: k,
                                  label: k.charAt(0) + k.slice(1).toLowerCase(),
                                  count: 0,
                                  color: TYPE_COLORS[k] || '#64748B'
                                });
                              }
                            });

                            const maxVal = Math.max(1, ...displayTypes.map(t => t.count));
                            return displayTypes.map(item => {
                              const barHeightPct = item.count > 0 ? Math.max(16, Math.round((item.count / maxVal) * 100)) : 4;
                              return (
                                <div key={`type-bar-col-${item.key}`} className="flex-1 flex flex-col items-center justify-end h-full group">
                                  {/* Value on top */}
                                  <span className="text-[11px] font-black text-[#172B4D] mb-1 group-hover:scale-110 transition-transform">
                                    {item.count}
                                  </span>
                                  {/* Vertical bar */}
                                  <div className="w-full max-w-[36px] bg-[#F4F5F7] rounded-none overflow-hidden flex items-end h-[58px]">
                                    <div
                                      className="w-full rounded-none transition-[height] duration-500 ease-out group-hover:brightness-110"
                                      style={{
                                        backgroundColor: item.color,
                                        height: `${barHeightPct}%`,
                                        opacity: item.count > 0 ? 1 : 0.3
                                      }}
                                    />
                                  </div>
                                  {/* Label below */}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-[10px] font-bold text-[#172B4D] truncate">{item.label}</span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* DONUT VIEW */
                    <div key="type-donut-view" className="flex items-center gap-3.5 my-1">
                      {/* Donut Chart */}
                      <div className="relative w-22 h-22 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke="#F1F5F9"
                            strokeWidth="10"
                          />
                          {totalType > 0 && typeItems.map((item, idx) => {
                            if (item.count <= 0) return null;
                            const ratio = item.count / totalType;
                            const sliceLength = ratio * circumference;
                            const hasMultiple = activeItems.length > 1;
                            const dashLength = Math.max(0, sliceLength - (hasMultiple ? 2.5 : 0));
                            const strokeDasharray = `${dashLength} ${circumference}`;
                            const strokeDashoffset = -cumulativeRatio * circumference;
                            cumulativeRatio += ratio;

                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="10"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-700"
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                          <span className="text-[8px] sm:text-[8.5px] font-extrabold text-[#64748B] uppercase tracking-tight leading-[1.15]">
                            Total
                          </span>
                          <span className="text-[8px] sm:text-[8.5px] font-extrabold text-[#64748B] uppercase tracking-tight leading-[1.15]">
                            Tasks
                          </span>
                          <span className="text-lg font-black text-[#172B4D] leading-none mt-1">
                            {totalType}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown Items with Progress Bars */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {typeItems.map(item => (
                          <div key={`type-donut-row-${item.key}`} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="font-bold text-[#172B4D] text-[11px] capitalize truncate">{item.label}</span>
                              </div>
                              <span className="font-black text-[#172B4D] text-[11px] shrink-0 ml-1">{item.count}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-[width] duration-700"
                                style={{
                                  backgroundColor: item.color,
                                  width: `${totalType > 0 ? (item.count / totalType) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Insight Callout Box */}
                <div className="mt-2.5 p-2 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-1.5">
                  <span className="text-[#1F6FEB] shrink-0 mt-0.5">
                    <Lightbulb size={13} />
                  </span>
                  <p className="text-[10px] text-[#42526E] leading-relaxed">
                    {totalType === 0
                      ? 'No tasks recorded in this sprint yet.'
                      : (() => {
                        const dominant = typeItems.reduce((max, cur) => cur.count > max.count ? cur : max, typeItems[0]);
                        if (dominant.key === 'TASK') {
                          return 'Tasks are currently the highest share of the workload.';
                        }
                        if (dominant.key === 'BUG') {
                          return 'Bug fixes are currently the highest share. Ensure team capacity is focused on defect resolution.';
                        }
                        if (dominant.key === 'STORY') {
                          return 'User stories are currently the highest share of the workload.';
                        }
                        return `${dominant.label} items are currently the highest share of the workload.`;
                      })()}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderVelocityContent = () => (
    <VelocityAnalyticsTab
      projectId={Number(projectId || project?.id || localStorage.getItem('lastProjectId') || 1)}
      selectedSprintId={selectedSprintId}
      sprints={sprints}
      sprintTasksMap={displaySprintTasksMap}
      tasks={displayTasks}
    />
  );

  const renderWorkloadContent = () => (
    <ResourceWorkloadAnalytics
      projectId={Number(projectId || project?.id || 1)}
      selectedSprintId={selectedSprintId}
      sprints={sprints}
      sprintTasksMap={displaySprintTasksMap}
      tasks={displayTasks}
      users={displayUsers}
      project={project}
      onSelectTask={handleSelectTaskFromDrillDown}
    />
  );

  const renderCycleTimeContent = () => (
    <CycleTimeIntelligenceTab
      projectId={Number(projectId || project?.id || localStorage.getItem('lastProjectId') || 1)}
      selectedSprintId={selectedSprintId}
      sprints={sprints}
      sprintTasksMap={displaySprintTasksMap}
      tasks={displayTasks}
      project={project}
      users={displayUsers}
      onSelectTask={handleSelectTaskFromDrillDown}
    />
  );

  const renderCumulativeFlowContent = () => (
    <CumulativeFlowIntelligenceTab
      projectId={Number(projectId || project?.id || localStorage.getItem('lastProjectId') || 1)}
      selectedSprintId={selectedSprintId}
      sprints={sprints}
      sprintTasksMap={displaySprintTasksMap}
      tasks={displayTasks}
      project={project}
      users={displayUsers}
      selectedMember={selectedMember}
      onSelectTask={handleSelectTaskFromDrillDown}
    />
  );

  const renderTimeTrackingContent = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diffToMonday = (currentDay + 6) % 7;
    const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday, 0, 0, 0, 0);

    const weeklyEffortList: Array<{
      weekNum: number;
      weekLabel: string;
      isCurrentWeek: boolean;
      startMs: number;
      endMs: number;
      loggedHrs: number;
      estimatedHrs: number;
      remainingHrs: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const monday = new Date(currentMonday.getTime() - i * 7 * 86400000);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      sunday.setHours(23, 59, 59, 999);
      const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
      weeklyEffortList.push({
        weekNum: 6 - i,
        weekLabel,
        isCurrentWeek: i === 0,
        startMs: monday.getTime(),
        endMs: sunday.getTime(),
        loggedHrs: 0,
        estimatedHrs: 0,
        remainingHrs: 0
      });
    }

    displayTasks.forEach(t => {
      const spentHrs = Math.round((t.timeSpentSeconds || 0) / 3600);
      const estHrs = Math.round((t.originalEstimateSeconds || 0) / 3600) || (t.originalEstimate ? parseInt(t.originalEstimate) || 0 : 0);
      const remHrs = Math.round((t.remainingEstimateSeconds || 0) / 3600);

      if (t.workLogs && t.workLogs.length > 0) {
        t.workLogs.forEach(wl => {
          const wlDate = wl.workDate ? new Date(wl.workDate).getTime() : (wl.createdAt ? new Date(wl.createdAt).getTime() : NaN);
          const wlHrs = Math.round((wl.timeSpentSeconds || 0) / 3600) || (spentHrs / t.workLogs!.length);
          if (!isNaN(wlDate)) {
            weeklyEffortList.forEach(w => {
              if (wlDate >= w.startMs && wlDate <= w.endMs) {
                w.loggedHrs += wlHrs;
                w.estimatedHrs += estHrs / t.workLogs!.length;
                w.remainingHrs += remHrs / t.workLogs!.length;
              }
            });
          }
        });
      } else {
        const tDate = t.completedAt ? new Date(t.completedAt).getTime() : (t.updatedAt ? new Date(t.updatedAt).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : NaN));
        let placed = false;
        if (!isNaN(tDate)) {
          weeklyEffortList.forEach(w => {
            if (tDate >= w.startMs && tDate <= w.endMs) {
              w.loggedHrs += spentHrs;
              w.estimatedHrs += estHrs;
              w.remainingHrs += remHrs;
              placed = true;
            }
          });
        }
        if (!placed && (spentHrs > 0 || estHrs > 0 || remHrs > 0)) {
          const targetWeek = weeklyEffortList.find(w => w.weekNum === 4) || weeklyEffortList[weeklyEffortList.length - 1];
          if (targetWeek) {
            targetWeek.loggedHrs += spentHrs;
            targetWeek.estimatedHrs += estHrs;
            targetWeek.remainingHrs += remHrs;
          }
        }
      }
    });

    const sumLogged = weeklyEffortList.reduce((acc, w) => acc + w.loggedHrs, 0);
    const sumEst = weeklyEffortList.reduce((acc, w) => acc + w.estimatedHrs, 0);
    if (sumLogged === 0 && timeTrackingData.totalLoggedHrs > 0) {
      const targetW = weeklyEffortList.find(w => w.weekNum === 4) || weeklyEffortList[weeklyEffortList.length - 1];
      if (targetW) {
        targetW.loggedHrs = timeTrackingData.totalLoggedHrs;
      }
    }
    if (sumEst === 0 && timeTrackingData.totalEstimatedHrs > 0) {
      const targetW = weeklyEffortList.find(w => w.weekNum === 4) || weeklyEffortList[weeklyEffortList.length - 1];
      if (targetW) {
        targetW.estimatedHrs = timeTrackingData.totalEstimatedHrs;
        targetW.remainingHrs = timeTrackingData.totalRemainingHrs;
      }
    }

    return (
      <div className="space-y-8 font-sans">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider block">Total Estimated Effort</span>
            <div className="text-3xl font-black text-[#172B4D] mt-2">{timeTrackingData.totalEstimatedHrs}h</div>
            <div className="text-xs text-[#5E6C84] mt-2">Planned effort across sprint/project</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider block">Actual Effort Logged</span>
            <div className="text-3xl font-black text-[#36B37E] mt-2">{timeTrackingData.totalLoggedHrs}h</div>
            <div className="text-xs text-[#36B37E] mt-2 font-bold">
              {timeTrackingData.totalEstimatedHrs > 0
                ? `${Math.round((timeTrackingData.totalLoggedHrs / timeTrackingData.totalEstimatedHrs) * 100)}% of estimate`
                : 'Time logged on tickets'}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider block">Remaining Effort</span>
            <div className="text-3xl font-black text-[#FFAB00] mt-2">{timeTrackingData.totalRemainingHrs}h</div>
            <div className="text-xs text-[#5E6C84] mt-2">Outstanding work to complete</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-wider block">Logged Effort %</span>
            <div className="text-3xl font-black text-[#0052CC] mt-2">
              {timeTrackingData.totalEstimatedHrs > 0
                ? `${Math.round((timeTrackingData.totalLoggedHrs / timeTrackingData.totalEstimatedHrs) * 100)}%`
                : '0%'}
            </div>
            <div className="text-xs text-[#0052CC] mt-2 font-bold">
              {timeTrackingData.totalEstimatedHrs > 0 && timeTrackingData.totalLoggedHrs >= timeTrackingData.totalEstimatedHrs
                ? 'Estimate fully logged'
                : 'Percentage of effort logged'}
            </div>
          </div>
        </div>

        {/* Effort Completed Per Week Bar Graph & Line Trend Card */}
        <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <span className="text-slate-800 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <BarChart3 size={16} />
                </span>
                Effort Completed Per Week
              </span>

              <div className="flex items-center gap-3">
                {/* View Options: Bar, Line Trend */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEffortChartMode('BAR')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${effortChartMode === 'BAR'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <BarChart3 size={13} />
                    Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEffortChartMode('LINE')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${effortChartMode === 'LINE'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <TrendingUp size={13} />
                    Line Trend
                  </button>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                  Last 6 Weeks
                </span>
              </div>
            </div>

            <div className="pt-1">
              <svg viewBox="0 0 1150 152" className="w-full h-36 overflow-visible">
                {(() => {
                  const chartLeft = 35;
                  const chartRight = 1120;
                  const chartTop = 22;
                  const chartBottom = 118;
                  const chartHeight = chartBottom - chartTop;
                  const list = weeklyEffortList;
                  const n = Math.max(1, list.length);
                  const maxVal = Math.max(
                    1,
                    ...list.flatMap(w => [
                      effortMetricFilters.logged ? w.loggedHrs : 0,
                      effortMetricFilters.estimated ? w.estimatedHrs : 0,
                      effortMetricFilters.remaining ? w.remainingHrs : 0
                    ])
                  );
                  const yMax = Math.max(4, Math.ceil(maxVal));
                  const getY = (val: number) => chartBottom - (Math.min(val, yMax) / yMax) * chartHeight;
                  const slotW = (chartRight - chartLeft) / n;

                  // Active series count for dynamic bar sizing
                  const activeBarCount = [
                    effortMetricFilters.estimated,
                    effortMetricFilters.logged,
                    effortMetricFilters.remaining
                  ].filter(Boolean).length;

                  const subBarW = activeBarCount <= 1 ? 26 : (activeBarCount === 2 ? 20 : 16);
                  const gap = 3;
                  const groupW = activeBarCount * subBarW + Math.max(0, activeBarCount - 1) * gap;

                  // Integer ticks matching Image 2: 4, 3, 2, 1
                  const ticks: number[] = [];
                  if (yMax <= 5) {
                    for (let t = yMax; t >= 1; t--) ticks.push(t);
                  } else {
                    const step = Math.ceil(yMax / 4);
                    for (let t = step * 4; t >= step; t -= step) ticks.push(t);
                  }

                  const createSpline = (pts: Array<{ x: number; y: number }>) => {
                    return pts.reduce((acc, p, i) => {
                      if (i === 0) return `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                      const prev = pts[i - 1];
                      const cx1 = (prev.x + (p.x - prev.x) / 2).toFixed(1);
                      const cy1 = prev.y.toFixed(1);
                      const cx2 = (prev.x + (p.x - prev.x) / 2).toFixed(1);
                      const cy2 = p.y.toFixed(1);
                      return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    }, '');
                  };

                  // Series points
                  const logPoints = list.map((w, i) => ({
                    x: chartLeft + (i + 0.5) * slotW,
                    y: getY(w.loggedHrs)
                  }));
                  const estPoints = list.map((w, i) => ({
                    x: chartLeft + (i + 0.5) * slotW,
                    y: getY(w.estimatedHrs)
                  }));
                  const remPoints = list.map((w, i) => ({
                    x: chartLeft + (i + 0.5) * slotW,
                    y: getY(w.remainingHrs)
                  }));

                  const logPath = createSpline(logPoints);
                  const estPath = createSpline(estPoints);
                  const remPath = createSpline(remPoints);

                  const firstP = logPoints[0];
                  const lastP = logPoints[logPoints.length - 1];
                  const logAreaPath = `${logPath} L ${lastP.x.toFixed(1)},${chartBottom} L ${firstP.x.toFixed(1)},${chartBottom} Z`;

                  return (
                    <>
                      <defs>
                        <linearGradient id="effortTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="effortTooltipShadow" x="-15%" y="-15%" width="130%" height="130%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#091E42" floodOpacity="0.15" />
                        </filter>
                      </defs>

                      {ticks.map(t => {
                        const y = getY(t);
                        return (
                          <g key={`effort-grid-${t}`}>
                            <line
                              x1={chartLeft}
                              y1={y}
                              x2={chartRight}
                              y2={y}
                              stroke="#F1F5F9"
                              strokeWidth="1"
                            />
                            <text
                              x={chartLeft - 12}
                              y={y + 3.5}
                              textAnchor="end"
                              className="text-[11px] font-medium fill-[#94A3B8]"
                            >
                              {t}
                            </text>
                          </g>
                        );
                      })}

                      <text
                        x={chartLeft - 12}
                        y={chartBottom + 3.5}
                        textAnchor="end"
                        className="text-[11px] font-medium fill-[#94A3B8]"
                      >
                        0
                      </text>

                      <line
                        x1={chartLeft}
                        y1={chartBottom}
                        x2={chartRight}
                        y2={chartBottom}
                        stroke="#CBD5E1"
                        strokeWidth="1"
                      />

                      {/* LINE TRENDS (Shown in 'LINE' mode) */}
                      {effortChartMode === 'LINE' && (
                        <>
                          {/* Actual Logged Area Fill & Line Trend */}
                          {effortMetricFilters.logged && (
                            <>
                              <path d={logAreaPath} fill="url(#effortTrendAreaGrad)" />
                              <path
                                d={logPath}
                                fill="none"
                                stroke="#1D4ED8"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          )}

                          {/* Total Estimated Line Trend */}
                          {effortMetricFilters.estimated && (
                            <path
                              d={estPath}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth="2.2"
                              strokeDasharray="5 3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Remaining Effort Line Trend */}
                          {effortMetricFilters.remaining && (
                            <path
                              d={remPath}
                              fill="none"
                              stroke="#F59E0B"
                              strokeWidth="2"
                              strokeDasharray="3 3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </>
                      )}

                      {/* PER-WEEK ELEMENTS (BARS and/or LINE NODES) */}
                      {list.map((w, i) => {
                        const centerX = chartLeft + (i + 0.5) * slotW;
                        const groupStartX = centerX - groupW / 2;

                        let currentOffset = 0;

                        // Helper for bars with rounded top corners and flat bottom (no bottom border-radius)
                        const getTopRoundedBar = (x: number, y: number, width: number, height: number, r = 3) => {
                          const radius = Math.min(r, width / 2, height);
                          if (height <= 0) return '';
                          return `M ${x},${y + height} L ${x},${y + radius} Q ${x},${y} ${x + radius},${y} L ${x + width - radius},${y} Q ${x + width},${y} ${x + width},${y + radius} L ${x + width},${y + height} Z`;
                        };

                        return (
                          <g key={`effort-week-${w.weekNum}`}>
                            {/* BARS: Rendered in 'BAR' mode */}
                            {effortChartMode === 'BAR' && (
                              <>
                                {/* Estimated Effort Bar */}
                                {effortMetricFilters.estimated && (() => {
                                  const estVal = w.estimatedHrs || 0;
                                  const estH = (estVal / yMax) * chartHeight;
                                  const estX = groupStartX + currentOffset;
                                  const estY = chartBottom - estH;
                                  currentOffset += subBarW + gap;

                                  return estVal > 0 ? (
                                    <>
                                      <path
                                        d={getTopRoundedBar(estX, estY, subBarW, estH, 3)}
                                        fill="#3B82F6"
                                        className="transition-all duration-300 hover:brightness-110"
                                      />
                                      <text
                                        x={estX + subBarW / 2}
                                        y={estY - 5}
                                        textAnchor="middle"
                                        className="text-[10px] font-bold fill-[#3B82F6]"
                                      >
                                        {estVal}
                                      </text>
                                    </>
                                  ) : (
                                    <circle cx={estX + subBarW / 2} cy={chartBottom} r="1.5" fill="#93C5FD" />
                                  );
                                })()}

                                {/* Actual Logged Bar */}
                                {effortMetricFilters.logged && (() => {
                                  const logVal = w.loggedHrs || 0;
                                  const logH = (logVal / yMax) * chartHeight;
                                  const logX = groupStartX + currentOffset;
                                  const logY = chartBottom - logH;
                                  currentOffset += subBarW + gap;

                                  return logVal > 0 ? (
                                    <>
                                      <path
                                        d={getTopRoundedBar(logX, logY, subBarW, logH, 3)}
                                        fill="#1D4ED8"
                                        className="transition-all duration-300 hover:brightness-110"
                                      />
                                      <text
                                        x={logX + subBarW / 2}
                                        y={logY - 5}
                                        textAnchor="middle"
                                        className="text-[10px] font-bold fill-[#1D4ED8]"
                                      >
                                        {logVal}
                                      </text>
                                    </>
                                  ) : (
                                    <circle cx={logX + subBarW / 2} cy={chartBottom} r="1.5" fill="#2563EB" />
                                  );
                                })()}

                                {/* Remaining Effort Bar */}
                                {effortMetricFilters.remaining && (() => {
                                  const remVal = w.remainingHrs || 0;
                                  const remH = (remVal / yMax) * chartHeight;
                                  const remX = groupStartX + currentOffset;
                                  const remY = chartBottom - remH;
                                  currentOffset += subBarW + gap;

                                  return remVal > 0 ? (
                                    <>
                                      <path
                                        d={getTopRoundedBar(remX, remY, subBarW, remH, 3)}
                                        fill="#F59E0B"
                                        className="transition-all duration-300 hover:brightness-110"
                                      />
                                      <text
                                        x={remX + subBarW / 2}
                                        y={remY - 5}
                                        textAnchor="middle"
                                        className="text-[10px] font-bold fill-[#F59E0B]"
                                      >
                                        {remVal}
                                      </text>
                                    </>
                                  ) : (
                                    <circle cx={remX + subBarW / 2} cy={chartBottom} r="1.5" fill="#FCD34D" />
                                  );
                                })()}
                              </>
                            )}

                            {/* LINE NODES: Rendered in 'LINE' mode */}
                            {effortChartMode === 'LINE' && (
                              <>
                                {/* Estimated point */}
                                {effortMetricFilters.estimated && (
                                  <circle
                                    cx={centerX}
                                    cy={getY(w.estimatedHrs)}
                                    r={w.estimatedHrs > 0 ? '3.5' : '2'}
                                    fill="#3B82F6"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.5"
                                  />
                                )}

                                {/* Logged point */}
                                {effortMetricFilters.logged && (
                                  <circle
                                    cx={centerX}
                                    cy={getY(w.loggedHrs)}
                                    r={w.isCurrentWeek ? '4' : '3'}
                                    fill={w.isCurrentWeek ? '#1D4ED8' : '#2563EB'}
                                    stroke="#FFFFFF"
                                    strokeWidth="1.5"
                                  />
                                )}

                                {/* Remaining point */}
                                {effortMetricFilters.remaining && w.remainingHrs > 0 && (
                                  <circle
                                    cx={centerX}
                                    cy={getY(w.remainingHrs)}
                                    r="3"
                                    fill="#F59E0B"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.5"
                                  />
                                )}

                                {/* Render values above points in line mode */}
                                {effortMetricFilters.estimated && w.estimatedHrs > 0 && (
                                  <text
                                    x={centerX - 10}
                                    y={getY(w.estimatedHrs) - 7}
                                    textAnchor="middle"
                                    className="text-[9.5px] font-bold fill-[#3B82F6]"
                                  >
                                    {w.estimatedHrs}h
                                  </text>
                                )}
                                {effortMetricFilters.logged && w.loggedHrs > 0 && (
                                  <text
                                    x={centerX + 10}
                                    y={getY(w.loggedHrs) - 7}
                                    textAnchor="middle"
                                    className="text-[9.5px] font-bold fill-[#1D4ED8]"
                                  >
                                    {w.loggedHrs}h
                                  </text>
                                )}
                              </>
                            )}

                            {/* X-Axis Labels */}
                            <text
                              x={centerX}
                              y={chartBottom + 18}
                              textAnchor="middle"
                              className={`text-[11px] font-bold ${w.isCurrentWeek ? 'fill-[#1D4ED8]' : 'fill-[#64748B]'}`}
                            >
                              Week {w.weekNum}{w.isCurrentWeek ? ' (Now)' : ''}
                            </text>
                            <text
                              x={centerX}
                              y={chartBottom + 32}
                              textAnchor="middle"
                              className="text-[9.5px] font-medium fill-[#94A3B8]"
                            >
                              {w.weekLabel}
                            </text>
                          </g>
                        );
                      })}

                      {/* INTERACTIVE HOVER STRIPS */}
                      {list.map((w, i) => {
                        const centerX = chartLeft + (i + 0.5) * slotW;
                        return (
                          <rect
                            key={`effort-hover-strip-${i}`}
                            x={centerX - slotW / 2}
                            y={chartTop - 15}
                            width={slotW}
                            height={chartHeight + 52}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredEffortWeekIdx(i)}
                            onMouseLeave={() => setHoveredEffortWeekIdx(null)}
                          />
                        );
                      })}

                      {/* Hover Guide Line */}
                      {hoveredEffortWeekIdx !== null && (
                        <line
                          x1={chartLeft + (hoveredEffortWeekIdx + 0.5) * slotW}
                          y1={chartTop - 10}
                          x2={chartLeft + (hoveredEffortWeekIdx + 0.5) * slotW}
                          y2={chartBottom}
                          stroke="#1F6FEB"
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                          strokeOpacity="0.8"
                          pointerEvents="none"
                        />
                      )}

                      {/* Unified Date & Effort Tooltip on Hover (Matching Image 1) */}
                      {hoveredEffortWeekIdx !== null && (() => {
                        const w = list[hoveredEffortWeekIdx];
                        if (!w) return null;
                        const x = chartLeft + (hoveredEffortWeekIdx + 0.5) * slotW;
                        const tipWidth = 190;
                        const tipHeight = 76;
                        const tipX = Math.max(chartLeft + 2, Math.min(chartRight - tipWidth - 2, x - tipWidth / 2));

                        const maxWeekVal = Math.max(w.estimatedHrs || 0, w.loggedHrs || 0, w.remainingHrs || 0);
                        const highestY = getY(maxWeekVal);
                        const tipY = Math.max(chartTop - 20, Math.min(chartBottom - tipHeight - 6, highestY - tipHeight - 10));

                        return (
                          <g className="pointer-events-none transition-all">
                            {/* Tooltip Card Box */}
                            <rect
                              x={tipX}
                              y={tipY}
                              width={tipWidth}
                              height={tipHeight}
                              rx="6"
                              fill="#FFFFFF"
                              stroke="#DFE1E6"
                              strokeWidth="1"
                              filter="url(#effortTooltipShadow)"
                            />

                            {/* Header: Week & Date Range */}
                            <text
                              x={tipX + 12}
                              y={tipY + 17}
                              fontSize="11.5"
                              fontWeight="bold"
                              fill="#172B4D"
                            >
                              Week {w.weekNum} • {w.weekLabel}
                            </text>

                            {/* Total Estimated Effort */}
                            <circle cx={tipX + 16} cy={tipY + 33} r="3.5" fill="#3B82F6" />
                            <text
                              x={tipX + 26}
                              y={tipY + 36.5}
                              fontSize="10"
                              fontWeight="600"
                              fill="#5E6C84"
                            >
                              Estimated:
                            </text>
                            <text
                              x={tipX + tipWidth - 12}
                              y={tipY + 36.5}
                              textAnchor="end"
                              fontSize="10.5"
                              fontWeight="bold"
                              fill="#3B82F6"
                            >
                              {Math.round(w.estimatedHrs * 10) / 10}h
                            </text>

                            {/* Actual Logged Effort */}
                            <circle cx={tipX + 16} cy={tipY + 49} r="3.5" fill="#1D4ED8" />
                            <text
                              x={tipX + 26}
                              y={tipY + 52.5}
                              fontSize="10"
                              fontWeight="600"
                              fill="#5E6C84"
                            >
                              Logged:
                            </text>
                            <text
                              x={tipX + tipWidth - 12}
                              y={tipY + 52.5}
                              textAnchor="end"
                              fontSize="10.5"
                              fontWeight="bold"
                              fill="#1D4ED8"
                            >
                              {Math.round(w.loggedHrs * 10) / 10}h
                            </text>

                            {/* Remaining Effort */}
                            <circle cx={tipX + 16} cy={tipY + 65} r="3.5" fill="#F59E0B" />
                            <text
                              x={tipX + 26}
                              y={tipY + 68.5}
                              fontSize="10"
                              fontWeight="600"
                              fill="#5E6C84"
                            >
                              Remaining:
                            </text>
                            <text
                              x={tipX + tipWidth - 12}
                              y={tipY + 68.5}
                              textAnchor="end"
                              fontSize="10.5"
                              fontWeight="bold"
                              fill="#F59E0B"
                            >
                              {Math.round(w.remainingHrs * 10) / 10}h
                            </text>
                          </g>
                        );
                      })()}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Interactive Graph Legend for Estimated, Actual, and Remaining (Placed down of graph) */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-[#5E6C84] mt-1 pt-1.5 px-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEffortMetricFilters(f => ({ ...f, estimated: !f.estimated }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${effortMetricFilters.estimated
                  ? 'bg-blue-50/80 text-blue-700 border-blue-200/90 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
                  }`}
              >
                <span className="w-2 h-2 rounded-[2px] bg-[#3B82F6]" />
                Total Estimated Effort ({timeTrackingData.totalEstimatedHrs}h)
              </button>

              <button
                type="button"
                onClick={() => setEffortMetricFilters(f => ({ ...f, logged: !f.logged }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${effortMetricFilters.logged
                  ? 'bg-blue-50/80 text-blue-900 border-blue-200/90 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
                  }`}
              >
                <span className="w-2 h-2 rounded-[2px] bg-[#1D4ED8]" />
                Actual Effort Logged ({timeTrackingData.totalLoggedHrs}h)
              </button>

              <button
                type="button"
                onClick={() => setEffortMetricFilters(f => ({ ...f, remaining: !f.remaining }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${effortMetricFilters.remaining
                  ? 'bg-amber-50/80 text-amber-700 border-amber-200/90 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
                  }`}
              >
                <span className="w-2 h-2 rounded-[2px] bg-[#F59E0B]" />
                Remaining Effort ({timeTrackingData.totalRemainingHrs}h)
              </button>

              {effortChartMode === 'LINE' && (
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 pl-1.5">
                  <span className="w-3 h-0.5 bg-[#2563EB]" />
                  <span>Line Trend</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team effort bar chart & Tasks table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Left Column: Team Effort Chart */}
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-[#172B4D]">Effort by Team Member</h3>
                {timeTrackingData.chartData.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTeamMembers(!showAllTeamMembers)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{showAllTeamMembers ? 'Show Less' : `View All (${timeTrackingData.chartData.length})`}</span>
                    <ArrowRight size={13} className={showAllTeamMembers ? '-rotate-90 transition-transform' : 'transition-transform'} />
                  </button>
                )}
              </div>

              {timeTrackingData.chartData.length === 0 ? (
                <div className="py-12 text-center text-[#5E6C84] text-xs italic flex-1 flex items-center justify-center border border-dashed border-[#DFE1E6] rounded">
                  No time tracking data for any team member yet.
                </div>
              ) : (
                <div className={`space-y-4 overflow-y-auto flex-1 ${showAllTeamMembers ? 'max-h-96' : ''} pr-2`}>
                  {(showAllTeamMembers
                    ? timeTrackingData.chartData
                    : timeTrackingData.chartData.slice(0, 5)
                  ).map(data => {
                    const maxVal = Math.max(...timeTrackingData.chartData.map(d => Math.max(d.estimated, d.logged)));
                    const estPct = maxVal > 0 ? (data.estimated / maxVal) * 100 : 0;
                    const logPct = maxVal > 0 ? (data.logged / maxVal) * 100 : 0;

                    return (
                      <div key={data.name} className="space-y-1.5 p-2 hover:bg-[#FAFBFC] rounded transition-colors">
                        <span className="text-xs font-bold text-[#172B4D] block">{data.name}</span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 rounded overflow-hidden">
                              <svg className="w-full h-3 rounded" style={{ height: '12px', display: 'block' }}>
                                <rect x="0" y="0" width="100%" height="12" fill="#F4F5F7" rx="3" />
                                {estPct > 0 && (
                                  <rect
                                    x="0"
                                    y="0"
                                    width={`${Math.min(100, Math.max(3, estPct))}%`}
                                    height="12"
                                    fill="#3B82F6"
                                    rx="3"
                                    className="transition-all duration-500"
                                  />
                                )}
                              </svg>
                            </div>
                            <span className="text-[10px] font-bold text-[#6B778C] w-14 text-right shrink-0">{data.estimated}h est</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 rounded overflow-hidden">
                              <svg className="w-full h-3 rounded" style={{ height: '12px', display: 'block' }}>
                                <rect x="0" y="0" width="100%" height="12" fill="#F4F5F7" rx="3" />
                                {logPct > 0 && (
                                  <rect
                                    x="0"
                                    y="0"
                                    width={`${Math.min(100, Math.max(3, logPct))}%`}
                                    height="12"
                                    fill="#1D4ED8"
                                    rx="3"
                                    className="transition-all duration-500"
                                  />
                                )}
                              </svg>
                            </div>
                            <span className="text-[10px] font-bold text-[#1D4ED8] w-14 text-right shrink-0">{data.logged}h logged</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer View All option */}
            {timeTrackingData.chartData.length > 5 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing {showAllTeamMembers ? timeTrackingData.chartData.length : 5} of {timeTrackingData.chartData.length} team members
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllTeamMembers(!showAllTeamMembers)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{showAllTeamMembers ? 'Show Less' : `View All (${timeTrackingData.chartData.length})`}</span>
                  <ArrowRight size={13} className={showAllTeamMembers ? '-rotate-90 transition-transform' : 'transition-transform'} />
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Effort by Task Table */}
          <div className="bg-white p-6 rounded-xl border border-[#DFE1E6] shadow-sm col-span-2 overflow-x-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-[#172B4D]">Effort by Work Item</h3>
                {timeTrackingData.tasksWithTime.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllWorkItems(!showAllWorkItems)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{showAllWorkItems ? 'Show Less' : `View All (${timeTrackingData.tasksWithTime.length})`}</span>
                    <ArrowRight size={13} className={showAllWorkItems ? '-rotate-90 transition-transform' : 'transition-transform'} />
                  </button>
                )}
              </div>

              {timeTrackingData.tasksWithTime.length === 0 ? (
                <div className="py-12 text-center text-[#5E6C84] text-xs italic flex-1 flex items-center justify-center border border-dashed border-[#DFE1E6] rounded">
                  No time tracking estimates or work logs found for active tasks.
                </div>
              ) : (
                <div className={`overflow-y-auto flex-1 ${showAllWorkItems ? 'max-h-96' : ''} pr-2`}>
                  <table className="w-full text-left text-xs font-medium text-[#172B4D]">
                    <thead>
                      <tr className="border-b border-[#DFE1E6] text-[#5E6C84] uppercase tracking-wider text-[10px]">
                        <th className="pb-3 font-bold">Key/Title</th>
                        <th className="pb-3 font-bold text-center">Original Est</th>
                        <th className="pb-3 font-bold text-center">Time Spent</th>
                        <th className="pb-3 font-bold text-center">Remaining</th>
                        <th className="pb-3 font-bold text-right">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE1E6]">
                      {(showAllWorkItems
                        ? timeTrackingData.tasksWithTime
                        : timeTrackingData.tasksWithTime.slice(0, 5)
                      ).map(t => {
                        const spent = t.timeSpentSeconds || 0;
                        const remaining = t.remainingEstimateSeconds || 0;
                        const total = spent + remaining;
                        const progress = total > 0 ? Math.round((spent / total) * 100) : 0;

                        return (
                          <tr key={t.id} className="hover:bg-[#FAFBFC] transition-colors">
                            <td className="py-3 pr-2">
                              <span className="font-bold text-[#0B3D91] block truncate max-w-xs" title={`${getTaskCode(t.id, t.project?.name || project?.name, t.projectSequence)}: ${t.title}`}>
                                {getTaskCode(t.id, t.project?.name || project?.name, t.projectSequence)}: {t.title}
                              </span>
                              <span className="text-[10px] text-[#6B778C]">{t.assignee?.name || 'Unassigned'}</span>
                            </td>
                            <td className="py-3 text-center font-bold text-[#42526E]">{t.originalEstimate || '0m'}</td>
                            <td className="py-3 text-center font-bold text-[#1D4ED8]">{formatSecondsToHours(t.timeSpentSeconds)}</td>
                            <td className="py-3 text-center font-bold text-[#FFAB00]">{formatSecondsToHours(t.remainingEstimateSeconds)}</td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 rounded-full overflow-hidden flex items-center">
                                  <svg className="w-16 h-2 rounded-full" style={{ height: '8px', display: 'block' }}>
                                    <rect x="0" y="0" width="64" height="8" fill="#EBECF0" rx="4" />
                                    {progress > 0 && (
                                      <rect
                                        x="0"
                                        y="0"
                                        width={`${Math.min(64, Math.max(3, (progress / 100) * 64))}`}
                                        height="8"
                                        fill="#1D4ED8"
                                        rx="4"
                                      />
                                    )}
                                  </svg>
                                </div>
                                <span className="font-bold text-[#6B778C] text-[10px] w-8 text-right">{progress}%</span>
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

            {/* Footer View All option */}
            {timeTrackingData.tasksWithTime.length > 5 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing {showAllWorkItems ? timeTrackingData.tasksWithTime.length : 5} of {timeTrackingData.tasksWithTime.length} work items
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllWorkItems(!showAllWorkItems)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{showAllWorkItems ? 'Show Less' : `View All (${timeTrackingData.tasksWithTime.length})`}</span>
                  <ArrowRight size={13} className={showAllWorkItems ? '-rotate-90 transition-transform' : 'transition-transform'} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-[#F4F5F7]/30 overflow-y-auto font-sans">
      {/* SUB-HEADER BREADCRUMBS */}
      <div className="bg-white border-b border-[#DFE1E6] px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-medium text-[#5E6C84]">
            <Link to="/dashboard/projects" className="hover:text-[#1F6FEB] hover:underline transition-colors cursor-pointer">Projects</Link>
            <span className="text-[#DFE1E6]">/</span>
            <Link to={`/dashboard/project-details/${projectId}`} className="hover:text-[#1F6FEB] hover:underline transition-colors cursor-pointer">Project Hub</Link>
            <span className="text-[#DFE1E6]">/</span>
            <span className="text-[#172B4D] font-bold">Reports</span>
          </div>
          <div className="flex items-center gap-2.5 no-print">
            <button
              onClick={() => fetchData()}
              className="jira-button-subtle bg-white border border-[#DFE1E6] hover:bg-[#F4F5F7] h-8 text-[11px] font-bold gap-1.5 cursor-pointer shadow-sm"
              title="Sync latest project data"
            >
              <Activity size={14} className={loading ? 'animate-spin text-[#0052CC]' : 'text-[#5E6C84]'} />
              <span>Sync</span>
            </button>

            {/* Unified Export PDF Dropdown Button */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="bg-[#0052CC] hover:bg-[#0747A6] text-white px-3.5 h-8 rounded-[4px] text-[11px] font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                title="Export analytics to PDF"
              >
                <FileText size={14} />
                <span>Export PDF</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white border border-[#DFE1E6] rounded-[8px] shadow-xl py-1.5 z-[2000] animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-black text-[#5E6C84] uppercase tracking-wider border-b border-[#F4F5F7]">
                    Select PDF Export Option
                  </div>

                  {/* Option 1: Export Current Tab PDF (e.g. Export Burndown PDF) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      exportCurrentPDF();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#F4F5F7] flex items-start gap-2.5 text-xs text-[#172B4D] transition-colors cursor-pointer"
                  >
                    <FileText size={16} className="text-[#0052CC] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#172B4D]">
                        Export {activeTab} PDF
                      </div>
                      <div className="text-[10px] text-[#5E6C84]">
                        Exports KPI summary & {activeTab} chart
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Export All in One PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      exportAllPDF();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#F4F5F7] flex items-start gap-2.5 text-xs text-[#172B4D] transition-colors border-t border-[#F4F5F7] cursor-pointer"
                  >
                    <Layers size={16} className="text-[#36B37E] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#172B4D] flex items-center gap-1.5">
                        <span>Export All in One PDF</span>
                        <span className="bg-[#E3FCEF] text-[#006644] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          All 6 Charts
                        </span>
                      </div>
                      <div className="text-[10px] text-[#5E6C84]">
                        Burndown, Velocity, Workload, Cycle Time, Flow & Time
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 max-w-7xl mx-auto">
        {/* MAIN HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="section-title mb-1">
              {project ? `${project.name} - Reports` : 'Reports & Analytics'}
            </h1>
            <p className="section-subtitle">
              {project?.projectType === 'KANBAN' ? 'Kanban Project Analytics' : (currentSprint ? `${currentSprint.name} • ${currentSprint.startDate || 'No start date'} - ${currentSprint.endDate || 'No end date'}` : 'Overall Project Analytics')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <select
                value={selectedSprintId}
                onChange={(e) => handleSprintChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="appearance-none bg-white border border-[#DFE1E6] rounded px-4 py-2 pr-10 text-[12px] font-bold text-[#42526E] focus:outline-none focus:border-[#1F6FEB] cursor-pointer shadow-sm"
              >
                <option value="all">All Sprints</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
            </div>
            <div className="relative flex items-center gap-1.5">
              <div className="relative">
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="appearance-none bg-white border border-[#DFE1E6] rounded px-4 py-2 pr-10 text-[12px] font-bold text-[#42526E] focus:outline-none focus:border-[#1F6FEB] cursor-pointer shadow-sm"
                >
                  <option value="all">All Members</option>
                  {users.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
              </div>
              {selectedMember !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedMember('all')}
                  className="text-[11px] font-bold text-[#BF2600] bg-[#FFEBE6] hover:bg-[#FFBDAD] px-2.5 py-2 rounded border border-[#FFBDAD] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  title="Reset to All Members"
                >
                  <X size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABS (Hidden during full PDF print) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#DFE1E6] mb-8 w-fit shadow-sm no-print">
          {[
            { name: 'Burndown', icon: <Flame size={14} className="text-orange-500" /> },
            { name: 'Velocity', icon: <Zap size={14} className="text-yellow-500" /> },
            { name: 'Workload', icon: <Users size={14} className="text-blue-500" /> },
            { name: 'Cycle Time', icon: <Clock size={14} className="text-purple-500" /> },
            { name: 'Cumulative Flow', icon: <Activity size={14} className="text-green-500" /> },
            { name: 'Time Tracking', icon: <Clock size={14} className="text-red-500" /> }
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-[12px] font-bold transition-all ${activeTab === tab.name ? 'bg-[#1F6FEB] text-white shadow-md' : 'text-[#42526E] hover:bg-[#F4F5F7]'}`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        {/* PROJECT HEALTH SUMMARY (10 KPIS) */}
        <div className="mb-5 break-inside-avoid">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2">
                <Activity size={18} className="text-[#1F6FEB]" />
                Project Health Summary
              </h2>
              <p className="text-xs text-[#5E6C84]">
                Enterprise delivery scorecard tracking timeline, budget, velocity, quality, and team workload vs previous cycle.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#6B778C] bg-white px-2.5 py-0.5 rounded-md border border-[#DFE1E6] shadow-xs">
              {selectedMember !== 'all' ? `Member: ${selectedMember} • ` : ''}
              {selectedSprintId !== 'all' && currentSprint ? `Active Scope: ${currentSprint.name}` : 'Overall Project Scope'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 print-kpi-grid">
            {kpiOverview.allCards.map((card) => (
              <div
                key={card.id}
                className="bg-white py-2.5 px-3 rounded-lg border border-[#DFE1E6] shadow-xs hover:shadow-md hover:border-[#B3D4FF] transition-all flex flex-col justify-between print-kpi-card break-inside-avoid"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9.5px] font-black text-[#5E6C84] uppercase tracking-wider truncate" title={card.title}>
                      {card.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${card.status === 'On Track'
                        ? 'bg-[#E3FCEF] text-[#006644] border-[#ABF5D1]'
                        : card.status === 'At Risk'
                          ? 'bg-[#FFF0B3] text-[#172B4D] border-[#FFE380]'
                          : 'bg-[#FFEBE6] text-[#BF2600] border-[#FFBDAD]'
                        }`}
                    >
                      {card.status}
                    </span>
                  </div>

                  <div className="my-1">
                    <span className="text-lg font-bold text-[#172B4D] tracking-tight block truncate" title={String(card.currentValue)}>
                      {card.currentValue}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-semibold">
                    <span
                      className={`flex items-center gap-1 ${card.trendDirection === 'positive'
                        ? 'text-[#006644]'
                        : card.trendDirection === 'negative'
                          ? 'text-[#BF2600]'
                          : 'text-[#5E6C84]'
                        }`}
                    >
                      {card.trendDirection === 'positive' ? (
                        <TrendingUp size={11} />
                      ) : card.trendDirection === 'negative' ? (
                        <TrendingDown size={11} />
                      ) : (
                        <Minus size={11} />
                      )}
                      {card.trendText}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-[#DFE1E6]/60 flex items-center justify-between">
                  <span className="text-[9.5px] font-medium text-[#6B778C]">
                    {card.id === 'budget-status' ? card.category : `Prev: ${card.previousValue}`}
                  </span>
                  <button
                    onClick={() => handleOpenKPIDrillDown(card)}
                    className="text-[10px] font-bold text-[#1F6FEB] hover:text-[#0052CC] flex items-center gap-0.5 cursor-pointer transition-colors"
                  >
                    View Details <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRINT ONLY REPORT BANNER */}
        <div className="hidden print:flex items-center justify-between mb-6 pb-2 border-b border-[#DFE1E6]">
          <span className="text-xs font-bold text-[#0052CC] uppercase tracking-wider">
            {isPrintingAll ? 'Complete Executive Analytics Report (All 6 Sections)' : `Active Report: ${activeTab} Analysis`}
          </span>
          <span className="text-[10px] text-[#5E6C84]">
            FlowTrack Enterprise Analytics Engine
          </span>
        </div>

        {/* RENDER ANALYTICS CONTENT: All-in-One vs Single Tab */}
        {isPrintingAll ? (
          <div className="space-y-8">
            {/* 1. Burndown */}
            <div className="print-section">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Flame size={18} className="text-orange-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  1. Burndown Chart & Status Breakdown
                </h2>
              </div>
              {renderBurndownContent()}
            </div>

            {/* 2. Velocity */}
            <div className="print-section print-page-break">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Zap size={18} className="text-yellow-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  2. Velocity & Sprint Delivery History
                </h2>
              </div>
              {renderVelocityContent()}
            </div>

            {/* 3. Workload */}
            <div className="print-section print-page-break">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Users size={18} className="text-blue-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  3. Team Resource Workload & Capacity
                </h2>
              </div>
              {renderWorkloadContent()}
            </div>

            {/* 4. Cycle Time */}
            <div className="print-section print-page-break">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Clock size={18} className="text-purple-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  4. Cycle Time & Turnaround Speed
                </h2>
              </div>
              {renderCycleTimeContent()}
            </div>

            {/* 5. Cumulative Flow */}
            <div className="print-section print-page-break">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Activity size={18} className="text-green-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  5. Cumulative Flow Diagram & Stability
                </h2>
              </div>
              {renderCumulativeFlowContent()}
            </div>

            {/* 6. Time Tracking */}
            <div className="print-section print-page-break">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0052CC]">
                <Clock size={18} className="text-red-500" />
                <h2 className="text-sm font-black text-[#172B4D] uppercase tracking-wide">
                  6. Time Tracking & Effort Accounting
                </h2>
              </div>
              {renderTimeTrackingContent()}
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'Burndown' && renderBurndownContent()}
            {activeTab === 'Velocity' && renderVelocityContent()}
            {activeTab === 'Workload' && renderWorkloadContent()}
            {activeTab === 'Cycle Time' && renderCycleTimeContent()}
            {activeTab === 'Cumulative Flow' && renderCumulativeFlowContent()}
            {activeTab === 'Time Tracking' && renderTimeTrackingContent()}
          </>
        )}
      </div>

      {/* KPI DRILL-DOWN MODAL */}
      <KPIDrillDownModal
        isOpen={isKPIDrillDownOpen}
        onClose={() => {
          setIsKPIDrillDownOpen(false);
          setSelectedKPIForDrillDown(null);
        }}
        kpi={selectedKPIForDrillDown}
        projectName={project?.name}
        onSelectTask={handleSelectTaskFromDrillDown}
      />

      {/* TASK DETAIL MODAL */}
      {isTaskDetailOpen && activeTaskIdForDetail && (
        <TaskDetailModal
          taskId={activeTaskIdForDetail}
          projectId={Number(projectId || 1)}
          isOpen={isTaskDetailOpen}
          onClose={() => {
            setIsTaskDetailOpen(false);
            setActiveTaskIdForDetail(null);
          }}
          onUpdate={() => fetchData(true)}
          onDelete={() => fetchData(true)}
        />
      )}
    </div>
  );
};

export default Insights;
