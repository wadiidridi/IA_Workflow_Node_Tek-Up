import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { kpisApi, workflowsApi } from '@/services/api';
import type { KpiData, Workflow } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, CheckCircle, Clock, AlertTriangle, Play, Edit } from 'lucide-react';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'];

const statusVariant = (status: string) => {
  switch (status) {
    case 'SUCCESS': return 'success' as const;
    case 'FAILED': return 'destructive' as const;
    case 'RUNNING': return 'warning' as const;
    default: return 'secondary' as const;
  }
};

export function DashboardPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    kpisApi.get().then((r) => setKpis(r.data)).catch(() => {});
    loadWorkflows();
  }, []);

  const loadWorkflows = (params?: Record<string, string>) => {
    workflowsApi.list(params).then((r) => setWorkflows(r.data.data)).catch(() => {});
  };

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    loadWorkflows(params);
  }, [search, statusFilter]);

  const pieData = kpis
    ? [
        { name: 'Success', value: kpis.successRuns },
        { name: 'Failed', value: kpis.totalRuns - kpis.successRuns },
      ]
    : [];

  return (
    <div className="p-8 space-y-8">
      <h2 className="text-3xl font-bold">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalRuns ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis ? `${Math.round(kpis.successRate * 100)}%` : '0%'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.duration.avg ?? 0}ms</div>
            <p className="text-xs text-muted-foreground">P95: {kpis?.duration.p95 ?? 0}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors by Family</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis?.errorsByFamily.reduce((a, b) => a + b.error_count, 0) ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Success / Failure</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {kpis && kpis.totalRuns > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Agents</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {kpis && kpis.topAgents.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.topAgents}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="usage_count" fill="#3b82f6" name="Usage" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Duration Distribution */}
      {kpis && kpis.durationDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.durationDistribution}>
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Workflows</CardTitle>
            <Button onClick={() => navigate('/workflows/new')} size="sm">
              + New Workflow
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="RUNNING">Running</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Name</th>
                  <th className="text-left py-3 px-2 font-medium">Status</th>
                  <th className="text-left py-3 px-2 font-medium">Version</th>
                  <th className="text-left py-3 px-2 font-medium">Runs</th>
                  <th className="text-left py-3 px-2 font-medium">Updated</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{w.name}</td>
                    <td className="py-3 px-2">
                      <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                    </td>
                    <td className="py-3 px-2">v{w.version}</td>
                    <td className="py-3 px-2">{w._count?.runs ?? 0}</td>
                    <td className="py-3 px-2">{new Date(w.updatedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/workflows/${w.id}/edit`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/workflows/${w.id}/run`)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {workflows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No workflows found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
