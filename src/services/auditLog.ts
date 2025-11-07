// src/services/auditLog.ts
// Audit logging for miniapp actions
// Logs all security-relevant events with timestamp, user, and context

import fs from 'fs';
import path from 'path';

export interface AuditEntry {
  timestamp: string;
  action: string; // 'auth_verified', 'auth_failed', 'session_created', 'rid_consumed', etc.
  tg_id?: number;
  app_user_id?: string;
  status: 'success' | 'failed';
  error?: string;
  ip?: string;
  user_agent?: string;
  context?: Record<string, any>;
}

class AuditLog {
  private logDir: string;
  private logFile: string;
  private inMemoryLogs: AuditEntry[] = [];
  private maxInMemory = 1000; // Keep last 1000 in memory
  private flushInterval = 30 * 1000; // Flush to disk every 30 seconds

  constructor() {
    // Ensure logs directory exists
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Log file with date rotation
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `audit-${date}.jsonl`);

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Add to memory
    this.inMemoryLogs.push(auditEntry);
    if (this.inMemoryLogs.length > this.maxInMemory) {
      this.inMemoryLogs.shift();
    }

    // Log to console for real-time visibility
    const statusEmoji = entry.status === 'success' ? '✅' : '❌';
    console.log(
      `${statusEmoji} [Audit] ${entry.action} - TG:${entry.tg_id || 'N/A'} - ${entry.status}${
        entry.error ? ` (${entry.error})` : ''
      }`
    );

    // Flush immediately for security-critical actions
    if (
      [
        'auth_verified',
        'auth_failed',
        'invalid_signature',
        'rate_limited',
      ].includes(entry.action)
    ) {
      this.flush();
    }
  }

  /**
   * Flush logs to disk
   */
  private flush(): void {
    if (this.inMemoryLogs.length === 0) return;

    try {
      const lines = this.inMemoryLogs
        .map((entry) => JSON.stringify(entry))
        .join('\n');

      fs.appendFileSync(this.logFile, lines + '\n', 'utf-8');
      console.log(`💾 [AuditLog] Flushed ${this.inMemoryLogs.length} entries to ${this.logFile}`);

      this.inMemoryLogs = [];
    } catch (err: any) {
      console.error('❌ [AuditLog] Failed to flush logs:', err.message);
    }
  }

  /**
   * Start periodic flush interval
   */
  private startPeriodicFlush(): void {
    setInterval(() => {
      if (this.inMemoryLogs.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Get recent logs (from memory)
   */
  getRecent(limit: number = 100): AuditEntry[] {
    return this.inMemoryLogs.slice(-limit);
  }

  /**
   * Get logs for a specific Telegram user
   */
  getForUser(telegramId: number, limit: number = 50): AuditEntry[] {
    return this.inMemoryLogs
      .filter((entry) => entry.tg_id === telegramId)
      .slice(-limit);
  }

  /**
   * Get logs for a specific action
   */
  getForAction(action: string, limit: number = 50): AuditEntry[] {
    return this.inMemoryLogs
      .filter((entry) => entry.action === action)
      .slice(-limit);
  }
}

export const auditLog = new AuditLog();
export default auditLog;
