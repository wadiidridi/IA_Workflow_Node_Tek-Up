import { v4 as uuidv4 } from 'uuid';

export interface LogEntry {
  timestamp: string;
  level: string;
  correlationId?: string;
  workflowId?: string;
  runId?: string;
  message: string;
  data?: unknown;
}

export function createLogger(context?: { correlationId?: string; workflowId?: string; runId?: string }) {
  const log = (level: string, message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...context,
      message,
      data,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
    debug: (message: string, data?: unknown) => log('debug', message, data),
  };
}

export const logger = createLogger();
