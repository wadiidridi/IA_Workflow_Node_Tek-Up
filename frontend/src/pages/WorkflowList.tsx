import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { workflowsApi } from '@/services/api';
import type { Workflow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Play, Trash2 } from 'lucide-react';

const statusVariant = (status: string) => {
  switch (status) {
    case 'SUCCESS': return 'success' as const;
    case 'FAILED': return 'destructive' as const;
    case 'RUNNING': return 'warning' as const;
    default: return 'secondary' as const;
  }
};

export function WorkflowListPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const loadWorkflows = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    workflowsApi.list(params).then((r) => setWorkflows(r.data.data)).catch(() => {});
  };

  useEffect(() => { loadWorkflows(); }, [search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    await workflowsApi.delete(id);
    loadWorkflows();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Workflows</h2>
        <Button onClick={() => navigate('/workflows/new')}>
          <Plus className="h-4 w-4 mr-2" /> New Workflow
        </Button>
      </div>

      <div className="flex gap-3">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((w) => (
          <Card key={w.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{w.name}</CardTitle>
                <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                <p>Version: v{w.version} | Nodes: {(w.nodes as unknown[])?.length || 0}</p>
                <p>Created by: {w.user?.email || 'Unknown'}</p>
                <p>Updated: {new Date(w.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/${w.id}/edit`)}>
                  <Edit className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/${w.id}/run`)}>
                  <Play className="h-3 w-3 mr-1" /> Run
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {workflows.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No workflows found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
