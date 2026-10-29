import React, { useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Layers,
  Users,
  Calendar,
  Zap,
  Tag
} from 'lucide-react';
import type { KPICardData } from '../services/kpiCalculations';
import type { Task } from '../types';
import { getTaskCode } from '../services/projectUtils';

interface KPIDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPICardData | null;
  projectName?: string;
  onSelectTask?: (taskId: number) => void;
}

export const KPIDrillDownModal: React.FC<KPIDrillDownModalProps> = ({
  isOpen,
  onClose,
  kpi,
  projectName,
  onSelectTask
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !kpi) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'On Track':
        return <CheckCircle2 size={16} className="text-[#36B37E]" />;
      case 'At Risk':
        return <AlertTriangle size={16} className="text-[#FFAB00]" />;
      case 'Critical':
        return <AlertOctagon size={16} className="text-[#FF5630]" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'On Track':
        return 'bg-[#E3FCEF] text-[#006644] border-[#ABF5D1]';
      case 'At Risk':
        return 'bg-[#FFF0B3] text-[#172B4D] border-[#FFE380]';
      case 'Critical':
        return 'bg-[#FFEBE6] text-[#BF2600] border-[#FFBDAD]';
      default:
        return 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6]';
    }
  };

  const renderTaskTable = (tasks: Task[], extraColumns?: { header: string; render: (t: Task) => React.ReactNode }[]) => {
    if (!tasks || tasks.length === 0) {
      return (
        <div className="text-center py-8 text-[#5E6C84] bg-[#F4F5F7]/40 rounded-lg border border-[#DFE1E6]">
          <p className="text-sm font-medium">No tasks found matching this KPI criteria.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border border-[#DFE1E6] rounded-lg">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6] text-[#5E6C84] font-bold">
              <th className="py-2.5 px-4">Key</th>
              <th className="py-2.5 px-4">Title</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Priority</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Assignee</th>
              <th className="py-2.5 px-4 text-center">SP</th>
              {extraColumns?.map((col, idx) => (
                <th key={idx} className="py-2.5 px-4">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE1E6] bg-white">
            {tasks.map(t => (
              <tr
                key={t.id}
                onClick={() => onSelectTask && onSelectTask(t.id)}
                className={`hover:bg-[#F4F5F7]/60 transition-colors ${onSelectTask ? 'cursor-pointer' : ''}`}
              >
                <td className="py-2.5 px-4 font-mono font-bold text-[#1F6FEB] whitespace-nowrap">
                  {getTaskCode(t.id, projectName, t.projectSequence)}
                </td>
                <td className="py-2.5 px-4 font-medium text-[#172B4D] max-w-xs truncate" title={t.title}>
                  {t.title}
                </td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F4F5F7] text-[#42526E] border border-[#DFE1E6]">
                    {t.issueType || 'TASK'}
                  </span>
                </td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${t.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-200' : t.priority?.toUpperCase() === 'LOW' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                    {t.priority || 'MEDIUM'}
                  </span>
                </td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED' ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-[#DEEBFF] text-[#0747A6]'}`}>
                    {t.status || 'To Do'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-[#42526E] whitespace-nowrap truncate max-w-[120px]">
                  {t.assignee?.name || <span className="text-[#9CA3AF] italic">Unassigned</span>}
                </td>
                <td className="py-2.5 px-4 text-center font-bold text-[#172B4D]">
                  {t.storyPoints || 0}
                </td>
                {extraColumns?.map((col, idx) => (
                  <td key={idx} className="py-2.5 px-4 whitespace-nowrap">
                    {col.render(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDetailsBody = () => {
    const data = kpi.detailsData || {};

    switch (kpi.id) {
      case 'project-health':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#F4F5F7]/50 p-4 rounded-xl border border-[#DFE1E6] text-center">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Current Score</p>
                <p className="text-3xl font-bold text-[#172B4D] mt-1">{data.healthScore || 0}%</p>
                <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(kpi.status)}`}>
                  {getStatusIcon(kpi.status)} {kpi.status}
                </span>
              </div>
              <div className="bg-[#F4F5F7]/50 p-4 rounded-xl border border-[#DFE1E6] text-center">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Previous Score</p>
                <p className="text-3xl font-bold text-[#5E6C84] mt-1">{data.prevHealthScore !== null && data.prevHealthScore !== undefined ? `${data.prevHealthScore}%` : 'N/A'}</p>
                <p className="text-[11px] text-[#6B778C] mt-2">{data.prevHealthScore !== null && data.prevHealthScore !== undefined ? 'Previous comparison period' : 'Initial baseline period'}</p>
              </div>
              <div className="bg-[#F4F5F7]/50 p-4 rounded-xl border border-[#DFE1E6] text-center">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Trend Analysis</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.trendDirection === 'positive' ? 'text-[#36B37E]' : kpi.trendDirection === 'negative' ? 'text-[#FF5630]' : 'text-[#5E6C84]'}`}>
                  {kpi.trendText}
                </p>
                <p className="text-[11px] text-[#6B778C] mt-2">Overall composite trajectory</p>
              </div>
            </div>
          </div>
        );

      case 'completion':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#DEEBFF]/30 p-4 rounded-xl border border-[#B3D4FF]">
                <p className="text-[11px] font-bold text-[#0747A6] uppercase">Total Scope</p>
                <p className="text-2xl font-bold text-[#172B4D] mt-1">{data.totalPoints} Story Points</p>
                <p className="text-[12px] text-[#5E6C84] mt-1">{(data.doneTasks?.length || 0) + (data.openTasks?.length || 0)} Total Tasks</p>
              </div>
              <div className="bg-[#E3FCEF]/40 p-4 rounded-xl border border-[#ABF5D1]">
                <p className="text-[11px] font-bold text-[#006644] uppercase">Completed</p>
                <p className="text-2xl font-bold text-[#006644] mt-1">{data.completedPoints} Story Points</p>
                <p className="text-[12px] text-[#006644] mt-1">{data.completedTasksCount} Tasks Done</p>
              </div>
              <div className="bg-[#FFF0B3]/30 p-4 rounded-xl border border-[#FFE380]">
                <p className="text-[11px] font-bold text-[#172B4D] uppercase">Remaining</p>
                <p className="text-2xl font-bold text-[#172B4D] mt-1">{data.remainingPoints} Story Points</p>
                <p className="text-[12px] text-[#5E6C84] mt-1">{data.remainingTasksCount} Tasks Pending</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Layers size={16} className="text-[#1F6FEB]" /> Active / Pending Scope ({data.openTasks?.length || 0})
              </h4>
              {renderTaskTable(data.openTasks || [])}
            </div>

            {data.doneTasks && data.doneTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-[#006644] mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#36B37E]" /> Completed Scope ({data.doneTasks.length})
                </h4>
                {renderTaskTable(data.doneTasks)}
              </div>
            )}
          </div>
        );

      case 'overdue-work':
        return (
          <div className="space-y-6">
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Overdue Workload Summary</p>
                <p className="text-2xl font-bold text-red-800 mt-1">{data.overdueTasks?.length || 0} Overdue Tasks ({data.overduePoints || 0} Story Points)</p>
              </div>
              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded border border-red-300">
                Action Required
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Clock size={16} className="text-red-500" /> Overdue Work Items
              </h4>
              {renderTaskTable(data.overdueTasks || [], [
                {
                  header: 'Due Date',
                  render: (t) => (
                    <span className="text-red-600 font-bold flex items-center gap-1">
                      <Calendar size={13} /> {t.dueDate || 'N/A'}
                    </span>
                  )
                }
              ])}
            </div>
          </div>
        );

      case 'open-blockers':
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Blocker Impediments</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{data.blockerTasks?.length || 0} Unresolved Blockers ({data.blockerPoints || 0} Story Points)</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded border border-amber-300">
                Resolution Needed
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Active Blockers & Dependencies
              </h4>
              {renderTaskTable(data.blockerTasks || [], [
                {
                  header: 'Tags / Reason',
                  render: (t) => (
                    <div className="flex flex-wrap gap-1">
                      {(t.tags || []).map((tg, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#DEEBFF] text-[#0747A6] rounded text-[10px] font-bold">
                          {tg}
                        </span>
                      ))}
                      {t.issueType === 'BUG' && t.priority === 'HIGH' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                          Critical Bug
                        </span>
                      )}
                    </div>
                  )
                }
              ])}
            </div>
          </div>
        );

      case 'scope-change':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Recent Scope Expansion</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">+{data.scopeChangeTasks?.length || 0} Tasks Added Recently ({data.totalNewPoints || 0} Story Points)</p>
              <p className="text-xs text-blue-600 mt-1">Identifies work items created within the last 3 days of the active cycle.</p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Tag size={16} className="text-blue-500" /> Recently Added Tasks
              </h4>
              {renderTaskTable(data.scopeChangeTasks || [], [
                {
                  header: 'Created At',
                  render: (t) => (
                    <span className="text-[#5E6C84]">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  )
                }
              ])}
            </div>
          </div>
        );

      case 'velocity':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Current Velocity</p>
                <p className="text-3xl font-bold text-[#1F6FEB] mt-1">{data.currentVelocity || 0} SP</p>
                <p className="text-[11px] text-[#5E6C84] mt-1">Completed points</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Previous Sprint</p>
                <p className="text-3xl font-bold text-[#5E6C84] mt-1">{data.hasPreviousPeriod ? `${data.prevVelocity || 0} SP` : '0 SP'}</p>
                <p className="text-[11px] text-[#5E6C84] mt-1">{data.hasPreviousPeriod ? 'Historical delivery' : 'First sprint baseline'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Historical Average</p>
                <p className="text-3xl font-bold text-[#36B37E] mt-1">{data.avgVelocity || 0} SP</p>
                <p className="text-[11px] text-[#5E6C84] mt-1">Average per sprint</p>
              </div>
            </div>

            {data.sprintHistory && data.sprintHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-yellow-500" /> Sprint Delivery History
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.sprintHistory.map((s: any, idx: number) => (
                    <div key={idx} className="bg-[#F4F5F7] p-3 rounded-lg border border-[#DFE1E6]">
                      <p className="font-bold text-[#172B4D] text-xs truncate">{s.sprintName}</p>
                      <p className="text-lg font-bold text-[#1F6FEB] mt-1">{s.donePoints} SP</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'cycle-time':
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Average Cycle Time</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{data.avgDays || 0} Calendar Days</p>
                <p className="text-xs text-purple-600 mt-1">Evaluated across {data.completedCount || 0} completed tasks</p>
              </div>
              <span className={`px-3 py-1 text-xs font-bold rounded border ${getStatusBadgeClass(kpi.status)}`}>
                {kpi.status}
              </span>
            </div>

            {/* Percentile Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-[#DFE1E6]">
                <p className="text-[10px] font-bold text-[#5E6C84] uppercase">Median (P50)</p>
                <p className="text-lg font-black text-purple-900 mt-0.5">{data.medianDays || 0} Days</p>
                <p className="text-[10px] text-[#6B778C]">50% tasks completed faster</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#DFE1E6]">
                <p className="text-[10px] font-bold text-[#5E6C84] uppercase">85th Percentile</p>
                <p className="text-lg font-black text-amber-900 mt-0.5">{data.p85Days || 0} Days</p>
                <p className="text-[10px] text-[#6B778C]">SLE commitment target</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#DFE1E6]">
                <p className="text-[10px] font-bold text-[#5E6C84] uppercase">95th Percentile</p>
                <p className="text-lg font-black text-red-900 mt-0.5">{data.p95Days || 0} Days</p>
                <p className="text-[10px] text-[#6B778C]">Upper risk threshold</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Clock size={16} className="text-purple-500" /> Completed Tasks Cycle Time
              </h4>
              <div className="overflow-x-auto border border-[#DFE1E6] rounded-lg">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6] text-[#5E6C84] font-bold">
                      <th className="py-2.5 px-4">Task</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Assignee</th>
                      <th className="py-2.5 px-4 text-center">Story Points</th>
                      <th className="py-2.5 px-4 text-right">Cycle Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE1E6] bg-white">
                    {(data.taskCycleList || []).slice(0, 15).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F4F5F7]/60">
                        <td className="py-2.5 px-4 font-medium text-[#172B4D]">
                          <span className="font-mono font-bold text-[#1F6FEB] mr-2">
                            {getTaskCode(item.task.id, projectName, item.task.projectSequence)}
                          </span>
                          {item.task.title}
                        </td>
                        <td className="py-2.5 px-4 text-[#42526E]">{item.task.issueType || 'TASK'}</td>
                        <td className="py-2.5 px-4 text-[#42526E]">{item.task.assignee?.name || 'Unassigned'}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-[#172B4D]">{item.task.storyPoints || 0}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-purple-700">{item.days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'schedule-status':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Sprint / Timeline</p>
                <p className="text-lg font-bold text-[#172B4D] mt-1">{data.sprint?.name || 'Current Milestone'}</p>
                <p className="text-xs text-[#5E6C84] mt-1">
                  {data.sprint?.startDate || 'N/A'} - {data.sprint?.endDate || 'N/A'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Remaining Work</p>
                <p className="text-lg font-bold text-[#1F6FEB] mt-1">{data.remainingPoints || 0} Story Points</p>
                <p className="text-xs text-red-600 mt-1">{data.overdueTasksCount || 0} tasks currently overdue</p>
              </div>
            </div>
          </div>
        );

      case 'budget-status': {
        const formatCurrency = (val?: number) => {
          return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
          }).format(val || 0);
        };

        const method = data.budgetAllocationMethod || 'STORY_POINT_WEIGHTED';
        const isModelA = method === 'STORY_POINT_WEIGHTED';
        const isModelB = method === 'CATEGORY_BASED';

        const modelName = isModelB
          ? 'Model B — Category Based'
          : isModelA
            ? 'Model A — Story Point Weighted'
            : 'Model C — Time Based';

        const modelSubtitle = isModelB
          ? 'Functional domain distribution with hourly labor cost accounting'
          : isModelA
            ? `Proportional agile story point weight at ${formatCurrency(data.costPerStoryPoint || 0)}/SP`
            : `Direct hourly rate billing at ${formatCurrency(data.defaultHourlyRate || 0)}/hr`;

        return (
          <div className="space-y-6">
            {/* Active Financial Framework Banner */}
            <div className="bg-[#DEEBFF]/40 border border-[#B3D4FF] rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#0052CC] text-white text-[10px] font-black uppercase rounded">
                    Active Financial Framework
                  </span>
                  <p className="text-sm font-bold text-[#172B4D]">{modelName}</p>
                </div>
                <p className="text-xs text-[#5E6C84] mt-1">{modelSubtitle}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-[#5E6C84] uppercase">Cost Basis</span>
                <p className="text-sm font-black text-[#0052CC]">
                  {isModelA
                    ? `${formatCurrency(data.costPerStoryPoint || 0)} / SP`
                    : `${formatCurrency(data.defaultHourlyRate || 0)} / hr`}
                </p>
              </div>
            </div>

            {/* Model-Specific KPI Metric Cards */}
            {(() => {
              const spPlanned = (data.totalPoints && data.totalPoints > 0)
                ? data.totalPoints
                : ((data.tasksWithTime || []).reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0) || (data.totalAllocatedBudget && data.costPerStoryPoint ? Math.round(data.totalAllocatedBudget / data.costPerStoryPoint) : 0));

              const spDone = (data.completedPoints && data.completedPoints > 0)
                ? data.completedPoints
                : ((data.tasksWithTime || []).filter((t: any) => {
                  const s = (t.status || '').toUpperCase().trim();
                  return s === 'DONE' || s === 'COMPLETED' || s === 'CLOSED';
                }).reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0) || (data.totalActualCost && data.costPerStoryPoint ? Math.round(data.totalActualCost / data.costPerStoryPoint) : spPlanned));

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {isModelA ? (
                    <>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Allocated Budget</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{formatCurrency(data.totalAllocatedBudget || 0)}</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">{spPlanned} Story Points Planned</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Actual Cost</p>
                        <p className="text-xl font-black text-[#0052CC] mt-1">{formatCurrency(data.totalActualCost || 0)}</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">{spDone} SP Earned</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Completed Scope</p>
                        <p className="text-xl font-black text-[#36B37E] mt-1">{spDone} SP</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">of {spPlanned} Total SP</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Budget Burn Rate</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{data.budgetUtilizationPct || 0}%</p>
                        <p className="text-[10px] text-[#36B37E] font-bold mt-0.5">On Pace</p>
                      </div>
                    </>
                  ) : isModelB ? (
                    <>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Allocated Budget</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{formatCurrency(data.totalAllocatedBudget || 0)}</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">Category Allocation</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Actual Cost</p>
                        <p className="text-xl font-black text-[#0052CC] mt-1">{formatCurrency(data.totalActualCost || 0)}</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">Incurred Cost</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Logged Effort</p>
                        <p className="text-xl font-black text-[#36B37E] mt-1">{data.totalSpentHrs || 0} hrs</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">at {formatCurrency(data.defaultHourlyRate || 0)}/hr</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Budget Burn Rate</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{data.budgetUtilizationPct || 0}%</p>
                        <p className="text-[10px] text-[#36B37E] font-bold mt-0.5">On Pace</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Estimated Effort</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{data.totalEstimatedHrs || 0} hrs</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">Planned Hours</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Logged Effort</p>
                        <p className="text-xl font-black text-[#36B37E] mt-1">{data.totalSpentHrs || 0} hrs</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">Incurred Work Logs</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Hourly Rate</p>
                        <p className="text-xl font-black text-[#0052CC] mt-1">{formatCurrency(data.defaultHourlyRate || 0)}</p>
                        <p className="text-[10px] text-[#5E6C84] mt-0.5">Per Logged Hour</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                        <p className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Effort Utilization</p>
                        <p className="text-xl font-black text-[#172B4D] mt-1">{data.budgetUtilizationPct || 0}%</p>
                        <p className="text-[10px] text-[#36B37E] font-bold mt-0.5">On Pace</p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Clock size={16} className="text-[#1F6FEB]" /> Task Financial Accounting ({data.tasksWithTime?.length || 0})
              </h4>
              {renderTaskTable(data.tasksWithTime || [], [
                ...(isModelA ? [
                  {
                    header: 'Cost / SP',
                    render: () => (
                      <span className="text-[#5E6C84] font-medium">
                        {formatCurrency(data.costPerStoryPoint || 0)}
                      </span>
                    )
                  }
                ] : [
                  {
                    header: 'Est. (Hrs)',
                    render: (t: Task) => Math.round((t.originalEstimateSeconds || 0) / 3600)
                  },
                  {
                    header: 'Logged (Hrs)',
                    render: (t: Task) => Math.round((t.timeSpentSeconds || 0) / 3600)
                  }
                ]),
                {
                  header: 'Allocated Budget',
                  render: (t: Task) => (
                    <span className="font-semibold text-[#172B4D]">
                      {formatCurrency(t.allocatedBudget || 0)}
                    </span>
                  )
                },
                {
                  header: 'Actual Cost',
                  render: (t: Task) => (
                    <span className="font-bold text-[#0052CC]">
                      {formatCurrency(t.actualCost || 0)}
                    </span>
                  )
                }
              ])}
            </div>
          </div>
        );
      }

      case 'resource-utilization':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Active Assignees</p>
                <p className="text-2xl font-bold text-[#1F6FEB] mt-1">{data.activeMembersCount || 0} / {data.totalMembersCount || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Utilization Rate</p>
                <p className="text-2xl font-bold text-[#36B37E] mt-1">{kpi.currentValue}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] text-center shadow-sm">
                <p className="text-[11px] font-bold text-[#5E6C84] uppercase">Unassigned Work</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{data.unassignedTasksCount || 0} Tasks</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center gap-2">
                <Users size={16} className="text-[#1F6FEB]" /> Member Workload Distribution
              </h4>
              <div className="overflow-x-auto border border-[#DFE1E6] rounded-lg">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6] text-[#5E6C84] font-bold">
                      <th className="py-2.5 px-4">Member</th>
                      <th className="py-2.5 px-4 text-center">Assigned Tasks</th>
                      <th className="py-2.5 px-4 text-center">Active Points</th>
                      <th className="py-2.5 px-4 text-center">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE1E6] bg-white">
                    {(data.memberBreakdown || []).map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F4F5F7]/60">
                        <td className="py-2.5 px-4 font-medium text-[#172B4D] flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1F6FEB] text-white flex items-center justify-center text-[10px] font-bold">
                            {m.user?.name?.charAt(0) || 'U'}
                          </div>
                          {m.user?.name}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-[#42526E]">{m.assignedTasks?.length || 0}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-[#FFAB00]">{m.activePoints || 0} SP</td>
                        <td className="py-2.5 px-4 text-center font-bold text-[#172B4D]">{m.assignedPoints || 0} SP</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[6500] flex items-center justify-center p-4 bg-[#091E42]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-[#DFE1E6] flex flex-col max-h-[90vh] overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-[#F4F5F7]/50">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#DEEBFF] text-[#0747A6] border border-[#B3D4FF]">
              {kpi.category}
            </span>
            <div>
              <h3 className="text-lg font-bold text-[#172B4D]">{kpi.title} Details</h3>
              <p className="text-xs text-[#5E6C84]">{kpi.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5E6C84] hover:text-[#172B4D] hover:bg-[#EBECF0] rounded-full transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* METRIC STRIP */}
        <div className="px-6 py-3 bg-[#F4F5F7]/30 border-b border-[#DFE1E6] flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[#6B778C] font-semibold uppercase">Current: </span>
              <span className="text-base font-bold text-[#172B4D] ml-1">{kpi.currentValue}</span>
            </div>
            {kpi.id !== 'budget-status' && (
              <div>
                <span className="text-xs text-[#6B778C] font-semibold uppercase">Previous: </span>
                <span className="text-sm font-semibold text-[#5E6C84] ml-1">{kpi.previousValue}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B778C] font-semibold uppercase">Status:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(kpi.status)}`}>
              {getStatusIcon(kpi.status)} {kpi.status}
            </span>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {renderDetailsBody()}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-[#DFE1E6] bg-[#F4F5F7]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#DFE1E6] hover:bg-[#F4F5F7] text-[#172B4D] text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
