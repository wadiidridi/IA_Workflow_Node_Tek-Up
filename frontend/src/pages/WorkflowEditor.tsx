import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Connection,
  type Node,
  type Edge,
  Panel,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { agentsApi, workflowsApi } from '@/services/api';
import type { Agent, WorkflowNode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Bot, Save, CheckCircle, Play, X } from 'lucide-react';

// -- Custom Node Component --
function AgentNode({ data }: NodeProps) {
  const d = data as { label: string; agent: Agent; config: WorkflowNode };
  const mappingInKeys = d.config?.mappingIn ? Object.entries(d.config.mappingIn) : [];
  const mappingOutKeys = d.config?.mappingOut ? Object.entries(d.config.mappingOut) : [];
  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm min-w-[200px] max-w-[260px]">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500" />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{d.label}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {d.agent?.family}.{d.agent?.name}
        </Badge>
        {mappingInKeys.length > 0 && (
          <div className="mt-2 border-t pt-1">
            <div className="text-[10px] font-semibold text-blue-600 uppercase">Inputs</div>
            {mappingInKeys.map(([k, v]) => (
              <div key={k} className="text-[10px] text-muted-foreground truncate" title={`${k}: ${String(v)}`}>
                <span className="font-medium">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        )}
        {mappingOutKeys.length > 0 && (
          <div className="mt-1 border-t pt-1">
            <div className="text-[10px] font-semibold text-green-600 uppercase">Outputs</div>
            {mappingOutKeys.map(([k, v]) => (
              <div key={k} className="text-[10px] text-muted-foreground truncate" title={`${k}: ${String(v)}`}>
                <span className="font-medium">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {d.config?.errorPolicy === 'CONTINUE' ? 'On error: continue' : 'On error: stop'}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-green-500" />
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };

// -- Cycle Detection --
function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
  }
  const visited = new Set<string>();
  const recStack = new Set<string>();
  function dfs(id: string): boolean {
    visited.add(id);
    recStack.add(id);
    for (const n of adj.get(id) || []) {
      if (!visited.has(n)) { if (dfs(n)) return true; }
      else if (recStack.has(n)) return true;
    }
    recStack.delete(id);
    return false;
  }
  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) return true;
  }
  return false;
}

export function WorkflowEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowVersion, setWorkflowVersion] = useState(1);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  // Node configs stored separately to allow editing
  const [nodeConfigs, setNodeConfigs] = useState<Map<string, WorkflowNode>>(new Map());

  useEffect(() => {
    agentsApi.list({ limit: '100' }).then((r) => setAgents(r.data.data)).catch(() => {});
    if (!isNew && id) {
      workflowsApi.get(id).then((r) => {
        const wf = r.data;
        setWorkflowName(wf.name);
        setWorkflowVersion(wf.version);

        const configMap = new Map<string, WorkflowNode>();
        const flowNodes: Node[] = (wf.nodes as WorkflowNode[]).map((n) => {
          configMap.set(n.id, n);
          return {
            id: n.id,
            type: 'agentNode',
            position: n.position,
            data: { label: n.label, agent: null, config: n },
          };
        });
        setNodeConfigs(configMap);
        setNodes(flowNodes);
        setEdges(wf.edges.map((e) => ({ ...e, animated: true })));

        // Resolve agent names
        agentsApi.list({ limit: '100' }).then((ar) => {
          const agentMap = new Map(ar.data.data.map((a) => [a.id, a]));
          setNodes((prev) =>
            prev.map((n) => {
              const cfg = configMap.get(n.id);
              const agent = cfg ? agentMap.get(cfg.agentId) : undefined;
              return agent ? { ...n, data: { ...n.data, agent, config: cfg } } : n;
            })
          );
        });
      });
    }
  }, [id]);

  const filteredAgents = useMemo(
    () => agents.filter((a) => a.active &&
      (a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
       a.family.toLowerCase().includes(agentSearch.toLowerCase()))),
    [agents, agentSearch]
  );

  const familyGroups = useMemo(() => {
    const groups = new Map<string, Agent[]>();
    for (const a of filteredAgents) {
      const list = groups.get(a.family) || [];
      list.push(a);
      groups.set(a.family, list);
    }
    return groups;
  }, [filteredAgents]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge({ ...connection, animated: true }, edges);
      const testNodes = nodes;
      if (hasCycle(testNodes, newEdges as Edge[])) {
        alert('Cannot add this connection: it would create a cycle');
        return;
      }
      setEdges(newEdges);
    },
    [edges, nodes, setEdges]
  );

  const addAgentNode = (agent: Agent) => {
    const nodeId = `node-${Date.now()}`;

    // Auto-populate mappingIn from agent's schemaIn
    const mappingIn: Record<string, unknown> = {};
    const schemaIn = agent.schemaIn as { properties?: Record<string, { type?: string }>; required?: string[] };
    if (schemaIn?.properties) {
      for (const [key, prop] of Object.entries(schemaIn.properties)) {
        if (prop.type === 'string') {
          mappingIn[key] = '{{prompt}}';
        } else if (prop.type === 'number') {
          mappingIn[key] = 0;
        }
      }
    }

    // Auto-populate mappingOut from agent's schemaOut
    const mappingOut: Record<string, unknown> = {};
    const schemaOut = agent.schemaOut as { properties?: Record<string, { type?: string }> };
    if (schemaOut?.properties) {
      for (const key of Object.keys(schemaOut.properties)) {
        mappingOut[key] = `{{${nodeId}.${key}}}`;
      }
    }

    const config: WorkflowNode = {
      id: nodeId,
      agentId: agent.id,
      label: `${agent.family}.${agent.name}`,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
      config: {},
      mappingIn,
      mappingOut,
      errorPolicy: 'STOP',
      maxRetries: 0,
      backoffMs: 1000,
    };
    setNodeConfigs((prev) => new Map(prev).set(nodeId, config));
    const newNode: Node = {
      id: nodeId,
      type: 'agentNode',
      position: config.position,
      data: { label: config.label, agent, config },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const wfNodes: WorkflowNode[] = nodes.map((n) => {
        const cfg = nodeConfigs.get(n.id);
        return {
          id: n.id,
          agentId: cfg?.agentId || '',
          label: cfg?.label || (n.data as Record<string, unknown>).label as string || n.id,
          position: n.position,
          config: cfg?.config || {},
          mappingIn: cfg?.mappingIn || {},
          mappingOut: cfg?.mappingOut || {},
          errorPolicy: cfg?.errorPolicy || 'STOP',
          maxRetries: cfg?.maxRetries || 0,
          backoffMs: cfg?.backoffMs || 1000,
        };
      });

      const data = {
        name: workflowName,
        nodes: wfNodes,
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
        })),
      };

      if (isNew) {
        const r = await workflowsApi.create(data);
        navigate(`/workflows/${r.data.id}/edit`, { replace: true });
      } else {
        await workflowsApi.update(id!, data);
        setWorkflowVersion((v) => v + 1);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (isNew) {
      setValidationResult({ valid: false, errors: ['Save the workflow first'] });
      return;
    }
    try {
      const r = await workflowsApi.validate(id!);
      setValidationResult(r.data);
    } catch {
      setValidationResult({ valid: false, errors: ['Validation failed'] });
    }
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const updateNodeConfig = (field: string, value: unknown) => {
    if (!selectedNode) return;
    const cfg = nodeConfigs.get(selectedNode.id);
    if (!cfg) return;
    const updated = { ...cfg, [field]: value };
    setNodeConfigs((prev) => new Map(prev).set(selectedNode.id, updated));
    setNodes((prev) =>
      prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: updated, label: updated.label } } : n)
    );
  };

  return (
    <div className="flex h-full">
      {/* Agent Palette */}
      <div className="w-64 border-r bg-muted/30 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm mb-2">Agent Palette</h3>
          <Input
            placeholder="Search agents..."
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {[...familyGroups.entries()].map(([family, agentList]) => (
            <div key={family}>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1 px-2 uppercase">{family}</h4>
              {agentList.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => addAgentNode(agent)}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Bot className="h-3 w-3" />
                  <span>{agent.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">v{agent.version}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background />
          <Panel position="top-left">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow border">
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="h-8 w-48 text-sm font-medium"
              />
              <Badge variant="outline">v{workflowVersion}</Badge>
            </div>
          </Panel>
          <Panel position="top-right">
            <div className="flex gap-2 bg-white p-2 rounded-lg shadow border">
              <Button size="sm" variant="outline" onClick={handleValidate}>
                <CheckCircle className="h-4 w-4 mr-1" /> Validate
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
              </Button>
              {!isNew && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/workflows/${id}/run`)}>
                  <Play className="h-4 w-4 mr-1" /> Run
                </Button>
              )}
            </div>
          </Panel>
          {validationResult && (
            <Panel position="bottom-center">
              <div className={`p-3 rounded-lg shadow border text-sm ${
                validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                {validationResult.valid ? (
                  <span className="text-green-700">Workflow is valid!</span>
                ) : (
                  <div>
                    <span className="text-red-700 font-medium">Validation errors:</span>
                    <ul className="list-disc ml-4 mt-1 text-red-600">
                      {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Config Panel */}
      {selectedNode && (
        <div className="w-72 border-l bg-muted/30 overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Node Config</h3>
            <button onClick={() => setSelectedNode(null)} className="cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-4">
            {(() => {
              const cfg = nodeConfigs.get(selectedNode.id);
              if (!cfg) return null;
              return (
                <>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input value={cfg.label} onChange={(e) => updateNodeConfig('label', e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Error Policy</Label>
                    <Select value={cfg.errorPolicy} onChange={(e) => updateNodeConfig('errorPolicy', e.target.value)} className="h-8 text-sm">
                      <option value="STOP">Stop</option>
                      <option value="CONTINUE">Continue</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Retries</Label>
                    <Input type="number" value={cfg.maxRetries} onChange={(e) => updateNodeConfig('maxRetries', parseInt(e.target.value, 10))} className="h-8 text-sm" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label>Backoff (ms)</Label>
                    <Input type="number" value={cfg.backoffMs} onChange={(e) => updateNodeConfig('backoffMs', parseInt(e.target.value, 10))} className="h-8 text-sm" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label>Input Mapping (JSON)</Label>
                    <textarea
                      className="w-full h-24 rounded-md border px-2 py-1 text-xs font-mono"
                      value={JSON.stringify(cfg.mappingIn, null, 2)}
                      onChange={(e) => {
                        try { updateNodeConfig('mappingIn', JSON.parse(e.target.value)); } catch {}
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Output Mapping (JSON)</Label>
                    <textarea
                      className="w-full h-24 rounded-md border px-2 py-1 text-xs font-mono"
                      value={JSON.stringify(cfg.mappingOut, null, 2)}
                      onChange={(e) => {
                        try { updateNodeConfig('mappingOut', JSON.parse(e.target.value)); } catch {}
                      }}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
                      setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                      nodeConfigs.delete(selectedNode.id);
                      setSelectedNode(null);
                    }}
                  >
                    Delete Node
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
