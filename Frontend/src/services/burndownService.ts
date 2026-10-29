import api from './api';
import type {
  BurndownResponse,
  BurndownSummary,
  SprintScopeChange,
  BurndownAlert
} from '../types';

export const burndownService = {
  getBurndown: async (sprintId: number): Promise<BurndownResponse> => {
    const res = await api.get<BurndownResponse>(`/sprints/${sprintId}/burndown`);
    return res.data;
  },

  getBurndownSummary: async (sprintId: number): Promise<BurndownSummary> => {
    const res = await api.get<BurndownSummary>(`/sprints/${sprintId}/burndown/summary`);
    return res.data;
  },

  getScopeChanges: async (sprintId: number): Promise<SprintScopeChange[]> => {
    const res = await api.get<SprintScopeChange[]>(`/sprints/${sprintId}/burndown/scope-changes`);
    return res.data;
  },

  getAnomalies: async (sprintId: number): Promise<BurndownAlert[]> => {
    const res = await api.get<BurndownAlert[]>(`/sprints/${sprintId}/burndown/anomalies`);
    return res.data;
  }
};

export default burndownService;
