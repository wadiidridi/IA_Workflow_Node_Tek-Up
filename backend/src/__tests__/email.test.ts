import { describe, it, expect } from 'vitest';

describe('Email Subject Format', () => {
  it('should format email subject correctly for SUCCESS', () => {
    const workflowId = 'abcd1234-5678-9012-3456-789012345678';
    const status = 'SUCCESS';
    const durationMs = 1250;
    const subject = `[Workflow #${workflowId.slice(0, 8)}] ${status} – ${durationMs}ms`;
    expect(subject).toBe('[Workflow #abcd1234] SUCCESS – 1250ms');
  });

  it('should format email subject correctly for FAILED', () => {
    const workflowId = 'xyz98765-4321-0987-6543-210987654321';
    const status = 'FAILED';
    const durationMs = 3400;
    const subject = `[Workflow #${workflowId.slice(0, 8)}] ${status} – ${durationMs}ms`;
    expect(subject).toBe('[Workflow #xyz98765] FAILED – 3400ms');
  });
});

describe('Input Mapping Resolution', () => {
  function resolveMapping(
    mapping: Record<string, unknown>,
    prompt: string,
    nodeOutputs: Map<string, Record<string, unknown>>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string') {
        if (value === '{{prompt}}') {
          resolved[key] = prompt;
        } else {
          const match = value.match(/^\{\{([^.]+)\.(.+)\}\}$/);
          if (match) {
            const [, nodeId, field] = match;
            const outputs = nodeOutputs.get(nodeId);
            resolved[key] = outputs?.[field] ?? value;
          } else {
            resolved[key] = value;
          }
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  it('should resolve prompt reference', () => {
    const result = resolveMapping({ text: '{{prompt}}' }, 'Hello world', new Map());
    expect(result.text).toBe('Hello world');
  });

  it('should resolve node output reference', () => {
    const outputs = new Map([['node-1', { translated: 'Bonjour' }]]);
    const result = resolveMapping({ text: '{{node-1.translated}}' }, '', outputs);
    expect(result.text).toBe('Bonjour');
  });

  it('should pass through literal values', () => {
    const result = resolveMapping({ toLang: 'en', count: 5 }, '', new Map());
    expect(result.toLang).toBe('en');
    expect(result.count).toBe(5);
  });

  it('should keep unresolvable references as-is', () => {
    const result = resolveMapping({ text: '{{nonexistent.field}}' }, '', new Map());
    expect(result.text).toBe('{{nonexistent.field}}');
  });
});
