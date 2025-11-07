// src/services/tokenService.ts
// Secure one-time token generation and validation

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface LoginToken {
  token: string;
  telegramId: number;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export interface PendingRID {
  rid: string;
  telegramId: number;
  createdAt: Date;
  expiresAt: Date;
  claimed: boolean;
  claimedAt?: Date;
  clientIp?: string; // Store client IP for IP-based lookup
}

export interface PendingLogin {
  claimCode: string; // Short 6-8 char code (e.g., "AB7K-39")
  claimCodeHash: string; // SHA256 hash for storage
  telegramId: number;
  createdAt: Date;
  expiresAt: Date;
  pinVerified: boolean; // True when trampoline calls /handshake/pin
  usedAt?: Date; // When app claimed this code
}

class TokenService {
  private tokens: Map<string, LoginToken> = new Map();
  private pendingRIDs: Map<string, PendingRID> = new Map();
  private pendingLogins: Map<string, PendingLogin> = new Map();
  private tokenTTL = 5 * 60 * 1000; // 5 minutes
  private ridTTL = 15 * 60 * 1000; // 15 minutes for handshake
  private claimCodeTTL = 15 * 60 * 1000; // 15 minutes for claim codes
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes cleanup (less aggressive)
  private ridStoragePath: string;

  constructor() {
    // Set up persistent storage path for RIDs
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.ridStoragePath = path.join(__dirname, '../../.rids.json');

    // Load RIDs from file on startup
    this.loadRIDsFromFile();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Load RIDs from persistent storage
   */
  private loadRIDsFromFile(): void {
    try {
      if (fs.existsSync(this.ridStoragePath)) {
        const data = fs.readFileSync(this.ridStoragePath, 'utf-8');
        const rids: Array<[string, PendingRID]> = JSON.parse(data, (key, value) => {
          if (key === 'createdAt' || key === 'expiresAt' || key === 'claimedAt') {
            return new Date(value);
          }
          return value;
        });

        // Restore RIDs from file
        for (const [rid, pendingRID] of rids) {
          this.pendingRIDs.set(rid, pendingRID);
        }

        console.log(`📂 [TokenService] Loaded ${rids.length} RIDs from persistent storage`);
      }
    } catch (err) {
      console.warn(`⚠️ [TokenService] Failed to load RIDs from file:`, err);
    }
  }

  /**
   * Save RIDs to persistent storage
   */
  private saveRIDsToFile(): void {
    try {
      const rids = Array.from(this.pendingRIDs.entries());
      fs.writeFileSync(this.ridStoragePath, JSON.stringify(rids, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`⚠️ [TokenService] Failed to save RIDs to file:`, err);
    }
  }

  /**
   * Generate a secure one-time login token
   */
  generateLoginToken(telegramId: number): string {
    // Generate cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');

    const loginToken: LoginToken = {
      token,
      telegramId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.tokenTTL),
      used: false,
    };

    this.tokens.set(token, loginToken);

    console.log(`🔐 [TokenService] Generated login token for TG ${telegramId}:`, token.substring(0, 8) + '...');

    return token;
  }

  /**
   * Verify and consume a login token
   */
  verifyAndConsumeToken(token: string): {
    valid: boolean;
    telegramId?: number;
    error?: string;
  } {
    const loginToken = this.tokens.get(token);

    if (!loginToken) {
      console.warn(`⚠️ [TokenService] Token not found:`, token.substring(0, 8) + '...');
      return { valid: false, error: 'Token not found' };
    }

    // Check if already used
    if (loginToken.used) {
      console.warn(`⚠️ [TokenService] Token already used:`, token.substring(0, 8) + '...');
      return { valid: false, error: 'Token already used' };
    }

    // Check if expired
    if (new Date() > loginToken.expiresAt) {
      console.warn(`⚠️ [TokenService] Token expired:`, token.substring(0, 8) + '...');
      this.tokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    // Mark as used
    loginToken.used = true;

    console.log(`✅ [TokenService] Token verified for TG ${loginToken.telegramId}`);

    return { valid: true, telegramId: loginToken.telegramId };
  }

  /**
   * Get token info (for debugging)
   */
  getTokenInfo(token: string): LoginToken | null {
    return this.tokens.get(token) || null;
  }

  /**
   * Generate a pending RID (Request ID) for handshake-based auth
   * No token in URL - just a marker that this user is expecting to login
   * Stores client IP for IP-based lookup (Plan B)
   */
  generatePendingRID(telegramId: number, clientIp?: string): string {
    const rid = crypto.randomBytes(16).toString('hex');

    const pendingRID: PendingRID = {
      rid,
      telegramId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.ridTTL),
      claimed: false,
      clientIp, // Store the IP for lookup
    };

    this.pendingRIDs.set(rid, pendingRID);
    this.saveRIDsToFile(); // Persist to disk

    console.log(`📋 [TokenService] Generated pending RID for TG ${telegramId}, IP: ${clientIp || 'unknown'}:`, rid.substring(0, 8) + '...');

    return rid;
  }

  /**
   * Claim a pending RID (called by app when logging in)
   * Returns the telegram ID if RID is valid and not yet claimed
   */
  claimPendingRID(rid: string): {
    valid: boolean;
    telegramId?: number;
    error?: string;
  } {
    const pendingRID = this.pendingRIDs.get(rid);

    if (!pendingRID) {
      console.warn(`⚠️ [TokenService] Pending RID not found:`, rid.substring(0, 8) + '...');
      return { valid: false, error: 'RID not found' };
    }

    // Check if already claimed
    if (pendingRID.claimed) {
      console.warn(`⚠️ [TokenService] RID already claimed:`, rid.substring(0, 8) + '...');
      return { valid: false, error: 'RID already claimed' };
    }

    // Check if expired
    if (new Date() > pendingRID.expiresAt) {
      console.warn(`⚠️ [TokenService] RID expired:`, rid.substring(0, 8) + '...');
      this.pendingRIDs.delete(rid);
      this.saveRIDsToFile(); // Persist deletion
      return { valid: false, error: 'RID expired' };
    }

    // Mark as claimed
    pendingRID.claimed = true;
    pendingRID.claimedAt = new Date();
    this.saveRIDsToFile(); // Persist change

    console.log(`✅ [TokenService] RID claimed for TG ${pendingRID.telegramId}`);

    return { valid: true, telegramId: pendingRID.telegramId };
  }

  /**
   * Get the most recent pending (unclaimed) RID for a telegram user
   * Used when app doesn't have RID but wants to claim one for this user
   */
  getLatestPendingRID(telegramId: number): {
    rid?: string;
    error?: string;
  } {
    let latest: PendingRID | null = null;

    for (const rid of this.pendingRIDs.values()) {
      if (rid.telegramId === telegramId && !rid.claimed && new Date() < rid.expiresAt) {
        if (!latest || rid.createdAt > latest.createdAt) {
          latest = rid;
        }
      }
    }

    if (!latest) {
      return { error: 'No pending RID found' };
    }

    return { rid: latest.rid };
  }

  /**
   * Get the most recent pending RID (Plan B fallback)
   * Used when app has no user context but user just clicked a deep link button
   * Finds RIDs created in the last 5 minutes (generous window for link clicks)
   */
  getLatestPendingRID(): {
    rid?: string;
    telegramId?: number;
    error?: string;
  } {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minute window
    let latest: PendingRID | null = null;

    console.log(`🔍 [TokenService] Searching for pending RID in 5-minute window (${fiveMinutesAgo.toISOString()} to ${now.toISOString()})`);
    console.log(`📊 [TokenService] Total pending RIDs in storage: ${this.pendingRIDs.size}`);

    for (const pending of this.pendingRIDs.values()) {
      const isNotClaimed = !pending.claimed;
      const isWithinWindow = pending.createdAt > fiveMinutesAgo;
      const isNotExpired = now < pending.expiresAt;

      console.log(`  - RID ${pending.rid.substring(0, 8)}... (TG ${pending.telegramId}): claimed=${pending.claimed}, withinWindow=${isWithinWindow}, notExpired=${isNotExpired}, createdAt=${pending.createdAt.toISOString()}`);

      if (isNotClaimed && isWithinWindow && isNotExpired) {
        if (!latest || pending.createdAt > latest.createdAt) {
          latest = pending;
        }
      }
    }

    if (!latest) {
      console.warn(`⚠️ [TokenService] No pending RID found in 5-minute window`);
      return { error: 'No pending RID found (link may have expired)' };
    }

    console.log(`✅ [TokenService] Found latest pending RID: ${latest.rid.substring(0, 8)}... for TG ${latest.telegramId}`);
    return { rid: latest.rid, telegramId: latest.telegramId };
  }

  /**
   * Generate a short claim code (6-8 chars like "AB7K-39") for Telegram login
   * Returns both the code (for display to user) and hash (for storage/security)
   */
  generateClaimCode(telegramId: number): { claimCode: string; claimCodeHash: string } {
    // Generate 6-char code: 4 letters + dash + 2 letters/numbers
    // Example: "AB7K-39"
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let claimCode = '';

    // 4 uppercase letters
    for (let i = 0; i < 4; i++) {
      claimCode += chars[Math.floor(Math.random() * 26)];
    }
    claimCode += '-';

    // 2 alphanumeric
    for (let i = 0; i < 2; i++) {
      claimCode += chars[Math.floor(Math.random() * 36)];
    }

    // Hash the code for storage (don't store plaintext)
    const claimCodeHash = crypto.createHash('sha256').update(claimCode).digest('hex');

    const pendingLogin: PendingLogin = {
      claimCode,
      claimCodeHash,
      telegramId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.claimCodeTTL),
      pinVerified: false,
    };

    this.pendingLogins.set(claimCodeHash, pendingLogin);

    console.log(`🔐 [TokenService] Generated claim code for TG ${telegramId}: ${claimCode.substring(0, 4)}... (expires in ${this.claimCodeTTL / 1000}s)`);

    return { claimCode, claimCodeHash };
  }

  /**
   * Verify PIN from trampoline page
   * Called when trampoline page receives the code and needs to verify it exists
   */
  verifyPin(claimCodeHash: string): {
    valid: boolean;
    claimCode?: string;
    error?: string;
  } {
    const pendingLogin = this.pendingLogins.get(claimCodeHash);

    if (!pendingLogin) {
      console.warn(`⚠️ [TokenService] Claim code hash not found:`, claimCodeHash.substring(0, 8) + '...');
      return { valid: false, error: 'Code not found' };
    }

    // Check if expired
    if (new Date() > pendingLogin.expiresAt) {
      console.warn(`⚠️ [TokenService] Claim code expired:`, claimCodeHash.substring(0, 8) + '...');
      this.pendingLogins.delete(claimCodeHash);
      return { valid: false, error: 'Code expired' };
    }

    // Mark as pinVerified (trampoline confirmed the code)
    pendingLogin.pinVerified = true;

    console.log(`✅ [TokenService] PIN verified for TG ${pendingLogin.telegramId}`);

    return { valid: true, claimCode: pendingLogin.claimCode };
  }

  /**
   * Claim a code (called by app via /handshake/claim)
   * Validates the claim code and returns user/session if valid
   */
  claimCode(claimCodeHash: string): {
    valid: boolean;
    telegramId?: number;
    error?: string;
  } {
    const pendingLogin = this.pendingLogins.get(claimCodeHash);

    if (!pendingLogin) {
      console.warn(`⚠️ [TokenService] Claim code not found:`, claimCodeHash.substring(0, 8) + '...');
      return { valid: false, error: 'Code not found' };
    }

    // Check if already used
    if (pendingLogin.usedAt) {
      console.warn(`⚠️ [TokenService] Claim code already used:`, claimCodeHash.substring(0, 8) + '...');
      return { valid: false, error: 'Code already used' };
    }

    // Check if expired
    if (new Date() > pendingLogin.expiresAt) {
      console.warn(`⚠️ [TokenService] Claim code expired:`, claimCodeHash.substring(0, 8) + '...');
      this.pendingLogins.delete(claimCodeHash);
      return { valid: false, error: 'Code expired' };
    }

    // Check if pinVerified by trampoline
    if (!pendingLogin.pinVerified) {
      console.warn(`⚠️ [TokenService] PIN not verified for code:`, claimCodeHash.substring(0, 8) + '...');
      return { valid: false, error: 'Code not verified' };
    }

    // Mark as used
    pendingLogin.usedAt = new Date();

    console.log(`✅ [TokenService] Claim code redeemed for TG ${pendingLogin.telegramId}`);

    return { valid: true, telegramId: pendingLogin.telegramId };
  }

  /**
   * Remove expired tokens and RIDs periodically
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      let cleaned = 0;

      // Clean up expired/used tokens
      for (const [token, loginToken] of this.tokens.entries()) {
        if (now > loginToken.expiresAt && loginToken.used) {
          this.tokens.delete(token);
          cleaned++;
        }
      }

      // Clean up expired/claimed RIDs
      for (const [rid, pendingRID] of this.pendingRIDs.entries()) {
        const isExpired = now > pendingRID.expiresAt;
        const isClaimed = pendingRID.claimed;

        // Only delete if BOTH expired AND claimed (prevent deleting unclaimed RIDs)
        if (isExpired && isClaimed) {
          console.log(`🧹 [TokenService] Deleting expired claimed RID: ${rid.substring(0, 8)}...`);
          this.pendingRIDs.delete(rid);
          cleaned++;
        }
      }

      // Clean up expired/used claim codes
      for (const [hash, pendingLogin] of this.pendingLogins.entries()) {
        const isExpired = now > pendingLogin.expiresAt;
        const isUsed = pendingLogin.usedAt;

        // Delete if expired (regardless of used status for cleanup)
        if (isExpired) {
          console.log(`🧹 [TokenService] Deleting expired claim code: ${hash.substring(0, 8)}...`);
          this.pendingLogins.delete(hash);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 [TokenService] Cleaned up ${cleaned} expired tokens/RIDs/claim codes`);
        this.saveRIDsToFile(); // Persist cleanup changes
      }
    }, this.cleanupInterval);
  }

  /**
   * Get token stats (for monitoring)
   */
  getStats(): {
    totalTokens: number;
    activeTokens: number;
    usedTokens: number;
  } {
    let activeTokens = 0;
    let usedTokens = 0;

    for (const token of this.tokens.values()) {
      if (token.used) {
        usedTokens++;
      } else if (new Date() < token.expiresAt) {
        activeTokens++;
      }
    }

    return {
      totalTokens: this.tokens.size,
      activeTokens,
      usedTokens,
    };
  }
}

export const tokenService = new TokenService();
export default tokenService;
