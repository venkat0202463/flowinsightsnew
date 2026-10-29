import api from './api';
import type {
  VelocityAnalyticsResponse,
  VelocityStability,
  VelocityPlanningRecommendation,
  TeamCapacity,
  SprintCapacityRequest
} from '../types';

export const velocityService = {
  getVelocityAnalytics: async (projectId: number, sprintCount?: number | 'ALL'): Promise<VelocityAnalyticsResponse> => {
    const countParam = sprintCount && sprintCount !== 'ALL' ? `&sprintCount=${sprintCount}` : '';
    const res = await api.get<VelocityAnalyticsResponse>(`/velocity/analytics?projectId=${projectId}${countParam}`);
    return res.data;
  },

  getVelocityStability: async (projectId: number, sprintCount?: number | 'ALL'): Promise<VelocityStability> => {
    const countParam = sprintCount && sprintCount !== 'ALL' ? `&sprintCount=${sprintCount}` : '';
    const res = await api.get<VelocityStability>(`/velocity/stability?projectId=${projectId}${countParam}`);
    return res.data;
  },

  getPlanningRecommendation: async (
    projectId: number,
    sprintWindow?: number,
    sprintId?: number | null
  ): Promise<VelocityPlanningRecommendation> => {
    let url = `/velocity/planning-recommendation?projectId=${projectId}`;
    if (sprintWindow) {
      url += `&sprintWindow=${sprintWindow}`;
    }
    if (sprintId) {
      url += `&sprintId=${sprintId}`;
    }
    const res = await api.get<VelocityPlanningRecommendation>(url);
    return res.data;
  },

  getTeamCapacity: async (projectId: number, sprintId?: number | null): Promise<TeamCapacity> => {
    const sprintParam = sprintId ? `&sprintId=${sprintId}` : '';
    const res = await api.get<TeamCapacity>(`/velocity/capacity?projectId=${projectId}${sprintParam}`);
    return res.data;
  },

  saveTeamCapacity: async (request: SprintCapacityRequest): Promise<TeamCapacity> => {
    const res = await api.post<TeamCapacity>('/velocity/capacity', request);
    return res.data;
  }
};

export default velocityService;
