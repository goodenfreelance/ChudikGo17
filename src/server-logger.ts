import fs from 'fs';
import path from 'path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogSource = 'Node' | 'Go' | 'WS' | 'HTTP' | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  stack?: string;
  details?: Record<string, any>;
}

export class ServerLogger {
  private buffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private logDir = path.join(process.cwd(), 'logs');
  private logFilePath = path.join(process.cwd(), 'logs', 'server.log');
  private errorCount = 0;
  private warnCount = 0;

  constructor() {
    this.ensureLogDir();
  }

  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create log directory:', e);
    }
  }

  public log(
    level: LogLevel,
    source: LogSource,
    message: string,
    stack?: string,
    details?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      stack,
      details,
    };

    if (level === 'ERROR' || level === 'FATAL') {
      this.errorCount++;
    } else if (level === 'WARN') {
      this.warnCount++;
    }

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    this.writeToFile(entry);

    const consoleMsg = `[${entry.timestamp}] [${level}] [${source}] ${message}${
      stack ? `\nStack: ${stack}` : ''
    }`;
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(consoleMsg);
    } else if (level === 'WARN') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    return entry;
  }

  public info(source: LogSource, message: string, details?: Record<string, any>) {
    return this.log('INFO', source, message, undefined, details);
  }

  public warn(source: LogSource, message: string, details?: Record<string, any>) {
    return this.log('WARN', source, message, undefined, details);
  }

  public error(source: LogSource, message: string, stack?: string, details?: Record<string, any>) {
    return this.log('ERROR', source, message, stack, details);
  }

  public fatal(source: LogSource, message: string, stack?: string, details?: Record<string, any>) {
    return this.log('FATAL', source, message, stack, details);
  }

  private writeToFile(entry: LogEntry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch (e) {
      // ignore append error
    }
  }

  public getLogs(filters?: {
    level?: string;
    source?: string;
    search?: string;
    limit?: number;
  }): LogEntry[] {
    let result = [...this.buffer];

    if (filters?.level && filters.level !== 'ALL') {
      result = result.filter((e) => e.level === filters.level);
    }

    if (filters?.source && filters.source !== 'ALL') {
      result = result.filter((e) => e.source === filters.source);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q) ||
          (e.stack && e.stack.toLowerCase().includes(q))
      );
    }

    // Most recent logs first
    result.reverse();

    const limit = filters?.limit || 200;
    return result.slice(0, limit);
  }

  public getSummary() {
    return {
      total: this.buffer.length,
      errors: this.errorCount,
      warnings: this.warnCount,
      logFilePath: this.logFilePath,
    };
  }

  public clearLogs() {
    this.buffer = [];
    this.errorCount = 0;
    this.warnCount = 0;
    try {
      fs.writeFileSync(this.logFilePath, '', 'utf-8');
    } catch (e) {
      // ignore
    }
  }

  public getLogFilePath() {
    return this.logFilePath;
  }
}

export const serverLogger = new ServerLogger();
