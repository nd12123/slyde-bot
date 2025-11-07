// src/middleware/rateLimit.ts
// Rate limiting middleware for miniapp endpoints
// Limits per IP and per Telegram user ID

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key function
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  constructor(private options: RateLimitOptions) {
    const { windowMs } = options;
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.options.keyGenerator
        ? this.options.keyGenerator(req)
        : req.ip || 'unknown';

      const now = Date.now();
      const entry = this.store.get(key);

      // Create or reset entry
      if (!entry || now >= entry.resetAt) {
        this.store.set(key, {
          count: 1,
          resetAt: now + this.options.windowMs,
        });
        return next();
      }

      // Increment count
      entry.count++;

      // Check limit
      if (entry.count > this.options.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        console.warn(
          `⚠️ [RateLimit] Rate limit exceeded for ${key} (${entry.count}/${this.options.maxRequests})`
        );

        return res.status(429).json({
          ok: false,
          error: 'rate_limited',
          retry_after: retryAfter,
        });
      }

      next();
    };
  }

  private cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [RateLimit] Cleaned up ${cleaned} expired entries`);
    }
  }
}

/**
 * Create rate limiter for IP address (default)
 */
export function createIpRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return new RateLimiter({
    ...options,
    keyGenerator: (req) => req.ip || 'unknown',
  });
}

/**
 * Create rate limiter for Telegram user ID
 */
export function createTelegramRateLimiter(
  options: Omit<RateLimitOptions, 'keyGenerator'>
) {
  return new RateLimiter({
    ...options,
    keyGenerator: (req) => {
      const telegramId = (req.body?.user?.id || req.query?.tg_id) as string | undefined;
      return telegramId ? `tg_${telegramId}` : 'unknown';
    },
  });
}

/**
 * Create combined rate limiter (IP + Telegram)
 */
export function createCombinedRateLimiter(
  options: Omit<RateLimitOptions, 'keyGenerator'>
) {
  return new RateLimiter({
    ...options,
    keyGenerator: (req) => {
      const ip = req.ip || 'unknown';
      const telegramId = (req.body?.user?.id || req.query?.tg_id) as string | undefined;
      return telegramId ? `${ip}:tg_${telegramId}` : ip;
    },
  });
}
