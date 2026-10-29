import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  Settings,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Edit2,
  RotateCcw,
  ArrowRight,
  Plus,
  Trash2,
  X,
  ExternalLink,
  ChevronDown,
  BarChart3,
  PieChart,
  HelpCircle,
  History,
  MessageSquare,
  User,
  Calendar,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  FileText
} from 'lucide-react';
import api from '../services/api';
import { financialService } from '../services/financialService';
import type {
  Project,
  ProjectFinancialSummaryDTO,
  TaskFinancialDTO,
  ProjectBudgetSettingsRequest,
  ProjectBudgetCategoryDTO,
  TaskBudgetUpdateRequest,
  ProjectBudgetHistoryDTO,
} from '../types';
import TaskDetailModal from '../components/TaskDetailModal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export const formatCurrency = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const rounded = Math.round(val);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
};

export const formatRelativeTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatFullDateTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

const FinancialAnalytics: React.FC = () => {
  const { id: paramProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { addNotification } = useNotifications();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    paramProjectId ? Number(paramProjectId) : null
  );
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const [summary, setSummary] = useState<ProjectFinancialSummaryDTO | null>(null);
  const [taskFinancials, setTaskFinancials] = useState<TaskFinancialDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'SETTINGS' | 'HISTORY'>('SETTINGS');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedTaskForOverride, setSelectedTaskForOverride] = useState<TaskFinancialDTO | null>(null);

  // Budget History State
  const [budgetHistories, setBudgetHistories] = useState<ProjectBudgetHistoryDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Task Detail Modal
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<ProjectBudgetSettingsRequest>({
    totalBudget: 0,
    contingencyPercent: 0,
    defaultHourlyRate: 0,
    costPerStoryPoint: 0,
    budgetAllocationMethod: 'STORY_POINT_WEIGHTED',
    changeReason: '',
    categories: [],
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Override Form State
  const [overrideForm, setOverrideForm] = useState<TaskBudgetUpdateRequest>({
    allocatedBudget: 0,
    actualCost: 0,
    budgetAllocationSource: 'MANUAL',
    category: 'Core Features',
  });

  const isManagerOrAdmin = authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN';

  // Fetch all projects list
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get<Project[]>('/projects');
        setProjects(res.data || []);
        if (!selectedProjectId && res.data && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching projects', err);
      }
    };
    fetchProjects();
  }, []);

  // Update selectedProjectId if URL param changes
  useEffect(() => {
    if (paramProjectId) {
      setSelectedProjectId(Number(paramProjectId));
    }
  }, [paramProjectId]);

  // Load project financial data when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      loadFinancialData(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadBudgetHistory = async (projId: number) => {
    try {
      setLoadingHistory(true);
      const historyData = await financialService.getBudgetHistory(projId);
      setBudgetHistories(historyData || []);
    } catch (err) {
      console.error('Error loading budget history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFinancialData = async (projId: number) => {
    setLoading(true);
    try {
      const [sumRes, tasksRes, projRes, historyRes] = await Promise.all([
        financialService.getFinancialSummary(projId),
        financialService.getTaskFinancials(projId),
        api.get<Project>(`/projects/${projId}`),
        financialService.getBudgetHistory(projId).catch(() => []),
      ]);
      setSummary(sumRes);
      setTaskFinancials(tasksRes);
      setCurrentProject(projRes.data);
      setBudgetHistories(historyRes || []);

      // Populate initial settings form
      setSettingsForm({
        totalBudget: sumRes.totalBudget || 0,
        contingencyPercent: sumRes.contingencyPercent || 0,
        defaultHourlyRate: sumRes.defaultHourlyRate || 0,
        costPerStoryPoint: sumRes.costPerStoryPoint || 0,
        budgetAllocationMethod: sumRes.budgetAllocationMethod || 'STORY_POINT_WEIGHTED',
        changeReason: '',
        categories:
          sumRes.categories && sumRes.categories.length > 0
            ? sumRes.categories.map((c) => ({
              id: c.id,
              category: c.category,
              allocationPercent: c.allocationPercent,
              allocatedAmount: c.allocatedAmount,
            }))
            : [
              { category: 'Core Features', allocationPercent: 60 },
              { category: 'Technical Infrastructure', allocationPercent: 20 },
              { category: 'Bug/Maintenance', allocationPercent: 10 },
              { category: 'Contingency', allocationPercent: 10 },
            ],
      });
    } catch (err) {
      console.error('Error loading financial analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async (resetManual = false) => {
    if (!selectedProjectId) return;
    setRecalculating(true);
    try {
      const updatedSummary = await financialService.recalculateBudget(selectedProjectId, resetManual);
      const updatedTasks = await financialService.getTaskFinancials(selectedProjectId);
      setSummary(updatedSummary);
      setTaskFinancials(updatedTasks);
      await loadBudgetHistory(selectedProjectId);
      addNotification('success', resetManual ? 'Budget recalculated & manual overrides reset' : 'Budget recalculated successfully');
    } catch (err) {
      console.error('Recalculate failed', err);
      addNotification('error', 'Failed to recalculate budget');
    } finally {
      setRecalculating(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setSettingsError(null);

    // Validate
    if ((settingsForm.totalBudget || 0) < 0) {
      setSettingsError('Total budget must be non-negative');
      return;
    }
    if ((settingsForm.contingencyPercent || 0) < 0 || (settingsForm.contingencyPercent || 0) > 100) {
      setSettingsError('Contingency percent must be between 0 and 100%');
      return;
    }
    if ((settingsForm.defaultHourlyRate || 0) < 0) {
      setSettingsError('Default hourly rate must be non-negative');
      return;
    }
    if ((settingsForm.costPerStoryPoint || 0) < 0) {
      setSettingsError('Cost per story point must be non-negative');
      return;
    }

    if (settingsForm.budgetAllocationMethod === 'CATEGORY_BASED') {
      const totalPct = (settingsForm.categories || []).reduce(
        (sum, c) => sum + (Number(c.allocationPercent) || 0),
        0
      );
      if (Math.round(totalPct) !== 100) {
        setSettingsError(`Category allocation percentages must total 100% (currently ${totalPct}%)`);
        return;
      }
    }

    try {
      const updated = await financialService.updateProjectBudget(selectedProjectId, settingsForm);
      if (settingsForm.budgetAllocationMethod === 'STORY_POINT_WEIGHTED' && (settingsForm.costPerStoryPoint || 0) > 0) {
        updated.costPerStoryPoint = settingsForm.costPerStoryPoint!;
      }
      const updatedTasks = await financialService.getTaskFinancials(selectedProjectId);
      setSummary(updated);
      setTaskFinancials(updatedTasks);
      await loadBudgetHistory(selectedProjectId);
      setIsSettingsModalOpen(false);
      setSettingsForm(prev => ({ ...prev, changeReason: '' }));
      addNotification('success', 'Project budget settings updated & change logged to history');
    } catch (err: any) {
      console.error('Save settings failed', err);
      setSettingsError(err.response?.data?.message || 'Failed to update budget settings');
    }
  };

  const handleOpenOverrideModal = (task: TaskFinancialDTO) => {
    setSelectedTaskForOverride(task);
    setOverrideForm({
      allocatedBudget: task.allocatedBudget,
      actualCost: task.actualCost,
      budgetAllocationSource: task.budgetAllocationSource === 'MANUAL' ? 'MANUAL' : 'MANUAL',
      category: task.category || 'Core Features',
    });
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedTaskForOverride) return;

    try {
      await financialService.updateTaskBudget(selectedProjectId, selectedTaskForOverride.taskId, overrideForm);
      await loadFinancialData(selectedProjectId);
      setIsOverrideModalOpen(false);
      addNotification('success', `Task ${selectedTaskForOverride.taskKey} budget updated`);
    } catch (err: any) {
      console.error('Override update failed', err);
      addNotification('error', err.response?.data?.message || 'Failed to update task budget');
    }
  };

  const handleResetTaskToAuto = async (task: TaskFinancialDTO) => {
    if (!selectedProjectId) return;
    try {
      await financialService.updateTaskBudget(selectedProjectId, task.taskId, {
        budgetAllocationSource: 'AUTOMATIC',
      });
      await loadFinancialData(selectedProjectId);
      addNotification('success', `Task ${task.taskKey} reset to automatic budget calculation`);
    } catch (err) {
      console.error('Reset task to auto failed', err);
      addNotification('error', 'Failed to reset task budget');
    }
  };

  // Filtered Task List
  const filteredTasks = useMemo(() => {
    return taskFinancials.filter((t) => {
      const matchSearch =
        searchTerm === '' ||
        t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.taskKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory =
        categoryFilter === 'ALL' || t.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchStatus =
        statusFilter === 'ALL' || t.status.toLowerCase() === statusFilter.toLowerCase();

      const matchSource =
        sourceFilter === 'ALL' ||
        (sourceFilter === 'MANUAL' && t.budgetAllocationSource === 'MANUAL') ||
        (sourceFilter === 'AUTOMATIC' && t.budgetAllocationSource !== 'MANUAL');

      return matchSearch && matchCategory && matchStatus && matchSource;
    });
  }, [taskFinancials, searchTerm, categoryFilter, statusFilter, sourceFilter]);

  const displayedTasks = useMemo(() => {
    return showAllTasks ? filteredTasks : filteredTasks.slice(0, 5);
  }, [filteredTasks, showAllTasks]);

  // Unique categories from tasks for filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    taskFinancials.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [taskFinancials]);

  const isModelA = !summary?.budgetAllocationMethod || summary.budgetAllocationMethod === 'STORY_POINT_WEIGHTED';
  const isModelB = summary?.budgetAllocationMethod === 'CATEGORY_BASED';
  const isModelC = summary?.budgetAllocationMethod === 'TIME_BASED';

  const completedStoryPoints = useMemo(() => {
    return taskFinancials
      .filter((t) => t.status && (t.status.toUpperCase() === 'DONE' || t.status.toUpperCase().includes('DONE') || t.status.toUpperCase().includes('COMPLETED')))
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  }, [taskFinancials]);

  const displayTotalAllocatedBudget = isModelA
    ? (summary?.totalStoryPoints || 0) * (summary?.costPerStoryPoint || 0)
    : (summary?.totalAllocatedBudget || 0);

  const displayTotalActualCost = isModelA
    ? completedStoryPoints * (summary?.costPerStoryPoint || 0)
    : (summary?.totalActualCost || 0);

  const displayRemainingBudget = (summary?.availableWorkBudget || 0) - displayTotalActualCost;

  if (authUser && !isManagerOrAdmin) {
    return (
      <div className="content-container max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-[#FFEBE6] text-[#DE350B] rounded-[8px] mx-auto flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#172B4D]">Access Restricted</h2>
          <p className="text-xs text-[#5E6C84]">
            Financial telemetry and budget analytics are restricted to Project Managers and Administrators.
          </p>
          <div className="pt-2">
            <Link
              to="/dashboard/projects"
              className="inline-flex items-center gap-2 bg-[#0052CC] hover:bg-[#0747A6] text-white px-4 py-2 rounded-[8px] text-xs font-bold shadow-sm transition-all"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Loading Financials...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container !gap-3.5 max-w-7xl mx-auto py-3 px-4 sm:px-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-[#DFE1E6]">
        <div>
          <div className="flex items-center gap-2 project-breadcrumb mb-1 text-xs text-[#5E6C84]">
            <Link to="/dashboard/projects" className="hover:text-[#0052CC] transition-colors">
              Workspace
            </Link>
            <span>/</span>
            {currentProject && (
              <>
                <Link to={`/dashboard/project-details/${currentProject.id}`} className="hover:text-[#0052CC] transition-colors">
                  {currentProject.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="font-bold text-[#172B4D]">Budget & Financials</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-2">
            <h1 className="text-2xl font-black text-[#172B4D] tracking-tight">
              Project Financials
            </h1>

            {/* Project Switcher: Only displayed when opened from the global "Financials" menu */}
            {!paramProjectId && projects.length > 1 && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    setSelectedProjectId(nextId);
                  }}
                  className="bg-white border border-[#DFE1E6] rounded-[8px] px-3 py-1 text-xs font-bold text-[#172B4D] shadow-sm hover:border-[#0052CC] focus:outline-none cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Allocation Model & Rate Badges in Header */}
            <div className="inline-flex items-center gap-2 bg-[#DEEBFF]/70 border border-[#B3D4FF] rounded-[8px] px-2.5 py-1 text-xs">
              <span className="text-[10px] font-bold text-[#0052CC] uppercase tracking-wider">
                MODEL:
              </span>
              <span className="text-[11px] font-bold text-[#172B4D]">
                {summary?.budgetAllocationMethod === 'CATEGORY_BASED'
                  ? 'Model B — Category-Based'
                  : summary?.budgetAllocationMethod === 'TIME_BASED'
                    ? 'Model C — Time-Based'
                    : 'Model A — Story Point Weighted'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-[11px] font-bold text-[#0052CC]">
                {isModelA ? 'Cost Per SP: ' : 'Rate: '}
                <span className="text-[#172B4D] font-bold">
                  {isModelA
                    ? `${formatCurrency(summary?.costPerStoryPoint)}/SP`
                    : `${formatCurrency(summary?.defaultHourlyRate)}/hr`}
                </span>
              </span>
            </div>
          </div>
          <p className="text-xs font-medium text-[#00B3A4] mt-1">
            Real-time financial telemetry, agile budget burn, variance control, and task-level cost accounting.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleRecalculate(false)}
            disabled={recalculating}
            className="atlassian-btn-custom px-3.5 py-2 rounded-[8px] text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-[#EBECF0] text-[#172B4D]"
            title="Recalculate allocations and actual costs from logged work"
          >
            <RefreshCw size={14} className={recalculating ? 'animate-spin text-[#0052CC]' : ''} />
            <span>Recalculate</span>
          </button>

          {isManagerOrAdmin && (
            <button
              onClick={() => {
                setSettingsModalTab('SETTINGS');
                setIsSettingsModalOpen(true);
              }}
              className="bg-[#0052CC] hover:bg-[#0747A6] text-white px-4 py-2 rounded-[8px] text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Settings size={14} />
              <span>Budget Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* 1. Total Project Budget */}
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#5E6C84] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Budget</span>
            <div className="text-[#0052CC]">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-[#172B4D] tracking-tight">
            {formatCurrency(summary?.totalBudget)}
          </div>
          <div className="text-[11px] text-[#5E6C84] mt-2 flex items-center justify-between">
            <span>Contingency ({summary?.contingencyPercent}%):</span>
            <span className="font-bold text-[#172B4D]">{formatCurrency(summary?.contingencyAmount)}</span>
          </div>
        </div>

        {/* 2. Available Work Budget */}
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#5E6C84] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Work Budget</span>
            <div className="text-[#36B37E]">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-[#172B4D] tracking-tight">
            {formatCurrency(summary?.availableWorkBudget)}
          </div>
          <div className="text-[11px] text-[#5E6C84] mt-2 flex items-center justify-between">
            <span>Total Budget - Reserve</span>
            <span className="text-[10px] font-bold text-[#36B37E] bg-[#E3FCEF] px-1.5 py-0.5 rounded-[8px]">
              Active Fund
            </span>
          </div>
        </div>

        {/* 3. Total Allocated Budget */}
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#5E6C84] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Allocated Budget</span>
            <div className="text-[#0052CC]">
              <PieChart size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-[#172B4D] tracking-tight">
            {formatCurrency(displayTotalAllocatedBudget)}
          </div>
          <div className="text-[11px] text-[#5E6C84] mt-2 flex items-center justify-between">
            <span>Across {summary?.taskCount} Tasks</span>
          </div>
        </div>

        {/* 4. Total Actual Cost */}
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#5E6C84] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Actual Cost</span>
            <div className="text-[#DE350B]">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-[#172B4D] tracking-tight">
            {formatCurrency(displayTotalActualCost)}
          </div>
          <div className="text-[11px] text-[#5E6C84] mt-2 flex items-center justify-between">
            {isModelA ? (
              <>
                <span>Story Points Used:</span>
                <span className="font-bold text-[#172B4D]">
                  {completedStoryPoints} / {summary?.totalStoryPoints || 0} SP Done
                </span>
              </>
            ) : (
              <>
                <span>Logged Work:</span>
                <span className="font-bold text-[#172B4D]">{summary?.totalTimeSpentFormatted || '0h'}</span>
              </>
            )}
          </div>
        </div>

        {/* 5. Remaining Budget */}
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#5E6C84] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Remaining Budget</span>
            <div className={displayRemainingBudget >= 0 ? 'text-[#36B37E]' : 'text-[#DE350B]'}>
              {displayRemainingBudget >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          </div>
          <div className="text-xl font-black text-[#172B4D] tracking-tight">
            {formatCurrency(displayRemainingBudget)}
          </div>
        </div>
      </div>



      {/* Model B: Category Domain Allocations Breakdown */}
      {isModelB && summary?.categorySummaries && summary.categorySummaries.length > 0 && (
        <div className="bg-white border border-[#DFE1E6] rounded-[8px] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#DFE1E6] pb-2">
            <div className="flex items-center gap-2">
              <Layers className="text-[#0052CC]" size={16} />
              <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                Functional Domain Allocations (Model B)
              </h3>
            </div>
            <span className="text-[11px] text-[#5E6C84]">
              Work Budget ({formatCurrency(summary.availableWorkBudget)}) distributed by functional domain percentages
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.categorySummaries.map((cat, idx) => {
              const util = cat.allocatedBudget > 0 ? (cat.actualCost / cat.allocatedBudget) * 100 : 0;
              return (
                <div key={idx} className="border border-[#DFE1E6] rounded-[8px] p-3.5 bg-[#FAFBFC] hover:border-[#0052CC] transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#172B4D] truncate" title={cat.category}>
                      {cat.category}
                    </span>
                    <span className="bg-[#DEEBFF] text-[#0052CC] px-2 py-0.5 rounded-[8px] text-[10px] font-black">
                      {cat.allocationPercent}%
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[#5E6C84] text-[11px]">Domain Budget:</span>
                    <span className="font-black text-[#172B4D]">{formatCurrency(cat.allocatedBudget)}</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[#5E6C84] text-[11px]">Actual Cost:</span>
                    <span className="font-bold text-[#172B4D]">{formatCurrency(cat.actualCost)}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1 pt-0.5">
                    <div className="w-full bg-[#EBECF0] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${util > 100 ? 'bg-[#DE350B]' : util > 80 ? 'bg-[#FFAB00]' : 'bg-[#0052CC]'
                          }`}
                        style={{ width: `${Math.min(100, util)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#5E6C84]">
                      <span>{cat.taskCount} {cat.taskCount === 1 ? 'Task' : 'Tasks'}</span>
                      <span className="font-bold">{util.toFixed(1)}% used</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Financials Detailed Table */}
      <div className="bg-white border border-[#DFE1E6] rounded-[8px] shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#DFE1E6] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAFBFC]">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Task-Level Financial Telemetry</h3>
            <p className="text-xs text-[#5E6C84]">
              Granular breakdown of story points, allocated funds, actual costs from logged hours, and budget variances.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5E6C84]" />
              <input
                type="text"
                placeholder="Search tasks, IDs, assignees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-[#DFE1E6] rounded-[8px] text-xs font-bold text-[#172B4D] focus:outline-none focus:border-[#0052CC] bg-white w-48 lg:w-56"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-[#DFE1E6] rounded-[8px] text-xs font-bold text-[#172B4D] bg-white focus:outline-none focus:border-[#0052CC]"
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-[#DFE1E6] rounded-[8px] text-xs font-bold text-[#172B4D] bg-white focus:outline-none focus:border-[#0052CC]"
            >
              <option value="ALL">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="Pending PM Review">Pending PM Review</option>
            </select>
          </div>
        </div>

        {/* Financial Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DFE1E6] bg-[#F4F5F7] text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider">
                <th className="py-3 px-4">Task Key</th>
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Story Points</th>
                <th className="py-3 px-4 text-center">Allocated Budget</th>
                {!isModelA && (
                  <th className="py-3 px-4 text-center">Logged Effort</th>
                )}
                {!isModelA ? (
                  <th className="py-3 px-4 text-center">Hourly Rate</th>
                ) : null}
                <th className="py-3 px-4 text-right">Actual Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE1E6] text-xs">
              {displayedTasks.length > 0 ? (
                <>
                  {displayedTasks.map((task) => {
                    return (
                      <tr key={task.taskId} className="hover:bg-[#FAFBFC] transition-colors group">
                        {/* Key */}
                        <td className="py-3 px-4 font-bold text-[#0052CC] whitespace-nowrap">
                          <button
                            onClick={() => {
                              setActiveTaskId(task.taskId);
                              setIsTaskDetailOpen(true);
                            }}
                            className="hover:underline flex items-center gap-1 text-left font-bold"
                          >
                            {task.taskKey}
                          </button>
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4 font-medium text-[#172B4D] max-w-xs truncate" title={task.taskName}>
                          <div className="truncate font-semibold">{task.taskName}</div>
                          <div className="text-[10px] text-[#5E6C84] truncate">{task.assigneeName}</div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-[8px] bg-[#EBECF0] text-[#172B4D] font-semibold text-[11px]">
                            {task.category || 'Core Features'}
                          </span>
                        </td>

                        {/* SP */}
                        <td className="py-3 px-4 text-center font-bold">
                          {task.storyPoints > 0 ? (
                            <span className="font-bold text-xs text-[#1F6FEB]">
                              {task.storyPoints} SP
                            </span>
                          ) : (
                            <span className="text-[#5E6C84] font-normal">0</span>
                          )}
                        </td>

                        {/* Allocated Budget */}
                        <td className="py-3 px-4 text-center whitespace-nowrap font-bold text-[#172B4D]">
                          {formatCurrency(
                            isModelA
                              ? (task.budgetAllocationSource === 'MANUAL' && task.allocatedBudget !== undefined
                                ? task.allocatedBudget
                                : (task.storyPoints || 0) * (summary?.costPerStoryPoint || 0))
                              : task.allocatedBudget
                          )}
                        </td>

                        {/* Time Spent / Logged Effort (Only for Model B/C) */}
                        {!isModelA && (
                          <td className="py-3 px-4 text-center whitespace-nowrap text-[#172B4D]">
                            <div className="font-bold">{task.timeSpent || '0m'}</div>
                            <div className="text-[10px] text-[#5E6C84]">Est: {task.originalEstimate || '—'}</div>
                          </td>
                        )}

                        {/* Model B/C: Hourly Rate */}
                        {!isModelA && (
                          <td className="py-3 px-4 text-center whitespace-nowrap text-[#5E6C84] font-medium">
                            {formatCurrency(task.hourlyRate)}/h
                          </td>
                        )}

                        {/* Actual Cost */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-[#172B4D]">
                          {formatCurrency(
                            isModelA
                              ? (task.status && (task.status.toUpperCase() === 'DONE' || task.status.toUpperCase().includes('DONE') || task.status.toUpperCase().includes('COMPLETED'))
                                ? (task.budgetAllocationSource === 'MANUAL' && task.allocatedBudget !== undefined
                                  ? task.allocatedBudget
                                  : (task.storyPoints || 0) * (summary?.costPerStoryPoint || 0))
                                : 0)
                              : task.actualCost
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-[8px] text-[10px] font-bold uppercase tracking-wider ${task.status.toLowerCase().includes('done')
                              ? 'bg-[#E3FCEF] text-[#006644]'
                              : task.status.toLowerCase().includes('progress')
                                ? 'bg-[#DEEBFF] text-[#0052CC]'
                                : 'bg-[#F4F5F7] text-[#42526E]'
                              }`}
                          >
                            {task.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTasks.length > 5 && (
                    <tr className="bg-[#FAFBFC] hover:bg-[#F4F5F7] transition-colors border-t border-[#DFE1E6]">
                      <td colSpan={isModelA ? 6 : 8} className="py-3 px-4 text-xs text-[#5E6C84]">
                        Showing {showAllTasks ? filteredTasks.length : 5} of {filteredTasks.length} tasks
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setShowAllTasks(!showAllTasks)}
                          className="text-xs font-bold text-[#0052CC] hover:text-[#0747A6] hover:underline cursor-pointer inline-flex items-center gap-1"
                        >
                          {showAllTasks ? 'Show Less' : 'View All'}
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={isModelA ? 7 : 9} className="py-8 text-center text-xs text-[#5E6C84] italic">
                    No tasks match the active filters or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Budget Settings & History Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#DFE1E6] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#DEEBFF] text-[#0052CC] flex items-center justify-center">
                  {settingsModalTab === 'SETTINGS' ? <Settings size={17} /> : <History size={17} />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#172B4D]">
                    {settingsModalTab === 'SETTINGS' ? 'Project Budget & Financial Settings' : 'Project Budget Change History'}
                  </h2>
                  <p className="text-[11px] text-[#5E6C84]">
                    {currentProject?.name ? `${currentProject.name} • ` : ''}
                    {settingsModalTab === 'SETTINGS'
                      ? 'Configure methodology, reserve & rates'
                      : `${budgetHistories.length} revision${budgetHistories.length === 1 ? '' : 's'} recorded`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tab Switcher Pills in Header */}
                <div className="flex items-center bg-[#EBECF0] p-0.5 rounded-[8px]">
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('SETTINGS')}
                    className={`px-3 py-1 rounded-[6px] text-xs font-bold transition-all ${
                      settingsModalTab === 'SETTINGS'
                        ? 'bg-white text-[#0052CC] shadow-sm'
                        : 'text-[#5E6C84] hover:text-[#172B4D]'
                    }`}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('HISTORY')}
                    className={`px-3 py-1 rounded-[6px] text-xs font-bold transition-all flex items-center gap-1.5 ${
                      settingsModalTab === 'HISTORY'
                        ? 'bg-white text-[#0052CC] shadow-sm'
                        : 'text-[#5E6C84] hover:text-[#172B4D]'
                    }`}
                  >
                    <History size={13} />
                    <span>History</span>
                    {budgetHistories.length > 0 && (
                      <span className="bg-[#DEEBFF] text-[#0052CC] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                        {budgetHistories.length}
                      </span>
                    )}
                  </button>
                </div>

                {settingsModalTab === 'HISTORY' && selectedProjectId && (
                  <button
                    type="button"
                    onClick={() => loadBudgetHistory(selectedProjectId)}
                    disabled={loadingHistory}
                    className="text-[#5E6C84] hover:text-[#0052CC] p-1.5 rounded-[6px] hover:bg-[#EBECF0] transition-colors"
                    title="Refresh history"
                  >
                    <RefreshCw size={15} className={loadingHistory ? 'animate-spin text-[#0052CC]' : ''} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="text-[#5E6C84] hover:text-[#172B4D] p-1 rounded-[6px] hover:bg-[#EBECF0] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {settingsModalTab === 'SETTINGS' ? (
              /* Settings Form View */
              <form onSubmit={handleSaveSettings} className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                {settingsError && (
                  <div className="p-3 bg-[#FFEBE6] border border-[#FFBDAD] text-[#DE350B] rounded-[8px] text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{settingsError}</span>
                  </div>
                )}

                {/* Total Budget */}
                <div className="space-y-1.5 w-full sm:w-[calc(50%-8px)]">
                  <label className="text-xs font-bold text-[#172B4D]">
                    Total Project Budget (₹ / INR) <span className="text-[#DE350B]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={settingsForm.totalBudget}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, totalBudget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none"
                    placeholder="e.g. 100000"
                  />
                  <p className="text-[11px] text-[#5E6C84]">Total capital allocated for the entire project lifecycle.</p>
                </div>

                {/* Allocation Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#172B4D]">Budget Allocation Methodology</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <label
                      className={`p-3 border rounded-[8px] cursor-pointer flex flex-col justify-between gap-1 transition-all ${settingsForm.budgetAllocationMethod === 'STORY_POINT_WEIGHTED'
                        ? 'border-[#0052CC] bg-[#DEEBFF]/40 text-[#0052CC]'
                        : 'border-[#DFE1E6] hover:bg-[#FAFBFC] text-[#172B4D]'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">Model A</span>
                        <input
                          type="radio"
                          name="method"
                          value="STORY_POINT_WEIGHTED"
                          checked={settingsForm.budgetAllocationMethod === 'STORY_POINT_WEIGHTED'}
                          onChange={() =>
                            setSettingsForm({ ...settingsForm, budgetAllocationMethod: 'STORY_POINT_WEIGHTED' })
                          }
                        />
                      </div>
                      <span className="text-[11px] font-bold">Story Point Weighted</span>
                      <span className="text-[10px] text-[#5E6C84]">Agile proportional cost per SP</span>
                    </label>

                    <label
                      className={`p-3 border rounded-[8px] cursor-pointer flex flex-col justify-between gap-1 transition-all ${settingsForm.budgetAllocationMethod === 'CATEGORY_BASED'
                        ? 'border-[#0052CC] bg-[#DEEBFF]/40 text-[#0052CC]'
                        : 'border-[#DFE1E6] hover:bg-[#FAFBFC] text-[#172B4D]'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">Model B</span>
                        <input
                          type="radio"
                          name="method"
                          value="CATEGORY_BASED"
                          checked={settingsForm.budgetAllocationMethod === 'CATEGORY_BASED'}
                          onChange={() =>
                            setSettingsForm({ ...settingsForm, budgetAllocationMethod: 'CATEGORY_BASED' })
                          }
                        />
                      </div>
                      <span className="text-[11px] font-bold">Category Based</span>
                      <span className="text-[10px] text-[#5E6C84]">Fixed % per functional domain</span>
                    </label>

                    <label
                      className={`p-3 border rounded-[8px] cursor-pointer flex flex-col justify-between gap-1 transition-all ${settingsForm.budgetAllocationMethod === 'TIME_BASED'
                        ? 'border-[#0052CC] bg-[#DEEBFF]/40 text-[#0052CC]'
                        : 'border-[#DFE1E6] hover:bg-[#FAFBFC] text-[#172B4D]'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">Model C</span>
                        <input
                          type="radio"
                          name="method"
                          value="TIME_BASED"
                          checked={settingsForm.budgetAllocationMethod === 'TIME_BASED'}
                          onChange={() =>
                            setSettingsForm({ ...settingsForm, budgetAllocationMethod: 'TIME_BASED' })
                          }
                        />
                      </div>
                      <span className="text-[11px] font-bold">Time Based</span>
                      <span className="text-[10px] text-[#5E6C84]">Task estimated hours * rate</span>
                    </label>
                  </div>
                </div>

                {/* Grid 2 Cols: Contingency & (Cost Per Story Point for Model A OR Default Hourly Rate for Model B/C) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#172B4D]">Contingency Reserve (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settingsForm.contingencyPercent}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, contingencyPercent: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none"
                      placeholder="e.g. 10"
                    />
                    <p className="text-[11px] text-[#5E6C84]">Percentage reserved for risk and unexpected scope.</p>
                  </div>

                  {settingsForm.budgetAllocationMethod === 'STORY_POINT_WEIGHTED' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#172B4D]">Cost Per Story Point (₹ / SP)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settingsForm.costPerStoryPoint || ''}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, costPerStoryPoint: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none"
                        placeholder="e.g. 4000"
                      />
                      <p className="text-[11px] text-[#5E6C84]">Used to calculate budget allocation based on Story Points.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#172B4D]">Default Hourly Rate (₹ / hr)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settingsForm.defaultHourlyRate}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, defaultHourlyRate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none"
                        placeholder="e.g. 500"
                      />
                      <p className="text-[11px] text-[#5E6C84]">Used to compute actual cost from logged work hours.</p>
                    </div>
                  )}
                </div>

                {/* Dynamic Category Percentages (if Category Based is selected) */}
                {settingsForm.budgetAllocationMethod === 'CATEGORY_BASED' && (
                  <div className="space-y-3 pt-2 border-t border-[#DFE1E6]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#172B4D]">
                        Category Allocation Configuration (Must total 100%)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const current = settingsForm.categories || [];
                          setSettingsForm({
                            ...settingsForm,
                            categories: [...current, { category: `New Category ${current.length + 1}`, allocationPercent: 0 }],
                          });
                        }}
                        className="text-[11px] font-bold text-[#0052CC] flex items-center gap-1 hover:underline"
                      >
                        <Plus size={12} /> Add Category
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(settingsForm.categories || []).map((cat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cat.category}
                            onChange={(e) => {
                              const copy = [...(settingsForm.categories || [])];
                              copy[idx].category = e.target.value;
                              setSettingsForm({ ...settingsForm, categories: copy });
                            }}
                            className="flex-1 px-2.5 py-1.5 border border-[#DFE1E6] rounded-[8px] text-xs font-bold text-[#172B4D]"
                            placeholder="Category Name"
                          />
                          <div className="flex items-center gap-1 w-28">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={cat.allocationPercent}
                              onChange={(e) => {
                                const copy = [...(settingsForm.categories || [])];
                                copy[idx].allocationPercent = parseFloat(e.target.value) || 0;
                                setSettingsForm({ ...settingsForm, categories: copy });
                              }}
                              className="w-20 px-2.5 py-1.5 border border-[#DFE1E6] rounded-[8px] text-xs font-bold text-right"
                            />
                            <span className="text-xs font-bold text-[#5E6C84]">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const copy = (settingsForm.categories || []).filter((_, i) => i !== idx);
                              setSettingsForm({ ...settingsForm, categories: copy });
                            }}
                            className="text-[#5E6C84] hover:text-[#DE350B] p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Percentage Total Checker */}
                    <div className="flex items-center justify-between text-xs font-bold pt-1">
                      <span>Total Category %:</span>
                      <span
                        className={`font-black ${Math.round(
                          (settingsForm.categories || []).reduce(
                            (s, c) => s + (Number(c.allocationPercent) || 0),
                            0
                          )
                        ) === 100
                          ? 'text-[#006644]'
                          : 'text-[#DE350B]'
                          }`}
                      >
                        {(settingsForm.categories || [])
                          .reduce((s, c) => s + (Number(c.allocationPercent) || 0), 0)
                          .toFixed(1)}
                        % / 100%
                      </span>
                    </div>
                  </div>
                )}

                {/* Optional Change Reason / Notes */}
                <div className="space-y-1.5 pt-2 border-t border-[#DFE1E6]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-[#0052CC]" />
                      <span>Change Note / Reason (Optional)</span>
                    </label>
                    <span className="text-[10px] text-[#5E6C84]">Tracked in budget history</span>
                  </div>
                  <input
                    type="text"
                    value={settingsForm.changeReason || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, changeReason: e.target.value })}
                    className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-xs font-medium text-[#172B4D] focus:border-[#0052CC] focus:outline-none placeholder:text-slate-400 bg-white"
                    placeholder="e.g. Scope expansion, approved budget realignment, Q3 adjustment"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#DFE1E6] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('HISTORY')}
                    className="text-xs font-bold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] hover:bg-[#DEEBFF]/50 transition-colors"
                  >
                    <History size={14} />
                    <span>View Budget History ({budgetHistories.length})</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSettingsModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-[#42526E] hover:bg-[#F4F5F7] rounded-[8px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-[#0052CC] hover:bg-[#0747A6] text-white px-5 py-2 rounded-[8px] text-xs font-bold shadow-md transition-all active:scale-95"
                    >
                      Save Settings & Recalculate
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* History Timeline View inside the same modal */
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                  {loadingHistory && budgetHistories.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-[#5E6C84]">Loading history entries...</span>
                    </div>
                  ) : budgetHistories.length === 0 ? (
                    <div className="py-12 px-4 text-center border-2 border-dashed border-[#DFE1E6] rounded-[10px] bg-[#FAFBFC] space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#EBECF0] text-[#5E6C84] mx-auto flex items-center justify-center">
                        <History size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-[#172B4D]">No Budget Changes Recorded Yet</h4>
                        <p className="text-xs text-[#5E6C84] max-w-sm mx-auto">
                          Any modifications to the total project budget, contingency reserves, or allocation methodology will be tracked here with an audit log.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsModalTab('SETTINGS')}
                        className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white px-3.5 py-1.5 rounded-[8px] text-xs font-bold hover:bg-[#0747A6] shadow-sm transition-all"
                      >
                        <Settings size={13} />
                        <span>Adjust Budget Settings</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#DFE1E6]">
                      {budgetHistories.map((entry, idx) => {
                        const diff = (entry.newTotalBudget ?? 0) - (entry.previousTotalBudget ?? 0);
                        const isTotalBudgetDiff = entry.previousTotalBudget !== null && entry.newTotalBudget !== null && entry.previousTotalBudget !== entry.newTotalBudget;
                        const isInitial = entry.previousTotalBudget === null || entry.previousTotalBudget === undefined;

                        return (
                          <div key={entry.id || idx} className="relative group">
                            {/* Timeline Node Icon */}
                            <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-white border-2 border-[#0052CC] flex items-center justify-center text-[9px] font-black text-[#0052CC] shadow-sm group-hover:scale-110 transition-transform">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0052CC]"></span>
                            </div>

                            {/* Card Content */}
                            <div className="bg-white border border-[#DFE1E6] rounded-[10px] p-4 shadow-sm hover:shadow-md hover:border-[#B3D4FF] transition-all space-y-3">
                              {/* Header row: Time & Performer */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F5F7] pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[#172B4D]">
                                    {formatFullDateTime(entry.createdAt)}
                                  </span>
                                  <span className="text-[10px] font-bold text-[#5E6C84] bg-[#EBECF0] px-2 py-0.5 rounded-full">
                                    {formatRelativeTime(entry.createdAt)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-[#5E6C84]">
                                  <div className="w-5 h-5 rounded-full bg-[#DEEBFF] text-[#0052CC] flex items-center justify-center font-bold text-[10px]">
                                    <User size={11} />
                                  </div>
                                  <span className="font-bold text-[#172B4D] text-[11px]">
                                    {entry.performedBy || 'System'}
                                  </span>
                                  {entry.performedByEmpId && (
                                    <span className="text-[10px] text-[#5E6C84] font-medium bg-[#FAFBFC] border border-[#DFE1E6] px-1.5 py-0.2 rounded">
                                      {entry.performedByEmpId}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Primary Budget Metric Comparison */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFBFC] p-3 rounded-[8px] border border-[#EBECF0]">
                                {/* Total Budget Change */}
                                <div>
                                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block mb-1">
                                    Total Budget
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isInitial ? (
                                      <span className="text-sm font-black text-[#172B4D]">
                                        {formatCurrency(entry.newTotalBudget)}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="text-xs font-medium text-[#5E6C84] line-through">
                                          {formatCurrency(entry.previousTotalBudget)}
                                        </span>
                                        <ArrowRight size={13} className="text-[#5E6C84]" />
                                        <span className="text-sm font-black text-[#172B4D]">
                                          {formatCurrency(entry.newTotalBudget)}
                                        </span>
                                      </>
                                    )}

                                    {isTotalBudgetDiff && diff !== 0 && (
                                      <span
                                        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                          diff > 0
                                            ? 'bg-[#E3FCEF] text-[#006644]'
                                            : 'bg-[#FFEBE6] text-[#DE350B]'
                                        }`}
                                      >
                                        {diff > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                        {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Methodology & Contingency */}
                                <div>
                                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block mb-1">
                                    Allocation Model & Reserve
                                  </span>
                                  <div className="text-xs text-[#172B4D] font-bold">
                                    <span>
                                      {entry.newAllocationMethod === 'CATEGORY_BASED'
                                        ? 'Model B (Category Based)'
                                        : entry.newAllocationMethod === 'TIME_BASED'
                                        ? 'Model C (Time Based)'
                                        : 'Model A (Story Point)'}
                                    </span>
                                    {entry.newContingencyPercent !== null && (
                                      <span className="text-[11px] text-[#5E6C84] font-medium ml-1.5">
                                        • Reserve: {entry.newContingencyPercent}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Summary text pill */}
                              {entry.changeSummary && (
                                <div className="flex items-start gap-1.5 text-xs text-[#172B4D]">
                                  <Tag size={13} className="text-[#0052CC] shrink-0 mt-0.5" />
                                  <span className="font-medium text-[#42526E] text-[11px]">
                                    {entry.changeSummary}
                                  </span>
                                </div>
                              )}

                              {/* User Note / Comment if present */}
                              {entry.comment && (
                                <div className="bg-[#DEEBFF]/30 border-l-3 border-[#0052CC] p-2.5 rounded-r-[6px] flex items-start gap-2">
                                  <MessageSquare size={13} className="text-[#0052CC] shrink-0 mt-0.5" />
                                  <div className="text-xs">
                                    <span className="font-bold text-[#0052CC] text-[11px] block">Note:</span>
                                    <span className="text-[#172B4D] italic text-[11px]">"{entry.comment}"</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer in History View */}
                <div className="px-6 py-3 border-t border-[#DFE1E6] flex items-center justify-between bg-[#FAFBFC]">
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('SETTINGS')}
                    className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1.5"
                  >
                    ← Back to Budget Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="bg-[#0052CC] hover:bg-[#0747A6] text-white px-4 py-1.5 rounded-[8px] text-xs font-bold shadow-sm transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Budget Override Modal */}
      {isOverrideModalOpen && selectedTaskForOverride && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[8px] shadow-2xl border border-[#DFE1E6] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-[#FAFBFC]">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Override Budget: {selectedTaskForOverride.taskKey}
                </h3>
                <p className="text-[11px] text-[#5E6C84] truncate max-w-xs">
                  {selectedTaskForOverride.taskName}
                </p>
              </div>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-[#5E6C84] hover:text-[#172B4D]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172B4D]">Allocated Budget (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={overrideForm.allocatedBudget}
                  onChange={(e) =>
                    setOverrideForm({
                      ...overrideForm,
                      allocatedBudget: parseFloat(e.target.value) || 0,
                      budgetAllocationSource: 'MANUAL',
                    })
                  }
                  className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172B4D]">Category</label>
                <select
                  value={overrideForm.category}
                  onChange={(e) => setOverrideForm({ ...overrideForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none bg-white"
                >
                  <option value="Core Features">Core Features</option>
                  <option value="Technical Infrastructure">Technical Infrastructure</option>
                  <option value="Bug/Maintenance">Bug/Maintenance</option>
                  <option value="Contingency">Contingency</option>
                  {uniqueCategories
                    .filter(
                      (c) =>
                        ![
                          'Core Features',
                          'Technical Infrastructure',
                          'Bug/Maintenance',
                          'Contingency',
                        ].includes(c)
                    )
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172B4D]">Allocation Mode</label>
                <select
                  value={overrideForm.budgetAllocationSource}
                  onChange={(e) =>
                    setOverrideForm({ ...overrideForm, budgetAllocationSource: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#DFE1E6] rounded-[8px] text-sm font-bold text-[#172B4D] focus:border-[#0052CC] focus:outline-none bg-white"
                >
                  <option value="MANUAL">Manual Override (Locked from auto recalculations)</option>
                  <option value="AUTOMATIC">Automatic (Follows project allocation model)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#DFE1E6] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#42526E] hover:bg-[#F4F5F7] rounded-[8px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0052CC] hover:bg-[#0747A6] text-white px-5 py-2 rounded-[8px] text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {isTaskDetailOpen && activeTaskId && selectedProjectId && (
        <TaskDetailModal
          taskId={activeTaskId}
          projectId={selectedProjectId}
          isOpen={isTaskDetailOpen}
          onClose={() => {
            setIsTaskDetailOpen(false);
            setActiveTaskId(null);
            loadFinancialData(selectedProjectId);
          }}
          onUpdate={() => {
            loadFinancialData(selectedProjectId);
          }}
          onDelete={() => {
            setIsTaskDetailOpen(false);
            setActiveTaskId(null);
            loadFinancialData(selectedProjectId);
          }}
        />
      )}
    </div>
  );
};

export default FinancialAnalytics;
