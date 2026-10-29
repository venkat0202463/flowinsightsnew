import api from './api';
import type {
  ProjectFinancialSummaryDTO,
  TaskFinancialDTO,
  ProjectBudgetSettingsRequest,
  TaskBudgetUpdateRequest,
  ProjectBudgetHistoryDTO,
} from '../types';

export const financialService = {
  getFinancialSummary: async (projectId: number): Promise<ProjectFinancialSummaryDTO> => {
    const response = await api.get<ProjectFinancialSummaryDTO>(`/projects/${projectId}/financials`);
    return response.data;
  },

  getBudgetHistory: async (projectId: number): Promise<ProjectBudgetHistoryDTO[]> => {
    const response = await api.get<ProjectBudgetHistoryDTO[]>(`/projects/${projectId}/budget/history`);
    return response.data;
  },

  getTaskFinancials: async (projectId: number): Promise<TaskFinancialDTO[]> => {
    const response = await api.get<TaskFinancialDTO[]>(`/projects/${projectId}/tasks/financials`);
    return response.data;
  },

  updateProjectBudget: async (
    projectId: number,
    request: ProjectBudgetSettingsRequest
  ): Promise<ProjectFinancialSummaryDTO> => {
    const response = await api.put<ProjectFinancialSummaryDTO>(`/projects/${projectId}/budget`, request);
    return response.data;
  },

  recalculateBudget: async (
    projectId: number,
    resetManualOverrides = false
  ): Promise<ProjectFinancialSummaryDTO> => {
    const response = await api.post<ProjectFinancialSummaryDTO>(
      `/projects/${projectId}/budget/calculate?resetManualOverrides=${resetManualOverrides}`
    );
    return response.data;
  },

  updateTaskBudget: async (
    projectId: number,
    taskId: number,
    request: TaskBudgetUpdateRequest
  ): Promise<TaskFinancialDTO> => {
    const response = await api.put<TaskFinancialDTO>(`/projects/${projectId}/tasks/${taskId}/budget`, request);
    return response.data;
  },
};
