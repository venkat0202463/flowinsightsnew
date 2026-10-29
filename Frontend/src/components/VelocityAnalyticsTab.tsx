import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  BarChart3,
  Info,
  Calendar,
  Users,
  Settings,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  X,
  Save,
  Check,
  Percent
} from 'lucide-react';
import velocityService from '../services/velocityService';
import type {
  VelocityAnalyticsResponse,
  VelocitySprint,
  VelocityStability,
  VelocityPlanningRecommendation,
  TeamCapacity,
  MemberCapacity,
  SprintCapacityRequest,
  Sprint,
  Task
} from '../types';

interface VelocityAnalyticsTabProps {
  projectId: number;
  selectedSprintId?: number | 'all';
  sprints?: Sprint[];
  sprintTasksMap?: Record<number, Task[]>;
  tasks?: Task[];
}

export const VelocityAnalyticsTab: React.FC<VelocityAnalyticsTabProps> = ({
  projectId,
  selectedSprintId,
  sprints: propSprints,
  sprintTasksMap: propSprintTasksMap,
  tasks: propTasks
}) => {
  const [sprintCount, setSprintCount] = useState<3 | 5 | 10 | 'ALL'>(5);
  const [movingAvgWindow, setMovingAvgWindow] = useState<3 | 4 | 5>(5);
  const [chartMode, setChartMode] = useState<'BAR' | 'LINE'>('BAR');
  const [curveStyle, setCurveStyle] = useState<'SMOOTH' | 'LINEAR'>('SMOOTH');

  const [analytics, setAnalytics] = useState<VelocityAnalyticsResponse | null>(null);
  const [stability, setStability] = useState<VelocityStability | null>(null);
  const [recommendation, setRecommendation] = useState<VelocityPlanningRecommendation | null>(null);
  const [capacity, setCapacity] = useState<TeamCapacity | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hoveredSprintIdx, setHoveredSprintIdx] = useState<number | null>(null);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const [capacityWorkingDays, setCapacityWorkingDays] = useState(10);
  const [capacityDailyHours, setCapacityDailyHours] = useState(8);
  const [capacityManualSp, setCapacityManualSp] = useState<string>('');
  const [memberCapacities, setMemberCapacities] = useState<MemberCapacity[]>([]);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacitySuccessMsg, setCapacitySuccessMsg] = useState(false);

  // Date & Year filter state (matching Image 1 calendar filter)
  const [selectedYear, setSelectedYear] = useState<string | 'ALL'>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  // Close date filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setIsDateFilterOpen(false);
      }
    };
    if (isDateFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateFilterOpen]);

  // Fallback calculation directly from in-memory project sprints and tasks
  const computeFallbackData = (
    propSprintsList: Sprint[],
    propTasksMap: Record<number, Task[]>,
    countFilter: 3 | 5 | 10 | 'ALL',
    avgWindow: 3 | 4 | 5
  ) => {
    // Include all active or completed sprints
    const validSprints = propSprintsList
      .filter(s => {
        const st = (s.status || '').trim().toUpperCase();
        return st !== 'PLANNED' && st !== 'CANCELLED';
      })
      .sort((a, b) => {
        const d1 = a.startDate ? new Date(a.startDate).getTime() : 0;
        const d2 = b.startDate ? new Date(b.startDate).getTime() : 0;
        if (d1 !== d2) return d1 - d2;
        return (a.id || 0) - (b.id || 0);
      });

    if (validSprints.length === 0) {
      return null;
    }

    const allDtos: VelocitySprint[] = validSprints.map(s => {
      let sprintTasks = propTasksMap[s.id];
      if ((!sprintTasks || sprintTasks.length === 0) && propTasks && propTasks.length > 0) {
        sprintTasks = propTasks.filter(t => t.sprintId === s.id);
      }
      if (!sprintTasks) sprintTasks = [];
      const completedPoints = sprintTasks
        .filter(t => {
          const st = (t.status || '').toUpperCase();
          return st === 'DONE' || st === 'COMPLETED';
        })
        .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      const taskTotalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const isCompleted = (s.status || '').toUpperCase() === 'COMPLETED' || (s.status || '').toUpperCase() === 'CLOSED';

      let committedPoints = isCompleted
        ? (s.initialCommitmentPoints && s.initialCommitmentPoints > 0 ? s.initialCommitmentPoints : taskTotalPoints)
        : (taskTotalPoints > 0 ? taskTotalPoints : (s.initialCommitmentPoints && s.initialCommitmentPoints > 0 ? s.initialCommitmentPoints : 0));

      if (committedPoints < completedPoints) {
        committedPoints = completedPoints;
      }

      return {
        sprintId: s.id,
        sprintName: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
        committedPoints,
        completedPoints,
        difference: completedPoints - committedPoints,
        isCompleted: (s.status || '').toUpperCase() === 'COMPLETED' || (s.status || '').toUpperCase() === 'CLOSED'
      };
    });

    const selectedDtos = countFilter === 'ALL'
      ? allDtos
      : allDtos.slice(-countFilter);

    const totalCompleted = selectedDtos.reduce((sum, s) => sum + s.completedPoints, 0);
    const avgVelocity = selectedDtos.length > 0 ? Math.round((totalCompleted / selectedDtos.length) * 100) / 100 : 0;
    const roundedAvg = Math.round(avgVelocity);
    const latest = selectedDtos.length > 0 ? selectedDtos[selectedDtos.length - 1].completedPoints : 0;
    const highest = selectedDtos.length > 0 ? Math.max(...selectedDtos.map(s => s.completedPoints)) : 0;
    const lowest = selectedDtos.length > 0 ? Math.min(...selectedDtos.map(s => s.completedPoints)) : 0;

    const fallbackAnalytics: VelocityAnalyticsResponse = {
      projectId,
      averageVelocity: avgVelocity,
      roundedAverageVelocity: roundedAvg,
      sprintsAnalyzedCount: selectedDtos.length,
      latestSprintVelocity: latest,
      highestSprintVelocity: highest,
      lowestSprintVelocity: lowest,
      totalCompletedPoints: totalCompleted,
      sprints: selectedDtos
    };

    // Stability calculation
    const variance = selectedDtos.length > 0
      ? selectedDtos.reduce((sum, s) => sum + Math.pow(s.completedPoints - avgVelocity, 2), 0) / selectedDtos.length
      : 0;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
    const cv = avgVelocity > 0 ? Math.round((stdDev / avgVelocity) * 1000) / 10 : 0;
    let stabilityIndicator: 'STABLE' | 'MODERATELY_VARIABLE' | 'HIGHLY_VARIABLE' = 'STABLE';
    let stabilityDesc = 'Velocity is highly consistent across sprints (variation within ±10%). Sprint predictability is optimal.';
    if (cv > 25) {
      stabilityIndicator = 'HIGHLY_VARIABLE';
      stabilityDesc = 'Velocity exhibits high variance (>25%). Investigate scope volatility, impediments, or story sizing differences.';
    } else if (cv > 10) {
      stabilityIndicator = 'MODERATELY_VARIABLE';
      stabilityDesc = 'Velocity shows moderate sprint-to-sprint fluctuation (10%–25%). Planning baseline should buffer for variability.';
    }

    const fallbackStability: VelocityStability = {
      projectId,
      sprintsAnalyzedCount: selectedDtos.length,
      averageVelocity: avgVelocity,
      roundedAverageVelocity: roundedAvg,
      recentVelocity: latest,
      roundedRecentVelocity: latest,
      standardDeviation: stdDev,
      roundedStandardDeviation: Math.round(stdDev),
      coefficientOfVariation: cv,
      stabilityIndicator,
      stabilityDescription: stabilityDesc,
      highestVelocity: highest,
      lowestVelocity: lowest
    };

    // Planning recommendation calculation
    const windowCount = Math.min(avgWindow, selectedDtos.length);
    const recentWindow = selectedDtos.slice(-windowCount);
    const movingAvg = recentWindow.length > 0
      ? Math.round((recentWindow.reduce((sum, s) => sum + s.completedPoints, 0) / recentWindow.length) * 100) / 100
      : 0;

    const fallbackRec: VelocityPlanningRecommendation = {
      projectId,
      historicalSprintsUsed: windowCount,
      observedRangeMin: lowest,
      observedRangeMax: highest,
      historicalAverage: avgVelocity,
      roundedHistoricalAverage: roundedAvg,
      currentTeamCapacity: roundedAvg,
      currentTeamCapacityHours: 0,
      currentTeamCapacityDays: 0,
      capacityUnit: 'SP',
      isCapacityConfigured: true,
      isCapacityManual: false,
      suggestedPlanningBaseline: movingAvg,
      roundedSuggestedPlanningBaseline: Math.round(movingAvg),
      insufficientDataWarning: false,
      capacityConfigRequired: false,
      advisoryNote: `Based on ${windowCount} completed sprint of ${movingAvg} SP (observed range: ${lowest}–${highest} SP), the recommended commitment baseline is ${Math.round(movingAvg)} SP.`,
      includedSprints: recentWindow
    };

    return { fallbackAnalytics, fallbackStability, fallbackRec };
  };

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!analytics) setLoading(true);
    setError(null);

    let apiAnalytics: VelocityAnalyticsResponse | null = null;
    let apiStability: VelocityStability | null = null;
    let apiRec: VelocityPlanningRecommendation | null = null;
    let apiCap: TeamCapacity | null = null;

    try {
      const activeSprint = selectedSprintId && selectedSprintId !== 'all' ? selectedSprintId : null;
      const [analyticsData, stabilityData, recData, capData] = await Promise.all([
        velocityService.getVelocityAnalytics(projectId, sprintCount).catch(() => null),
        velocityService.getVelocityStability(projectId, sprintCount).catch(() => null),
        velocityService.getPlanningRecommendation(projectId, movingAvgWindow, activeSprint).catch(() => null),
        velocityService.getTeamCapacity(projectId, activeSprint).catch(() => null)
      ]);

      apiAnalytics = analyticsData;
      apiStability = stabilityData;
      apiRec = recData;
      apiCap = capData;
    } catch (err: any) {
      console.warn('Backend velocity analytics warning:', err);
    }

    if (apiAnalytics && apiAnalytics.sprints && apiAnalytics.sprints.length > 0) {
      setAnalytics(apiAnalytics);
      setStability(apiStability);
      setRecommendation(apiRec);
      setCapacity(apiCap);

      if (apiCap) {
        setCapacityWorkingDays(apiCap.workingDays || 10);
        setCapacityDailyHours(8);
        setCapacityManualSp(apiCap.isManuallyConfigured && apiCap.capacityStoryPoints ? String(apiCap.capacityStoryPoints) : '');
        setMemberCapacities(apiCap.memberCapacities || []);
      }
    } else if (propSprints && propSprints.length > 0) {
      // Use fallback calculation from in-memory project data
      const fallback = computeFallbackData(propSprints, propSprintTasksMap || {}, sprintCount, movingAvgWindow);
      if (fallback) {
        setAnalytics(fallback.fallbackAnalytics);
        setStability(apiStability || fallback.fallbackStability);
        setRecommendation(apiRec || fallback.fallbackRec);
        setCapacity(apiCap);
      } else {
        setAnalytics(apiAnalytics);
        setStability(apiStability);
        setRecommendation(apiRec);
        setCapacity(apiCap);
      }
    } else {
      setAnalytics(apiAnalytics);
      setStability(apiStability);
      setRecommendation(apiRec);
      setCapacity(apiCap);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const prevPropsKeyRef = useRef<string>('');
  const currentPropsKey = `${projectId}_${sprintCount}_${movingAvgWindow}_${selectedSprintId}_${propSprints?.length || 0}_${propTasks?.length || 0}`;

  useEffect(() => {
    if (projectId) {
      if (prevPropsKeyRef.current !== currentPropsKey) {
        prevPropsKeyRef.current = currentPropsKey;
        loadData();
      }
    }
  }, [projectId, sprintCount, movingAvgWindow, selectedSprintId, propSprints?.length, propTasks?.length]);

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      const activeSprint = selectedSprintId && selectedSprintId !== 'all' ? selectedSprintId : null;
      const parsedSp = capacityManualSp.trim() ? parseFloat(capacityManualSp) : undefined;
      const request: SprintCapacityRequest = {
        projectId,
        sprintId: activeSprint,
        workingDays: capacityWorkingDays,
        dailyHours: capacityDailyHours,
        storyPointsCapacity: parsedSp,
        isManual: parsedSp !== undefined && parsedSp > 0,
        memberCapacities: memberCapacities.map(m => ({
          ...m,
          workingDays: capacityWorkingDays,
          dailyHours: m.dailyHours || capacityDailyHours
        }))
      };

      const updatedCap = await velocityService.saveTeamCapacity(request);
      setCapacity(updatedCap);
      setCapacitySuccessMsg(true);
      setTimeout(() => setCapacitySuccessMsg(false), 2500);

      // Refresh recommendation
      const rec = await velocityService.getPlanningRecommendation(projectId, movingAvgWindow, activeSprint);
      setRecommendation(rec);
      setIsCapacityModalOpen(false);
    } catch (err) {
      console.error('Failed to save capacity:', err);
      alert('Failed to save capacity configuration.');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleMemberAvailabilityChange = (empId: string, percentage: number) => {
    setMemberCapacities(prev =>
      prev.map(m => {
        if (m.empId === empId) {
          const availPct = Math.max(0, Math.min(100, percentage));
          const dailyHrs = m.dailyHours || capacityDailyHours;
          const hrs = capacityWorkingDays * dailyHrs * (availPct / 100);
          return {
            ...m,
            availabilityPercentage: availPct,
            availableHours: Math.round(hrs * 10) / 10,
            availableDays: Math.round((hrs / dailyHrs) * 10) / 10
          };
        }
        return m;
      })
    );
  };

  // SVG Chart Geometry (exact match to Image 1 model)
  const rawSprints = analytics?.sprints || [];

  // Available distinct years dynamically extracted from sprint dates
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    rawSprints.forEach(s => {
      if (s.startDate) {
        const y = new Date(s.startDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(String(y));
      }
      if (s.endDate) {
        const y = new Date(s.endDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(String(y));
      }
    });

    if (propSprints && propSprints.length > 0) {
      propSprints.forEach(s => {
        if (s.startDate) {
          const y = new Date(s.startDate).getFullYear();
          if (!isNaN(y)) yearsSet.add(String(y));
        }
        if (s.endDate) {
          const y = new Date(s.endDate).getFullYear();
          if (!isNaN(y)) yearsSet.add(String(y));
        }
      });
    }

    // Always include current year
    const curY = new Date().getFullYear();
    yearsSet.add(String(curY));

    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [rawSprints, propSprints]);

  const isFilterActive = selectedYear !== 'ALL' || !!filterStartDate || !!filterEndDate;

  // Filter sprints by date and year
  const sprints = useMemo(() => {
    if (!isFilterActive) return rawSprints;

    return rawSprints.filter(s => {
      const propSprint = propSprints?.find(ps => ps.id === s.sprintId);
      const sDate = s.startDate || propSprint?.startDate;
      const eDate = s.endDate || propSprint?.endDate;

      // Filter by Year
      if (selectedYear !== 'ALL') {
        const targetYear = Number(selectedYear);
        let matchesYear = false;
        if (sDate) {
          const y = new Date(sDate).getFullYear();
          if (y === targetYear) matchesYear = true;
        }
        if (eDate) {
          const y = new Date(eDate).getFullYear();
          if (y === targetYear) matchesYear = true;
        }
        if (!sDate && !eDate) {
          const curY = new Date().getFullYear();
          if (curY === targetYear) matchesYear = true;
        }
        if (!matchesYear) return false;
      }

      // Filter by Start Date
      if (filterStartDate) {
        const effectiveEnd = eDate || sDate;
        if (effectiveEnd && effectiveEnd < filterStartDate) return false;
      }

      // Filter by End Date
      if (filterEndDate) {
        const effectiveStart = sDate || eDate;
        if (effectiveStart && effectiveStart > filterEndDate) return false;
      }

      return true;
    });
  }, [rawSprints, propSprints, isFilterActive, selectedYear, filterStartDate, filterEndDate]);

  const maxStoryPoints = useMemo(() => {
    if (!sprints.length) return 20;
    const maxVal = Math.max(
      ...sprints.map(s => Math.max(s.committedPoints || 0, s.completedPoints || 0)),
      analytics?.averageVelocity || 0,
      5
    );
    return Math.ceil(maxVal * 1.15);
  }, [sprints, analytics?.averageVelocity]);

  const svgWidth = 850;
  const svgHeight = 220;
  const chartLeft = 55;
  const chartRight = 815;
  const chartTop = 24;
  const chartBottom = 180;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Calculate ticks for Y axis (e.g. 0, 3, 6, 9, 10 or 0, 5, 10, 15, 20 like Image 1)
  const ticks = useMemo(() => {
    const max = maxStoryPoints;
    let t: number[] = [];
    if (max === 0) {
      t = [0, 1, 2, 3, 4, 5];
    } else if (max <= 5) {
      for (let i = 0; i <= max; i++) t.push(i);
    } else {
      const step = Math.max(1, Math.ceil(max / 4));
      for (let i = 0; i <= 4; i++) {
        const val = Math.min(max, i * step);
        if (!t.includes(val)) t.push(val);
      }
    }
    return t;
  }, [maxStoryPoints]);

  const getY = (val: number | null | undefined) => {
    if (val === null || val === undefined) return chartBottom;
    const clamped = Math.max(0, Math.min(val, maxStoryPoints));
    return chartBottom - ((clamped / (maxStoryPoints || 1)) * chartHeight);
  };

  const numSprints = sprints.length;
  const totalSlots = typeof sprintCount === 'number'
    ? Math.max(sprintCount, numSprints)
    : Math.max(5, numSprints);

  const slotWidth = chartWidth / (totalSlots || 1);

  const getX = (idx: number) => {
    return chartLeft + (idx + 0.5) * slotWidth;
  };

  const barWidth = totalSlots > 8 ? 16 : totalSlots > 4 ? 22 : 28;

  // Points calculation for line trend
  const createdPointsList = useMemo(() => {
    return sprints.map((s, i) => {
      const baseX = getX(i);
      const isCoinciding = s.committedPoints === s.completedPoints;
      const nodeX = isCoinciding ? baseX - 6 : baseX;
      return {
        x: nodeX,
        y: getY(s.committedPoints),
        val: s.committedPoints,
        sprintIdx: i
      };
    });
  }, [sprints, maxStoryPoints, totalSlots]);

  const completedPointsList = useMemo(() => {
    return sprints.map((s, i) => {
      const baseX = getX(i);
      const isCoinciding = s.committedPoints === s.completedPoints;
      const nodeX = isCoinciding ? baseX + 6 : baseX;
      return {
        x: nodeX,
        y: getY(s.completedPoints),
        val: s.completedPoints,
        sprintIdx: i
      };
    });
  }, [sprints, maxStoryPoints, totalSlots]);

  // Smooth curve generator with monotonic bounds (no negative dips below baseline or overshooting ceilings)
  const getCurvedPath = (pts: { x: number; y: number }[], isCompletedLine = false): string => {
    const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
    if (validPts.length === 0) return '';
    if (validPts.length === 1) {
      const p = validPts[0];
      const startX = chartLeft;
      const endX = Math.min(chartRight, chartLeft + slotWidth);
      if (isCompletedLine) {
        // Curve from 0 at chartLeft up to p.y at p.x and plateau across to endX
        const cpX = (startX + p.x) / 2;
        return `M ${startX.toFixed(1)} ${chartBottom} C ${cpX.toFixed(1)} ${chartBottom}, ${cpX.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${endX.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      return `M ${startX.toFixed(1)} ${p.y.toFixed(1)} L ${endX.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    let path = `M ${validPts[0].x.toFixed(1)} ${validPts[0].y.toFixed(1)}`;
    for (let i = 0; i < validPts.length - 1; i++) {
      const p0 = validPts[i === 0 ? 0 : i - 1] || validPts[0];
      const p1 = validPts[i] || validPts[0];
      const p2 = validPts[i + 1] || validPts[0];
      const p3 = (i + 2 < validPts.length ? validPts[i + 2] : p2) || p2;

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

      cp1y = Math.max(Math.max(minY, chartTop), Math.min(Math.min(maxY, chartBottom), cp1y));
      cp2y = Math.max(Math.max(minY, chartTop), Math.min(Math.min(maxY, chartBottom), cp2y));

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const getLinearPath = (pts: { x: number; y: number }[], isCompletedLine = false): string => {
    const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
    if (validPts.length === 0) return '';
    if (validPts.length === 1) {
      const p = validPts[0];
      const startX = chartLeft;
      const endX = Math.min(chartRight, chartLeft + slotWidth);
      if (isCompletedLine) {
        return `M ${startX.toFixed(1)} ${chartBottom} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${endX.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      return `M ${startX.toFixed(1)} ${p.y.toFixed(1)} L ${endX.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    return validPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  const getAreaPath = (pts: { x: number; y: number }[], baseY: number, isSmooth: boolean, isCompletedLine = false): string => {
    const validPts = pts.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
    if (validPts.length === 0) return '';
    if (validPts.length === 1) {
      const p = validPts[0];
      const startX = chartLeft;
      const endX = Math.min(chartRight, chartLeft + slotWidth);
      const line = isSmooth ? getCurvedPath(validPts, isCompletedLine) : getLinearPath(validPts, isCompletedLine);
      return `${line} L ${endX.toFixed(1)} ${baseY} L ${startX.toFixed(1)} ${baseY} Z`;
    }
    const line = isSmooth ? getCurvedPath(validPts, isCompletedLine) : getLinearPath(validPts, isCompletedLine);
    if (!line) return '';
    const first = validPts[0];
    const last = validPts[validPts.length - 1];
    if (!first || !last) return '';
    return `${line} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
  };

  const isSmooth = curveStyle === 'SMOOTH';
  const createdPathStr = useMemo(() => isSmooth ? getCurvedPath(createdPointsList, false) : getLinearPath(createdPointsList, false), [createdPointsList, isSmooth]);
  const completedPathStr = useMemo(() => isSmooth ? getCurvedPath(completedPointsList, true) : getLinearPath(completedPointsList, true), [completedPointsList, isSmooth]);
  const createdAreaStr = useMemo(() => getAreaPath(createdPointsList, chartBottom, isSmooth, false), [createdPointsList, isSmooth]);
  const completedAreaStr = useMemo(() => getAreaPath(completedPointsList, chartBottom, isSmooth, true), [completedPointsList, isSmooth]);

  // Effective average velocity (recomputed for filtered sprints when date/year filter is active)
  const effectiveAvgVelocity = useMemo(() => {
    if (!isFilterActive) return analytics?.averageVelocity || 0;
    if (sprints.length === 0) return 0;
    const total = sprints.reduce((sum, s) => sum + (s.completedPoints || 0), 0);
    return Math.round((total / sprints.length) * 100) / 100;
  }, [isFilterActive, analytics?.averageVelocity, sprints]);

  const avgVelocityY = effectiveAvgVelocity > 0 ? getY(effectiveAvgVelocity) : null;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SECTION A: VELOCITY TREND CHART (MATCHING IMAGE 1 MODEL) */}
      {/* ========================================================================= */}
      <div className="bg-white p-7 rounded-xl border border-[#DFE1E6] shadow-sm relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[16px] font-bold text-[#172B4D]">Historical Velocity Trend</h3>
              {isFilterActive && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] text-[#1F6FEB] font-medium">
                  <Calendar size={11} className="text-[#1F6FEB]" />
                  <span>
                    {selectedYear !== 'ALL' && `Year ${selectedYear}`}
                    {selectedYear !== 'ALL' && (filterStartDate || filterEndDate) && ' • '}
                    {filterStartDate && filterEndDate
                      ? `${filterStartDate} ~ ${filterEndDate}`
                      : filterStartDate
                        ? `From ${filterStartDate}`
                        : filterEndDate
                          ? `Until ${filterEndDate}`
                          : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear('ALL');
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="ml-0.5 text-[#1F6FEB] hover:text-blue-800 p-0.5 rounded-full hover:bg-blue-100 cursor-pointer"
                    title="Clear date filter"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#5E6C84]">
              Committed versus completed story points per sprint with completion trajectory and historical average.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* VIEW SWITCHER: Sprint Bars vs Line Trend */}
            <div className="inline-flex items-center p-0.5 rounded-lg border border-[#DFE1E6] bg-white">
              <button
                type="button"
                onClick={() => setChartMode('BAR')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${chartMode === 'BAR'
                  ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                  }`}
                title="Sprint Bars View"
              >
                <BarChart3 size={13} />
                <span>Sprint Bars</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('LINE')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${chartMode === 'LINE'
                  ? 'bg-blue-50 text-[#1F6FEB] shadow-2xs'
                  : 'text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-50'
                  }`}
                title="Line Trend View"
              >
                <TrendingUp size={13} />
                <span>Line Trend</span>
              </button>
            </div>

            {/* CURVE STYLE TOGGLE (When Line Trend is visible) */}
            {chartMode !== 'BAR' && (
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

            {/* SPRINT WINDOW FILTER */}
            <div className="flex items-center bg-[#F4F5F7] p-1 rounded-lg border border-[#DFE1E6]">
              <span className="text-[11px] font-bold text-[#5E6C84] px-2.5">Window:</span>
              {(['3', '5', '10', 'ALL'] as const).map(w => {
                const val = w === 'ALL' ? 'ALL' : Number(w);
                const isActive = sprintCount === val;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSprintCount(val as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${isActive
                      ? 'bg-white text-[#1F6FEB] shadow-xs border border-[#DFE1E6]'
                      : 'text-[#5E6C84] hover:text-[#172B4D]'
                      }`}
                  >
                    {w === 'ALL' ? 'All Sprints' : `Last ${w}`}
                  </button>
                );
              })}
            </div>

            {/* DATE & YEAR FILTER BUTTON (MATCHING IMAGE 1) */}
            <div className="relative" ref={dateFilterRef}>
              <button
                type="button"
                onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                className={`p-2 rounded-lg border transition-all cursor-pointer relative flex items-center justify-center ${isFilterActive || isDateFilterOpen
                    ? 'bg-blue-50 text-[#1F6FEB] border-[#1F6FEB] shadow-2xs font-bold'
                    : 'text-[#5E6C84] hover:text-[#172B4D] bg-[#F4F5F7] hover:bg-[#EBECF0] border-[#DFE1E6]'
                  }`}
                title="Filter Sprints by Dates & Years"
              >
                <Calendar size={15} />
                {isFilterActive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1F6FEB] rounded-full border-2 border-white ring-1 ring-blue-300" />
                )}
              </button>

              {/* DATE / YEAR FILTER DROPDOWN POPOVER */}
              {isDateFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#DFE1E6] p-4 z-50 text-left">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#EBECF0]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-[#1F6FEB] rounded-md">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#172B4D]">Filter by Dates & Years</h4>
                        <p className="text-[10px] text-[#5E6C84]">Filter velocity trend by sprint dates</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDateFilterOpen(false)}
                      className="text-[#5E6C84] hover:text-[#172B4D] p-1 rounded-md hover:bg-gray-100 cursor-pointer"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Filter Body */}
                  <div className="py-3 space-y-3.5">
                    {/* Year Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider">
                          Year
                        </label>
                        {selectedYear !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => setSelectedYear('ALL')}
                            className="text-[10px] font-bold text-[#1F6FEB] hover:underline cursor-pointer"
                          >
                            All Years
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYear('ALL');
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${selectedYear === 'ALL'
                              ? 'bg-[#1F6FEB] text-white shadow-2xs'
                              : 'bg-[#F4F5F7] text-[#5E6C84] hover:bg-[#EBECF0] hover:text-[#172B4D]'
                            }`}
                        >
                          All Years
                        </button>
                        {availableYears.map(yr => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setSelectedYear(yr);
                              setFilterStartDate(`${yr}-01-01`);
                              setFilterEndDate(`${yr}-12-31`);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${selectedYear === yr
                                ? 'bg-[#1F6FEB] text-white shadow-2xs'
                                : 'bg-[#F4F5F7] text-[#5E6C84] hover:bg-[#EBECF0] hover:text-[#172B4D]'
                              }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1.5">
                        Quick Range Presets
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const curY = String(new Date().getFullYear());
                            setSelectedYear(curY);
                            setFilterStartDate(`${curY}-01-01`);
                            setFilterEndDate(`${curY}-12-31`);
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#F4F5F7] text-[#172B4D] hover:bg-blue-50 hover:text-[#1F6FEB] border border-[#DFE1E6] transition-all cursor-pointer"
                        >
                          This Year
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date();
                            past.setMonth(past.getMonth() - 6);
                            setSelectedYear('ALL');
                            setFilterStartDate(past.toISOString().substring(0, 10));
                            setFilterEndDate(now.toISOString().substring(0, 10));
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#F4F5F7] text-[#172B4D] hover:bg-blue-50 hover:text-[#1F6FEB] border border-[#DFE1E6] transition-all cursor-pointer"
                        >
                          Last 6 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date();
                            past.setMonth(past.getMonth() - 3);
                            setSelectedYear('ALL');
                            setFilterStartDate(past.toISOString().substring(0, 10));
                            setFilterEndDate(now.toISOString().substring(0, 10));
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#F4F5F7] text-[#172B4D] hover:bg-blue-50 hover:text-[#1F6FEB] border border-[#DFE1E6] transition-all cursor-pointer"
                        >
                          Last 3 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date();
                            past.setDate(past.getDate() - 30);
                            setSelectedYear('ALL');
                            setFilterStartDate(past.toISOString().substring(0, 10));
                            setFilterEndDate(now.toISOString().substring(0, 10));
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#F4F5F7] text-[#172B4D] hover:bg-blue-50 hover:text-[#1F6FEB] border border-[#DFE1E6] transition-all cursor-pointer"
                        >
                          Last 30 Days
                        </button>
                      </div>
                    </div>

                    {/* Custom Date Range */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1.5">
                        Custom Date Range
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[10px] text-[#5E6C84] mb-0.5">From:</span>
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={e => {
                              setFilterStartDate(e.target.value);
                              setSelectedYear('ALL');
                            }}
                            className="w-full text-xs border border-[#DFE1E6] rounded-md px-2 py-1.5 text-[#172B4D] bg-white focus:outline-none focus:border-[#1F6FEB] focus:ring-1 focus:ring-[#1F6FEB]"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#5E6C84] mb-0.5">To:</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={e => {
                              setFilterEndDate(e.target.value);
                              setSelectedYear('ALL');
                            }}
                            className="w-full text-xs border border-[#DFE1E6] rounded-md px-2 py-1.5 text-[#172B4D] bg-white focus:outline-none focus:border-[#1F6FEB] focus:ring-1 focus:ring-[#1F6FEB]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Popover Footer */}
                  <div className="pt-3 border-t border-[#EBECF0] flex items-center justify-between">
                    <span className="text-[11px] text-[#5E6C84] font-medium">
                      {sprints.length === rawSprints.length
                        ? `All ${sprints.length} sprints shown`
                        : `${sprints.length} of ${rawSprints.length} sprints match`}
                    </span>
                    <div className="flex items-center gap-2">
                      {isFilterActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYear('ALL');
                            setFilterStartDate('');
                            setFilterEndDate('');
                          }}
                          className="text-xs font-bold text-[#5E6C84] hover:text-[#172B4D] px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDateFilterOpen(false)}
                        className="text-xs font-bold text-white bg-[#1F6FEB] hover:bg-blue-600 px-3 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && !analytics ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-[#1F6FEB]" />
            <span className="text-xs font-bold text-[#5E6C84]">Calculating sprint velocity analytics...</span>
          </div>
        ) : sprints.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FAFBFC] rounded-lg border border-dashed border-[#DFE1E6]">
            <div className="p-3 bg-blue-50 text-[#1F6FEB] rounded-full mb-3">
              <Calendar size={28} />
            </div>
            <h4 className="text-sm font-bold text-[#172B4D]">
              {isFilterActive ? 'No Sprints Match Selected Dates' : 'No Sprints Found'}
            </h4>
            <p className="text-xs text-[#5E6C84] max-w-md mt-1">
              {isFilterActive
                ? 'No sprints were found matching the selected year or date range. Try clearing or expanding your date filters.'
                : 'Historical velocity calculations require active or completed sprints. Once sprints are started or completed, their committed and completed points will appear here.'}
            </p>
            {isFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear('ALL');
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="mt-3 px-3 py-1.5 text-xs font-bold text-[#1F6FEB] bg-white border border-[#DFE1E6] rounded-md hover:bg-blue-50 transition-all cursor-pointer"
              >
                Reset Date Filters
              </button>
            )}
          </div>
        ) : (
          <div className="w-full relative pt-2 pb-1">
            <svg
              className="w-full h-auto overflow-visible"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            >
              <defs>
                <filter id="veloTooltipShadow" x="-15%" y="-15%" width="130%" height="130%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#091E42" floodOpacity="0.15" />
                </filter>
                <linearGradient id="veloCreatedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1F6FEB" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#1F6FEB" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="veloCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y-Axis Label (exact match to Image 1) */}
              <text
                x={chartLeft}
                y={chartTop - 10}
                textAnchor="start"
                className="text-[10px] font-bold fill-[#6B778C] tracking-wider"
              >
                STORY POINTS (SP)
              </text>

              {/* Grid Lines & Y-Axis Ticks */}
              {ticks.map(tickVal => {
                const y = getY(tickVal);
                return (
                  <g key={`y-grid-${tickVal}`}>
                    <line
                      x1={chartLeft}
                      y1={y}
                      x2={chartRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={chartLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[10px] font-bold fill-[#6B778C]"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Vertical Baseline */}
              <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#CBD5E1" strokeWidth="1" />

              {/* X-Axis Horizontal Baseline */}
              <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#CBD5E1" strokeWidth="1" />

              {/* Average Velocity Horizontal Reference Line */}
              {avgVelocityY !== null && effectiveAvgVelocity > 0 && (
                <g key="avg-ref-line">
                  <line
                    x1={chartLeft}
                    y1={avgVelocityY}
                    x2={chartRight}
                    y2={avgVelocityY}
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                  />
                  {/* Badge on Right */}
                  <rect
                    x={chartRight - 74}
                    y={avgVelocityY - 9}
                    width="74"
                    height="18"
                    rx="3"
                    fill="#FEF3C7"
                    stroke="#F59E0B"
                    strokeWidth="1"
                  />
                  <text
                    x={chartRight - 37}
                    y={avgVelocityY + 3.5}
                    textAnchor="middle"
                    className="text-[9.5px] font-bold fill-[#92400E]"
                  >
                    AVG: {effectiveAvgVelocity} SP
                  </text>
                </g>
              )}

              {/* LINE TREND: Area Fills (only in pure LINE mode) */}
              {chartMode === 'LINE' && (
                <>
                  {createdAreaStr && <path d={createdAreaStr} fill="url(#veloCreatedGradient)" />}
                  {completedAreaStr && <path d={completedAreaStr} fill="url(#veloCompletedGradient)" />}
                </>
              )}

              {/* BARS (in BAR mode) */}
              {chartMode === 'BAR' && (
                sprints.map((sprint, i) => {
                  const x = getX(i);
                  const isHovered = hoveredSprintIdx === i;
                  const committedH = Math.max(0, chartBottom - getY(sprint.committedPoints));
                  const completedH = Math.max(0, chartBottom - getY(sprint.completedPoints));

                  return (
                    <g
                      key={`sprint-bars-${sprint.sprintId}`}
                      opacity={isHovered ? 1 : 0.95}
                    >
                      {/* Story points created / committed (Solid Blue #1F6FEB) */}
                      {sprint.committedPoints > 0 ? (
                        <rect
                          x={x - barWidth - 1.5}
                          y={chartBottom - committedH}
                          width={barWidth}
                          height={committedH}
                          rx="0"
                          fill="#1F6FEB"
                          stroke={isHovered ? '#1557B0' : 'none'}
                          strokeWidth={isHovered ? 1.5 : 0}
                          className="transition-all"
                        />
                      ) : (
                        <circle cx={x - (barWidth / 2) - 1.5} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                      )}

                      {/* Story points completed (Solid Green #10B981) */}
                      {sprint.completedPoints > 0 ? (
                        <rect
                          x={x + 1.5}
                          y={chartBottom - completedH}
                          width={barWidth}
                          height={completedH}
                          rx="0"
                          fill="#10B981"
                          stroke={isHovered ? '#059669' : 'none'}
                          strokeWidth={isHovered ? 1.5 : 0}
                          className="transition-all"
                        />
                      ) : (
                        <circle cx={x + (barWidth / 2) + 1.5} cy={chartBottom - 1.5} r="1.5" fill="#CBD5E1" />
                      )}
                    </g>
                  );
                })
              )}

              {/* LINE TREND: Connected Paths (in LINE mode) */}
              {chartMode === 'LINE' && (
                <>
                  {createdPathStr && (
                    <path
                      d={createdPathStr}
                      fill="none"
                      stroke="#1F6FEB"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6,4"
                      opacity={0.95}
                    />
                  )}
                  {completedPathStr && (
                    <path
                      d={completedPathStr}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Circular Nodes for Created Points */}
                  {createdPointsList.map((p, i) => {
                    const isHovered = hoveredSprintIdx === i;
                    const r = isHovered ? 6.5 : (p.val > 0 ? 5 : 3.5);
                    return (
                      <g key={`created-node-${i}`} className="transition-all">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill="#FFFFFF"
                          stroke="#1F6FEB"
                          strokeWidth={isHovered ? 3 : 2}
                        />
                        <circle cx={p.x} cy={p.y} r={isHovered ? 3 : 2} fill="#1F6FEB" />
                      </g>
                    );
                  })}

                  {/* Circular Nodes for Completed Points */}
                  {completedPointsList.map((p, i) => {
                    const isHovered = hoveredSprintIdx === i;
                    const r = isHovered ? 6.5 : (p.val > 0 ? 5 : 3.5);
                    return (
                      <g key={`completed-node-${i}`} className="transition-all">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill="#FFFFFF"
                          stroke="#10B981"
                          strokeWidth={isHovered ? 3 : 2}
                        />
                        <circle cx={p.x} cy={p.y} r={isHovered ? 3 : 2} fill="#10B981" />
                      </g>
                    );
                  })}
                </>
              )}

              {/* X-Axis Tick Marks, Labels, and Interactive Hover Target Zones */}
              {sprints.map((sprint, i) => {
                const x = getX(i);
                const isHovered = hoveredSprintIdx === i;
                const committedH = Math.max(0, chartBottom - getY(sprint.committedPoints));
                const completedH = Math.max(0, chartBottom - getY(sprint.completedPoints));
                const maxBarH = Math.max(committedH, completedH, 30);
                const isActive = (sprint.status || '').toUpperCase() === 'ACTIVE';

                const formatDateSubtitle = () => {
                  if (sprint.startDate && sprint.endDate) {
                    const s = sprint.startDate.substring(5);
                    const e = sprint.endDate.substring(5);
                    return `${s} - ${e}`;
                  }
                  if (sprint.startDate) return sprint.startDate.substring(5);
                  return isActive ? 'Active' : sprint.status || '';
                };

                return (
                  <g
                    key={`sprint-slot-${sprint.sprintId}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSprintIdx(i)}
                    onMouseLeave={() => setHoveredSprintIdx(null)}
                  >
                    {/* Hover Target strictly around this sprint's slot */}
                    <rect
                      x={x - barWidth - 10}
                      y={Math.min(chartBottom - maxBarH - 15, chartBottom - 25)}
                      width={(barWidth + 10) * 2}
                      height={maxBarH + 55}
                      fill="transparent"
                    />

                    {/* X-Axis Tick Mark */}
                    <line x1={x} y1={chartBottom} x2={x} y2={chartBottom + 4} stroke="#CBD5E1" strokeWidth="1" />

                    {/* Sprint Name (Line 1) */}
                    <text
                      x={x}
                      y={chartBottom + 16}
                      textAnchor="middle"
                      className={`text-[10px] font-bold ${isHovered ? 'fill-[#1F6FEB]' : 'fill-[#172B4D]'}`}
                    >
                      {sprint.sprintName}
                    </text>

                    {/* Sprint Date (Line 2) */}
                    <text
                      x={x}
                      y={chartBottom + 27}
                      textAnchor="middle"
                      className="text-[8.5px] font-medium fill-[#94A3B8]"
                    >
                      {formatDateSubtitle()}
                    </text>
                  </g>
                );
              })}

              {/* Interactive Hover Tooltip (clean card with drop shadow) */}
              {hoveredSprintIdx !== null && sprints[hoveredSprintIdx] && (() => {
                const s = sprints[hoveredSprintIdx];
                const x = getX(hoveredSprintIdx);
                const tipW = 195;
                const tipH = 88;
                const tipX = Math.max(chartLeft + 4, Math.min(chartRight - tipW - 4, x - tipW / 2));
                const tipY = Math.max(chartTop - 10, Math.min(getY(Math.max(s.committedPoints, s.completedPoints)) - tipH - 12, chartBottom - tipH));
                const diff = s.difference;
                const isActive = (s.status || '').toUpperCase() === 'ACTIVE';

                return (
                  <g className="pointer-events-none transition-all">
                    {/* Tooltip Card Box */}
                    <rect
                      x={tipX}
                      y={tipY}
                      width={tipW}
                      height={tipH}
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#DFE1E6"
                      strokeWidth="1"
                      filter="url(#veloTooltipShadow)"
                    />

                    {/* Sprint Title & Badge */}
                    <text
                      x={tipX + 12}
                      y={tipY + 18}
                      fontSize="11.5"
                      fontWeight="bold"
                      fill="#172B4D"
                    >
                      {s.sprintName}
                    </text>
                    {isActive && (
                      <text
                        x={tipX + tipW - 12}
                        y={tipY + 18}
                        textAnchor="end"
                        fontSize="9"
                        fontWeight="bold"
                        fill="#1F6FEB"
                      >
                        ● Active
                      </text>
                    )}

                    {/* Story points created / committed */}
                    <circle cx={tipX + 16} cy={tipY + 34} r="3.5" fill="#1F6FEB" />
                    <text x={tipX + 26} y={tipY + 37} fontSize="10" fill="#5E6C84" fontWeight="600">
                      Story points created: <tspan fill="#172B4D" fontWeight="bold">{s.committedPoints} SP</tspan>
                    </text>

                    {/* Story points completed */}
                    <circle cx={tipX + 16} cy={tipY + 51} r="3.5" fill="#10B981" />
                    <text x={tipX + 26} y={tipY + 54} fontSize="10" fill="#5E6C84" fontWeight="600">
                      Story points completed: <tspan fill="#172B4D" fontWeight="bold">{s.completedPoints} SP</tspan>
                    </text>

                    {/* Delta Gap */}
                    <text x={tipX + 12} y={tipY + 72} fontSize="9.5" fill={diff >= 0 ? '#10B981' : '#E11D48'} fontWeight="bold">
                      Delta: {diff >= 0 ? `+${diff}` : diff} SP gap {s.committedPoints > 0 ? `(${Math.round((s.completedPoints / s.committedPoints) * 100)}% delivered)` : ''}
                    </text>
                  </g>
                );
              })()}
            </svg>

            {/* Clean Legend Bar directly below the graph */}
            <div className="flex flex-wrap items-center justify-center gap-7 px-6 pt-3 pb-1 border-t border-[#F4F5F7]">
              <div className="flex items-center gap-2">
                {chartMode === 'LINE' ? (
                  <div className="flex items-center">
                    <div className="w-3.5 h-0.5 bg-[#1F6FEB]"></div>
                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-[#1F6FEB] border-2 border-white"></div>
                    <div className="w-3.5 h-0.5 -ml-1 bg-[#1F6FEB]"></div>
                  </div>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-xs bg-[#1F6FEB]"></div>
                )}
                <span className="text-xs font-bold text-[#172B4D]">Story points created</span>
              </div>
              <div className="flex items-center gap-2">
                {chartMode === 'LINE' ? (
                  <div className="flex items-center">
                    <div className="w-3.5 h-0.5 bg-[#10B981]"></div>
                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-[#10B981] border-2 border-white"></div>
                    <div className="w-3.5 h-0.5 -ml-1 bg-[#10B981]"></div>
                  </div>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-xs bg-[#10B981]"></div>
                )}
                <span className="text-xs font-bold text-[#172B4D]">Story points completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-[#F59E0B]"></div>
                <span className="text-xs font-bold text-[#5E6C84]">
                  Average velocity {effectiveAvgVelocity > 0 ? `(${effectiveAvgVelocity} SP)` : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION B: VELOCITY STABILITY ANALYSIS */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-xl border border-[#DFE1E6] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#EBECF0]">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Velocity Stability</h3>
            <p className="text-[11px] text-[#5E6C84]">
              Statistical variance analysis using Population Standard Deviation (σ) and Coefficient of Variation (CV).
            </p>
          </div>

          {/* Stability Indicator Badge */}
          {stability && (
            <div className="flex items-center gap-2">
              {stability.stabilityIndicator === 'STABLE' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle size={13} className="text-green-600" />
                  Stable Delivery (CV: {stability.coefficientOfVariation}%)
                </span>
              ) : stability.stabilityIndicator === 'MODERATELY_VARIABLE' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle size={13} className="text-amber-600" />
                  Moderately Variable (CV: {stability.coefficientOfVariation}%)
                </span>
              ) : stability.stabilityIndicator === 'HIGHLY_VARIABLE' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle size={13} className="text-rose-600" />
                  Highly Variable (CV: {stability.coefficientOfVariation}%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                  <Info size={13} />
                  N/A (Insufficient Sprints)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stability Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3.5">
          {/* Card 1: Average Velocity */}
          <div className="p-3.5 bg-[#FAFBFC] rounded-lg border border-[#EBECF0] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1F6FEB] shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider block">
                  Average Velocity
                </span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-xl font-black text-[#172B4D]">
                    {stability?.roundedAverageVelocity || 0}
                  </span>
                  <span className="text-xs font-bold text-[#5E6C84]">SP</span>
                  <span className="text-[11px] text-[#5E6C84] ml-1">
                    ({stability?.averageVelocity || 0} SP)
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[10.5px] text-[#5E6C84] text-right leading-snug hidden md:block max-w-[150px]">
              Calculated across {stability?.sprintsAnalyzedCount || 0} completed sprint{stability?.sprintsAnalyzedCount === 1 ? '' : 's'}.
            </p>
          </div>

          {/* Card 2: Recent Velocity (Last 3 Sprints) */}
          <div className="p-3.5 bg-[#FAFBFC] rounded-lg border border-[#EBECF0] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10B981] shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider">
                    Recent Velocity
                  </span>
                  <span className="text-[9.5px] font-bold text-[#1F6FEB] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                    Last 3
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-xl font-black text-[#172B4D]">
                    {stability?.roundedRecentVelocity || 0}
                  </span>
                  <span className="text-xs font-bold text-[#5E6C84]">SP</span>
                  <span className="text-[11px] text-[#5E6C84] ml-1">
                    ({stability?.recentVelocity || 0} SP)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Utilization Percentage */}
          {(() => {
            const getSprintCommitmentAndUtil = (s: { completedPoints: number; committedPoints?: number }) => {
              const committed = (s.committedPoints && s.committedPoints > 0)
                ? s.committedPoints
                : (s.completedPoints > 0 ? s.completedPoints : (recommendation?.roundedHistoricalAverage || 8));
              const completed = s.completedPoints || 0;
              const util = committed > 0 ? Math.round((completed / committed) * 100) : 100;
              return { committed, completed, util };
            };

            const recentSprints = recommendation?.includedSprints && recommendation.includedSprints.length > 0
              ? recommendation.includedSprints.slice(-3)
              : null;

            const { overallUtil, totalCompleted, totalCommitted } = recentSprints
              ? (() => {
                  const comp = recentSprints.reduce((sum, s) => sum + s.completedPoints, 0);
                  const comm = recentSprints.reduce((sum, s) => sum + getSprintCommitmentAndUtil(s).committed, 0);
                  const util = comm > 0 ? Math.round((comp / comm) * 100) : 100;
                  return { overallUtil: util, totalCompleted: comp, totalCommitted: comm };
                })()
              : { overallUtil: 100, totalCompleted: 8, totalCommitted: 8 };

            const progressClamped = Math.min(100, Math.max(0, overallUtil));

            return (
              <div className="p-3.5 bg-[#FAFBFC] rounded-lg border border-[#EBECF0] flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10B981] shrink-0">
                      <Percent size={18} />
                    </div>
                    <div>
                      <span className="text-[10.5px] font-bold text-[#5E6C84] uppercase tracking-wider block">
                        Utilization Percentage
                      </span>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-[#172B4D]">
                          {overallUtil}
                        </span>
                        <span className="text-xs font-bold text-[#5E6C84]">%</span>
                        <span className="text-[11px] text-[#5E6C84]">
                          ({totalCompleted}/{totalCommitted} SP)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {recentSprints ? (
                      recentSprints.map((s, idx) => {
                        const { committed, completed, util } = getSprintCommitmentAndUtil(s);
                        return (
                          <span
                            key={s.sprintId || idx}
                            title={`${completed} SP completed of ${committed} SP committed`}
                            className="text-[10.5px] font-bold text-[#1F6FEB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block whitespace-nowrap"
                          >
                            {s.sprintName || `Sprint ${idx + 1}`}: {util}%
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs font-bold text-[#1F6FEB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block">
                        Sprint 1: 100%
                      </span>
                    )}
                  </div>
                </div>

                {/* Sleek Progress Bar */}
                <div className="w-full">
                  <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        overallUtil >= 90
                          ? 'bg-[#10B981]'
                          : overallUtil >= 75
                          ? 'bg-[#1F6FEB]'
                          : 'bg-[#F59E0B]'
                      }`}
                      style={{ width: `${progressClamped}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>


      {/* ========================================================================= */}
      {/* CAPACITY CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {isCapacityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#DFE1E6] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#EBECF0] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-[#1F6FEB] rounded-lg">
                  <Sliders size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Sprint & Team Capacity Configuration</h3>
                  <p className="text-xs text-[#5E6C84]">Configure working days, hours, and member availability for upcoming cycles.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCapacityModalOpen(false)}
                className="text-[#5E6C84] hover:text-[#172B4D] p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {capacitySuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-xs font-bold">
                  <Check size={16} className="text-green-600" />
                  Capacity settings successfully updated!
                </div>
              )}

              {/* General Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#F8FAFC] rounded-lg border border-[#EBECF0]">
                <div>
                  <label className="text-[11px] font-bold text-[#5E6C84] uppercase block mb-1">
                    Sprint Working Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={capacityWorkingDays}
                    onChange={e => setCapacityWorkingDays(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full px-3 py-1.5 bg-white border border-[#DFE1E6] rounded-md text-sm font-semibold text-[#172B4D] focus:outline-none focus:border-[#1F6FEB]"
                  />
                  <span className="text-[10px] text-[#8993A4] mt-0.5 block">Default 10 days (2 weeks)</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5E6C84] uppercase block mb-1">
                    Daily Working Hours
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={capacityDailyHours}
                    onChange={e => setCapacityDailyHours(Math.max(1, parseFloat(e.target.value) || 8))}
                    className="w-full px-3 py-1.5 bg-white border border-[#DFE1E6] rounded-md text-sm font-semibold text-[#172B4D] focus:outline-none focus:border-[#1F6FEB]"
                  />
                  <span className="text-[10px] text-[#8993A4] mt-0.5 block">Standard 8.0 hrs/day</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5E6C84] uppercase block mb-1">
                    Manual SP Override
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Auto (from hours)"
                    value={capacityManualSp}
                    onChange={e => setCapacityManualSp(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#DFE1E6] rounded-md text-sm font-semibold text-[#172B4D] focus:outline-none focus:border-[#1F6FEB]"
                  />
                  <span className="text-[10px] text-[#8993A4] mt-0.5 block">Optional direct story points</span>
                </div>
              </div>

              {/* Individual Team Members */}
              <div>
                <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider mb-2">
                  Individual Team Member Availability ({memberCapacities.length} Members)
                </h4>
                <div className="border border-[#DFE1E6] rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAFBFC] border-b border-[#DFE1E6] text-[10px] font-bold text-[#6B778C] uppercase">
                        <th className="py-2.5 px-3">Team Member</th>
                        <th className="py-2.5 px-3">Emp ID</th>
                        <th className="py-2.5 px-3 text-center">Availability</th>
                        <th className="py-2.5 px-3 text-right">Available Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EBECF0]">
                      {memberCapacities.map(member => (
                        <tr key={member.empId} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                            {member.memberName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#5E6C84]">
                            {member.empId}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={member.availabilityPercentage}
                                onChange={e =>
                                  handleMemberAvailabilityChange(member.empId, parseFloat(e.target.value))
                                }
                                className="w-20 accent-[#1F6FEB] cursor-pointer"
                              />
                              <span className="font-bold text-[#172B4D] w-10 text-right">
                                {member.availabilityPercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#172B4D]">
                            {member.availableHours} hrs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAFBFC] border-t border-[#EBECF0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCapacityModalOpen(false)}
                className="px-4 py-2 border border-[#DFE1E6] text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCapacity}
                disabled={savingCapacity}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1F6FEB] text-white rounded-lg text-xs font-bold hover:bg-[#0747A6] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                <span>{savingCapacity ? 'Saving...' : 'Save Capacity Configuration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VelocityAnalyticsTab;
