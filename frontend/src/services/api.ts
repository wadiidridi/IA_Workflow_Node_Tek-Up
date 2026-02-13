import axios from 'axios';
import type { Agent, KpiData, Paginated, Run, User, Workflow } from '@/lib/types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post<User>('/auth/register', { email, password }),
  me: () => api.get<User>('/auth/me'),
};

// Agents
export const agentsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Paginated<Agent>>('/agents', { params }),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  create: (data: Partial<Agent>) => api.post<Agent>('/agents', data),
  update: (id: string, data: Partial<Agent>) => api.put<Agent>(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
};

// Workflows
export const workflowsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Paginated<Workflow>>('/workflows', { params }),
  get: (id: string) => api.get<Workflow>(`/workflows/${id}`),
  create: (data: Partial<Workflow>) => api.post<Workflow>('/workflows', data),
  update: (id: string, data: Partial<Workflow>) => api.put<Workflow>(`/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  validate: (id: string) =>
    api.post<{ valid: boolean; errors: string[] }>(`/workflows/${id}/validate`),
};

// Runs
export const runsApi = {
  create: (workflowId: string, prompt: string) =>
    api.post<Run>('/runs', { workflowId, prompt }),
  get: (id: string) => api.get<Run>(`/runs/${id}`),
  list: (params?: Record<string, string>) =>
    api.get<Paginated<Run>>('/runs', { params }),
};

// KPIs
export const kpisApi = {
  get: () => api.get<KpiData>('/kpis'),
};

export default api;
