import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Node,
  type Edge,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { workflowsApi, runsApi } from '@/services/api';
import type { Run, RunStep, Workflow, WorkflowNode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Loader2, Bot } from 'lucide-react';

const statusColors: Record<string, string> = {
  PENDING: '#9ca3af',
  RUNNING: '#3b82f6',
  SUCCESS: '#22c55e',
  FAILED: '#ef4444',
  SKIPPED: '#6b7280',
};

function PlaygroundNode({ data }: NodeProps) {
  const d = data as { label: string; status: string };
  const color = statusColors[d.status] || '#9ca3af';
  return (
    <div className="rounded-lg shadow-sm min-w-[160px]" style={{ border: `2px solid ${color}`, backgroundColor: d.status === 'RUNNING' ? `${color}15` : '#fff' }}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3" style={{ background: color }} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium">{d.label}</span>
        </div>
        <Badge variant={d.status === 'SUCCESS' ? 'success' : d.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-xs">
          {d.status || 'PENDING'}
        </Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3" style={{ background: color }} />
    </div>
  );
}

const nodeTypes = { playgroundNode: PlaygroundNode };

export function PlaygroundPage() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [prompt, setPrompt] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!id) return;
    workflowsApi.get(id).then((r) => {
      const wf = r.data;
      setWorkflow(wf);
      const wfNodes = wf.nodes as WorkflowNode[];
      setNodes(
        wfNodes.map((n) => ({
          id: n.id,
          type: 'playgroundNode',
          position: n.position,
          data: { label: n.label, status: 'PENDING' },
        }))
      );
      setEdges(wf.edges.map((e) => ({ ...e, animated: false })));
    });
  }, [id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const updateNodeStatus = useCallback((nodeId: string, status: string) => {
    setNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)
    );
  }, [setNodes]);

  const handleRun = async () => {
    if (!workflow || !prompt.trim()) return;
    setRunning(true);
    setLogs([]);
    setSteps([]);

    // Reset node statuses
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: 'PENDING' } })));

    try {
      const { data: newRun } = await runsApi.create(workflow.id, prompt);
      setRun(newRun);

      // Connect SSE
      const token = localStorage.getItem('token');
      const es = new EventSource(`/api/runs/${newRun.id}/stream?token=${token}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const parsed = JSON.parse(event.data);

        switch (parsed.type) {
          case 'init':
            setSteps(parsed.steps || []);
            break;
          case 'step:start':
            updateNodeStatus(parsed.data.nodeId, 'RUNNING');
            setLogs((prev) => [...prev, `[START] ${parsed.data.label}`]);
            break;
          case 'step:log':
            if (parsed.data.logs) {
              setLogs((prev) => [...prev, ...parsed.data.logs.map((l: string) => `  ${l}`)]);
            }
            break;
          case 'step:complete':
            updateNodeStatus(parsed.data.nodeId, 'SUCCESS');
            setLogs((prev) => [
              ...prev,
              `[DONE] ${parsed.data.label} (${parsed.data.durationMs}ms)`,
              `  Output: ${JSON.stringify(parsed.data.outputs, null, 2)}`,
            ]);
            break;
          case 'step:error':
            updateNodeStatus(parsed.data.nodeId, 'FAILED');
            setLogs((prev) => [...prev, `[ERROR] ${parsed.data.label}: ${parsed.data.error}`]);
            break;
          case 'run:complete':
            setLogs((prev) => [...prev, `\n=== Run COMPLETED (${parsed.data.durationMs}ms) ===`]);
            setRunning(false);
            es.close();
            loadRunDetails(newRun.id);
            break;
          case 'run:error':
            setLogs((prev) => [...prev, `\n=== Run FAILED ===`]);
            setRunning(false);
            es.close();
            loadRunDetails(newRun.id);
            break;
        }
      };

      es.onerror = () => {
        setRunning(false);
        es.close();
        if (newRun.id) loadRunDetails(newRun.id);
      };
    } catch (err) {
      setRunning(false);
      setLogs((prev) => [...prev, `Error starting run: ${(err as Error).message}`]);
    }
  };

  const loadRunDetails = async (runId: string) => {
    const { data } = await runsApi.get(runId);
    setRun(data);
    setSteps(data.steps || []);
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">{workflow?.name || 'Playground'}</h2>
          {run && (
            <Badge variant={run.status === 'SUCCESS' ? 'success' : run.status === 'FAILED' ? 'destructive' : 'warning'}>
              {run.status} {run.durationMs ? `(${run.durationMs}ms)` : ''}
            </Badge>
          )}
        </div>
        <div className="flex gap-3">
          <Textarea
            placeholder="Enter your prompt here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 min-h-[60px]"
            maxLength={50000}
          />
          <Button onClick={handleRun} disabled={running || !prompt.trim()} className="self-end">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? 'Running...' : 'Run'}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{prompt.length} / 50,000 characters</div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex">
        {/* Graph view */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {/* Right panel: steps + logs */}
        <div className="w-96 border-l flex flex-col overflow-hidden">
          {/* Steps table */}
          <Card className="m-2 flex-shrink-0">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Steps</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Node</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step) => (
                      <tr key={step.id} className="border-b">
                        <td className="py-2 px-3">{step.agent?.name || step.nodeId}</td>
                        <td className="py-2 px-3">
                          <Badge variant={step.status === 'SUCCESS' ? 'success' : step.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-xs">
                            {step.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{step.durationMs ?? '-'}ms</td>
                      </tr>
                    ))}
                    {steps.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">
                          Run a workflow to see steps
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Output Preview */}
          {steps.some((s) => s.outputPreview && Object.keys(s.outputPreview).length > 0) && (
            <Card className="m-2 mt-0 flex-shrink-0">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Output Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-48 overflow-y-auto">
                  {steps.filter((s) => s.outputPreview && Object.keys(s.outputPreview).length > 0).map((step) => (
                    <div key={step.id} className="border-b px-3 py-2">
                      <div className="text-xs font-semibold mb-1">{step.agent?.name || step.nodeId}</div>
                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(step.outputPreview, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          <div className="flex-1 flex flex-col m-2 mt-0">
            <h3 className="text-sm font-semibold mb-1 px-2">Logs</h3>
            <div className="flex-1 bg-gray-900 text-green-400 text-xs font-mono p-3 rounded-md overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
              {logs.length === 0 && <div className="text-gray-500">Waiting for execution...</div>}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
