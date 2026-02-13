import { describe, it, expect } from 'vitest';

// Replicate the cycle detection logic to test it in isolation
function detectCycles(
  nodes: { id: string }[],
  edges: { source: string; target: string }[]
): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const list = adj.get(edge.source);
    if (list) list.push(edge.target);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }
    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && dfs(node.id)) return true;
  }
  return false;
}

// Replicate topological sort
function topologicalSort(
  nodes: { id: string }[],
  edges: { source: string; target: string }[]
): string[][] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const levels: string[][] = [];
  let queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      for (const neighbor of adj.get(nodeId) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) nextQueue.push(neighbor);
      }
    }
    queue = nextQueue;
  }
  return levels;
}

describe('Cycle Detection', () => {
  it('should detect no cycle in linear graph', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    expect(detectCycles(nodes, edges)).toBe(false);
  });

  it('should detect cycle in circular graph', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ];
    expect(detectCycles(nodes, edges)).toBe(true);
  });

  it('should detect self-loop', () => {
    const nodes = [{ id: 'a' }];
    const edges = [{ source: 'a', target: 'a' }];
    expect(detectCycles(nodes, edges)).toBe(true);
  });

  it('should handle empty graph', () => {
    expect(detectCycles([], [])).toBe(false);
  });

  it('should handle disconnected graph with no cycles', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' },
    ];
    expect(detectCycles(nodes, edges)).toBe(false);
  });

  it('should detect cycle in complex graph', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' },
      { source: 'd', target: 'a' },
    ];
    expect(detectCycles(nodes, edges)).toBe(true);
  });
});

describe('Topological Sort', () => {
  it('should sort linear graph', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    const levels = topologicalSort(nodes, edges);
    expect(levels).toEqual([['a'], ['b'], ['c']]);
  });

  it('should identify parallel nodes', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' },
    ];
    const levels = topologicalSort(nodes, edges);
    expect(levels.length).toBe(3);
    expect(levels[0]).toEqual(['a']);
    expect(levels[1].sort()).toEqual(['b', 'c']);
    expect(levels[2]).toEqual(['d']);
  });

  it('should handle single node', () => {
    const nodes = [{ id: 'a' }];
    const levels = topologicalSort(nodes, []);
    expect(levels).toEqual([['a']]);
  });

  it('should handle empty graph', () => {
    const levels = topologicalSort([], []);
    expect(levels).toEqual([]);
  });
});
