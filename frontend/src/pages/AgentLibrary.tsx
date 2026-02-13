import { useEffect, useState } from 'react';
import { agentsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import type { Agent } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { Bot, Edit, Trash2, Plus } from 'lucide-react';

export function AgentLibraryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const loadAgents = () => {
    const params: Record<string, string> = { sortBy };
    if (search) params.search = search;
    if (familyFilter) params.family = familyFilter;
    if (statusFilter) params.status = statusFilter;
    agentsApi.list(params).then((r) => setAgents(r.data.data)).catch(() => {});
  };

  useEffect(() => { loadAgents(); }, [search, familyFilter, statusFilter, sortBy]);

  const families = [...new Set(agents.map((a) => a.family))];

  const handleDelete = async (id: string) => {
    await agentsApi.delete(id);
    loadAgents();
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Agent Library</h2>
        {isAdmin && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" /> Create Agent
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} className="w-40">
          <option value="">All families</option>
          {families.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-40">
          <option value="createdAt">Date</option>
          <option value="name">Name</option>
        </Select>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{agent.family}.{agent.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">v{agent.version}</p>
                </div>
              </div>
              <Badge variant={agent.active ? 'success' : 'secondary'}>
                {agent.active ? 'Active' : 'Inactive'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {agent.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Endpoint: {agent.endpointUrl}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(agent)}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Deactivate
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {agents.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No agents found.
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <AgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        agent={editingAgent}
        onSaved={loadAgents}
      />
    </div>
  );
}

function AgentDialog({
  open,
  onClose,
  agent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  agent: Agent | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [family, setFamily] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [schemaIn, setSchemaIn] = useState('{}');
  const [schemaOut, setSchemaOut] = useState('{}');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setFamily(agent.family);
      setVersion(agent.version);
      setEndpointUrl(agent.endpointUrl);
      setSchemaIn(JSON.stringify(agent.schemaIn, null, 2));
      setSchemaOut(JSON.stringify(agent.schemaOut, null, 2));
      setTags(agent.tags.join(', '));
    } else {
      setName(''); setFamily(''); setVersion('1.0.0'); setEndpointUrl('');
      setSchemaIn('{}'); setSchemaOut('{}'); setTags('');
    }
    setError('');
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = {
        name,
        family,
        version,
        endpointUrl,
        schemaIn: JSON.parse(schemaIn),
        schemaOut: JSON.parse(schemaOut),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (agent) {
        await agentsApi.update(agent.id, data);
      } else {
        await agentsApi.create(data);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">{agent ? 'Edit Agent' : 'Create Agent'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="family">Family</Label>
            <Input id="family" value={family} onChange={(e) => setFamily(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint URL</Label>
            <Input id="endpoint" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="schemaIn">Input Schema (JSON)</Label>
          <Textarea id="schemaIn" value={schemaIn} onChange={(e) => setSchemaIn(e.target.value)} className="font-mono text-xs" rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schemaOut">Output Schema (JSON)</Label>
          <Textarea id="schemaOut" value={schemaOut} onChange={(e) => setSchemaOut(e.target.value)} className="font-mono text-xs" rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
