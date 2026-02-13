export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  family: string;
  version: string;
  schemaIn: Record<string, unknown>;
  schemaOut: Record<string, unknown>;
  endpointUrl: string;
  secrets: Record<string, string>;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  mappingIn: Record<string, unknown>;
  mappingOut: Record<string, unknown>;
  errorPolicy: 'STOP' | 'CONTINUE';
  maxRetries: number;
  backoffMs: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  version: number;
  status: 'DRAFT' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
  _count?: { runs: number };
}

export interface Run {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  prompt: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  metrics: Record<string, unknown>;
  error?: string;
  triggeredBy: string;
  workflow?: { name: string };
  steps?: RunStep[];
}

export interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  agentId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  logs: string[];
  inputPreview: Record<string, unknown>;
  outputPreview: Record<string, unknown>;
  agent?: { name: string; family: string };
}

export interface KpiData {
  successRate: number;
  totalRuns: number;
  successRuns: number;
  duration: { avg: number; p50: number; p95: number; max: number };
  errorsByFamily: { family: string; error_count: number }[];
  topAgents: { id: string; name: string; family: string; usage_count: number; success_count: number; successRate: number }[];
  durationDistribution: { bucket: string; count: number }[];
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
