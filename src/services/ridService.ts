// src/services/ridService.ts
// Request ID (RID) service for miniapp session management
// Generates short-lived, one-time request IDs for security

import crypto from 'crypto';

export interface RequestId {
  rid: string;
  telegramId: number;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  intent: string; // 'open_app', 'auth', etc.
  context?: Record<string, any>;
}

class RidService {
  private rids: Map<string, RequestId> = new Map();
  private ridTTL = 15 * 60 * 1000; // 15 minutes (900 seconds)
  private cleanupInterval = 60 * 1000; // 1 minute cleanup

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Generate a short-lived request ID
   */
  generateRid(
    telegramId: number,
    intent: string,
    context?: Record<string, any>
  ): string {
    // Generate opaque RID - shorter than login tokens
    const rid = crypto.randomBytes(16).toString('hex');

    const requestId: RequestId = {
      rid,
      telegramId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.ridTTL),
      used: false,
      intent,
      context,
    };

    this.rids.set(rid, requestId);

    console.log(
      `🎫 [RidService] Generated RID for TG ${telegramId} (intent: ${intent}):`,
      rid.substring(0, 8) + '...'
    );

    return rid;
  }

  /**
   * Verify and consume a RID (one-time use)
   */
  verifyAndConsumeRid(rid: string): {
    valid: boolean;
    telegramId?: number;
    intent?: string;
    context?: Record<string, any>;
    error?: string;
  } {
    const requestId = this.rids.get(rid);

    if (!requestId) {
      console.warn(`⚠️ [RidService] RID not found:`, rid.substring(0, 8) + '...');
      return { valid: false, error: 'RID not found' };
    }

    // Check if already used
    if (requestId.used) {
      console.warn(`⚠️ [RidService] RID already used:`, rid.substring(0, 8) + '...');
      return { valid: false, error: 'already_used' };
    }

    // Check if expired
    if (new Date() > requestId.expiresAt) {
      console.warn(`⚠️ [RidService] RID expired:`, rid.substring(0, 8) + '...');
      this.rids.delete(rid);
      return { valid: false, error: 'RID expired' };
    }

    // Mark as used
    requestId.used = true;

    console.log(
      `✅ [RidService] RID verified and consumed for TG ${requestId.telegramId}`
    );

    return {
      valid: true,
      telegramId: requestId.telegramId,
      intent: requestId.intent,
      context: requestId.context,
    };
  }

  /**
   * Get RID info (for debugging)
   */
  getRidInfo(rid: string): RequestId | null {
    return this.rids.get(rid) || null;
  }

  /**
   * Remove expired RIDs periodically
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      let cleaned = 0;

      for (const [rid, requestId] of this.rids.entries()) {
        if (now > requestId.expiresAt && requestId.used) {
          this.rids.delete(rid);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 [RidService] Cleaned up ${cleaned} expired RIDs`);
      }
    }, this.cleanupInterval);
  }

  /**
   * Get RID stats
   */
  getStats(): {
    totalRids: number;
    activeRids: number;
    usedRids: number;
  } {
    let activeRids = 0;
    let usedRids = 0;

    for (const rid of this.rids.values()) {
      if (rid.used) {
        usedRids++;
      } else if (new Date() < rid.expiresAt) {
        activeRids++;
      }
    }

    return {
      totalRids: this.rids.size,
      activeRids,
      usedRids,
    };
  }
}

export const ridService = new RidService();
export default ridService;
