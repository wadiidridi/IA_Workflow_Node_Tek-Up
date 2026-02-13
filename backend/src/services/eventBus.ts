import { EventEmitter } from 'events';

// Global event emitter for SSE
export const runEvents = new EventEmitter();
runEvents.setMaxListeners(100);

export interface RunEvent {
  type: 'step:start' | 'step:log' | 'step:complete' | 'step:error' | 'run:complete' | 'run:error';
  runId: string;
  data: Record<string, unknown>;
}

export function emitRunEvent(event: RunEvent) {
  runEvents.emit(`run:${event.runId}`, event);
}
