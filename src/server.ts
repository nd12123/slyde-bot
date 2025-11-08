// src/server.ts
// Web server for handling Telegram login redirects + WebApp miniapp API

import express, { Request, Response } from 'express';
import { tokenService } from './services/tokenService.js';
import { ridService } from './services/ridService.js';
import { verifyTelegramInitData } from './services/telegramValidation.js';
import { auditLog } from './services/auditLog.js';
import { supabaseService } from './services/supabaseService.js';
import {
  createIpRateLimiter,
  createCombinedRateLimiter,
} from './middleware/rateLimit.js';

export function createLoginServer(port: number) {
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Rate limiters for miniapp endpoints
  const authRateLimiter = createCombinedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  });

  const sessionRateLimiter = createIpRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Login endpoint - redirects to app with token (validation happens on app side)
  app.get('/login', (req, res) => {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login Error - Slyde</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Login Failed</h1>
              <p>Missing token parameter.</p>
              <p>Please use /start in Telegram to get a new login link.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Don't validate here - let the app validate via /api/validate-token
    // This prevents double-validation and token consumption

    // If request came through ngrok (HTTPS with ngrok host), stay on ngrok
    // Otherwise use the app URL
    const host = req.get('host') || '';
    const protocol = req.protocol === 'https' ? 'https' : 'http';
    let appUrl = process.env.SLYDE_APP_URL || 'http://localhost:8081';

    // If accessed via ngrok domain, use ngrok URL with the actual app port
    if (host.includes('ngrok')) {
      const ngrokUrl = process.env.SLYDE_LOGIN_URL || 'https://localhost:8081';
      // Remove /login path and use ngrok URL instead
      appUrl = ngrokUrl.replace(/\/$/, ''); // Remove trailing slash if any
    }

    res.redirect(`${appUrl}?token=${token}`);
  });

  // API: Validate token (called by app)
  app.post('/api/validate-token', (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const validation = tokenService.verifyAndConsumeToken(token);

    res.json({
      valid: validation.valid,
      telegramId: validation.telegramId,
      error: validation.error,
    });
  });

  // API: Handshake PIN verification (called by trampoline page)
  // Verifies a claim code hash exists and marks it as verified
  // Returns the plaintext code so trampoline can copy to clipboard
  app.post('/handshake/pin', async (req, res) => {
    const { claimCodeHash } = req.body;

    try {
      console.log(`🔐 [Handshake/PIN] Verify PIN request received`);
      console.log(`  📍 Body: ${JSON.stringify(req.body)}`);

      if (!claimCodeHash) {
        return res.status(400).json({
          ok: false,
          error: 'Missing claimCodeHash',
        });
      }

      // Verify the claim code hash
      const pinVerification = tokenService.verifyPin(claimCodeHash);

      if (!pinVerification.valid) {
        console.warn(`⚠️ [Handshake/PIN] PIN verification failed:`, pinVerification.error);
        return res.status(401).json({
          ok: false,
          error: pinVerification.error || 'PIN verification failed',
        });
      }

      console.log(`✅ [Handshake/PIN] Code verified successfully`);

      // Return the plaintext code so trampoline can copy it to clipboard
      res.json({
        ok: true,
        claimCode: pinVerification.claimCode,
      });
    } catch (err: any) {
      console.error(`❌ [Handshake/PIN] Error:`, err);
      res.status(500).json({
        ok: false,
        error: err.message || 'Internal server error',
      });
    }
  });

  // API: Handshake claim (called by app on login screen)
  // Supports multiple modes:
  // 1. claimCode provided: Use claim code (new method via clipboard)
  // 2. RID provided: Use it directly (legacy, kept for compatibility)
  // 3. telegramId provided: Find latest pending RID for this user (5 minute window)
  // 4. Nothing provided: Find latest pending RID globally (5 minute window, fallback)
  app.post('/handshake/claim', async (req, res) => {
    const { claimCode, rid, telegramId } = req.body;
    const clientIp = req.ip;

    try {
      let claimRid = rid;
      let targetTelegramId: number | undefined;

      console.log(`🤝 [Handshake] Claim request received`);
      console.log(`  📍 Body: ${JSON.stringify(req.body)}`);
      console.log(`  🔑 ClaimCode=${claimCode ? claimCode.substring(0, 4) + '...' : 'none'}, RID=${rid ? rid.substring(0, 8) + '...' : 'none'}, TelegramId=${telegramId || 'none'}`);
      console.log(`  🌐 Client IP=${clientIp}`);

      // Mode 0: Claim code provided (new method)
      if (claimCode) {
        console.log(`🔐 [Handshake] Processing claim code: ${claimCode.substring(0, 4)}...`);
        // Hash the code to find it in storage
        const codeHash = crypto.createHash('sha256').update(claimCode).digest('hex');
        const codeVerification = tokenService.claimCode(codeHash);

        if (!codeVerification.valid || !codeVerification.telegramId) {
          console.log(`❌ [Handshake] Claim code verification failed:`, codeVerification.error);
          return res.status(401).json({
            ok: false,
            error: codeVerification.error || 'Invalid claim code',
          });
        }

        targetTelegramId = codeVerification.telegramId;
        console.log(`✅ [Handshake] Claim code redeemed for TG ${targetTelegramId}`);
      }
      // Mode 1: RID provided directly
      else if (rid) {
        const ridVerification = tokenService.claimPendingRID(rid);

        if (!ridVerification.valid || !ridVerification.telegramId) {
          console.log(`❌ [Handshake] RID verification failed:`, ridVerification.error);
          return res.status(401).json({
            ok: false,
            error: ridVerification.error || 'Invalid RID',
          });
        }

        targetTelegramId = ridVerification.telegramId;
        console.log(`✅ [Handshake] RID claimed for TG ${targetTelegramId}`);
      }
      // Mode 2: telegramId provided - find latest RID for this user
      else if (telegramId) {
        console.log(`🤝 [Handshake] Looking up by telegramId: ${telegramId}`);
        const pendingResult = tokenService.getLatestPendingRID(telegramId);

        if (!pendingResult.rid) {
          console.log(`❌ [Handshake] No pending RID found for TG ${telegramId}`);
          return res.status(404).json({
            ok: false,
            error: pendingResult.error || 'No pending RID found',
          });
        }

        claimRid = pendingResult.rid;
        targetTelegramId = pendingResult.telegramId;

        const ridVerification = tokenService.claimPendingRID(claimRid);

        if (!ridVerification.valid || !ridVerification.telegramId) {
          console.log(`❌ [Handshake] Failed to claim found RID:`, ridVerification.error);
          return res.status(401).json({
            ok: false,
            error: ridVerification.error || 'Failed to claim RID',
          });
        }

        console.log(`✅ [Handshake] Found and claimed RID by telegramId for TG ${targetTelegramId}`);
      }
      // Mode 3: Fallback - find latest RID globally
      else {
        console.log(`🤝 [Handshake] No RID or telegramId, using time-based global lookup`);
        const pendingResult = tokenService.getLatestPendingRID();

        if (!pendingResult.rid) {
          console.log(`❌ [Handshake] No pending RID found globally`);
          return res.status(404).json({
            ok: false,
            error: pendingResult.error || 'No pending RID found',
          });
        }

        claimRid = pendingResult.rid;
        targetTelegramId = pendingResult.telegramId;

        const ridVerification = tokenService.claimPendingRID(claimRid);

        if (!ridVerification.valid || !ridVerification.telegramId) {
          console.log(`❌ [Handshake] Failed to claim found RID:`, ridVerification.error);
          return res.status(401).json({
            ok: false,
            error: ridVerification.error || 'Failed to claim RID',
          });
        }

        console.log(`✅ [Handshake] Found and claimed RID by time window for TG ${targetTelegramId}`);
      }

      if (!targetTelegramId) {
        return res.status(400).json({
          ok: false,
          error: 'Could not determine Telegram ID',
        });
      }

      // Authenticate user with Supabase
      const authResult = await supabaseService.authenticateTelegramUser(targetTelegramId);

      if (!authResult.success) {
        console.error(`❌ [Handshake] Authentication failed:`, authResult.error);
        return res.status(500).json({
          ok: false,
          error: authResult.error || 'Authentication failed',
        });
      }

      console.log(`🔐 [Handshake] Authentication successful for TG ${targetTelegramId}`);

      // Return session and user data
      res.json({
        ok: true,
        user: authResult.user,
        session: authResult.session,
      });
    } catch (err: any) {
      console.error(`❌ [Handshake] Error:`, err);
      res.status(500).json({
        ok: false,
        error: err.message || 'Internal server error',
      });
    }
  });

  // ============================================
  // MINIAPP ENDPOINTS
  // ============================================

  /**
   * 4.1 POST /miniapp/auth/verify
   * Verify Telegram WebApp initData and create miniapp session
   */
  app.post('/miniapp/auth/verify', authRateLimiter.middleware(), (req: Request, res: Response) => {
    const { initData } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      auditLog.log({
        action: 'auth_verify',
        status: 'failed',
        error: 'missing_init_data',
        ip: req.ip,
        user_agent: req.get('user-agent'),
      });
      return res.status(400).json({
        ok: false,
        error: 'missing_init_data',
      });
    }

    // Verify initData signature
    const verification = verifyTelegramInitData(initData, botToken || '');

    if (!verification.valid) {
      auditLog.log({
        action: 'auth_verify',
        status: 'failed',
        error: verification.error || 'invalid_signature',
        ip: req.ip,
        user_agent: req.get('user-agent'),
      });
      return res.status(401).json({
        ok: false,
        error: verification.error || 'invalid_signature',
      });
    }

    // Extract user data
    const user = verification.data?.user;
    if (!user || !user.id) {
      auditLog.log({
        action: 'auth_verify',
        status: 'failed',
        error: 'invalid_user_data',
        ip: req.ip,
        user_agent: req.get('user-agent'),
      });
      return res.status(400).json({
        ok: false,
        error: 'invalid_user_data',
      });
    }

    // Log successful auth
    auditLog.log({
      action: 'auth_verified',
      tg_id: user.id,
      status: 'success',
      context: {
        username: user.username,
        first_name: user.first_name,
      },
      ip: req.ip,
      user_agent: req.get('user-agent'),
    });

    // Return user data and session TTL
    res.json({
      ok: true,
      user: {
        app_user_id: `tg_${user.id}`, // Generate app user ID
        tg_id: user.id,
        username: user.username || `user_${user.id}`,
      },
      session_ttl_sec: 900, // 15 minutes
    });
  });

  /**
   * 4.2 POST /miniapp/session/request-id
   * Generate request ID for handshake (after auth)
   */
  app.post(
    '/miniapp/session/request-id',
    sessionRateLimiter.middleware(),
    (req: Request, res: Response) => {
      const { user, intent } = req.body;

      if (!user || !user.tg_id || !intent) {
        auditLog.log({
          action: 'request_id_generation',
          status: 'failed',
          error: 'missing_params',
          ip: req.ip,
        });
        return res.status(400).json({
          ok: false,
          error: 'missing_user_or_intent',
        });
      }

      // Generate RID
      const rid = ridService.generateRid(user.tg_id, intent, req.body.context);

      auditLog.log({
        action: 'request_id_generated',
        tg_id: user.tg_id,
        status: 'success',
        context: { intent },
        ip: req.ip,
      });

      res.json({
        ok: true,
        rid,
        expires_in: 900, // 15 minutes
      });
    }
  );

  /**
   * 4.3 POST /miniapp/referrals/track
   * Track referral source
   */
  app.post('/miniapp/referrals/track', (req: Request, res: Response) => {
    const { ref, source, tg_user_id } = req.body;

    if (!ref || !source || !tg_user_id) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
      });
    }

    auditLog.log({
      action: 'referral_tracked',
      tg_id: tg_user_id,
      status: 'success',
      context: { ref, source },
      ip: req.ip,
    });

    res.json({ ok: true });
  });

  /**
   * 4.4 POST /miniapp/feedback/submit
   * Submit user feedback
   */
  app.post('/miniapp/feedback/submit', (req: Request, res: Response) => {
    const { category, message, tg_user_id } = req.body;

    if (!category || !message || !tg_user_id) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
      });
    }

    if (!['bug', 'idea', 'other'].includes(category)) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_category',
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        ok: false,
        error: 'message_too_long',
      });
    }

    // Generate ticket ID
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketId = `FBK-${year}-${random}`;

    auditLog.log({
      action: 'feedback_submitted',
      tg_id: tg_user_id,
      status: 'success',
      context: { category, ticket_id: ticketId },
      ip: req.ip,
    });

    res.json({
      ok: true,
      ticket_id: ticketId,
    });
  });

  /**
   * 4.5 GET /miniapp/events/preview
   * Get event preview by ID
   */
  app.get('/miniapp/events/preview', (req: Request, res: Response) => {
    const eventId = req.query.event_id as string;

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        error: 'missing_event_id',
      });
    }

    // Mock event data (in production, fetch from database)
    const mockEvent = {
      id: parseInt(eventId, 10),
      title: 'Slyde Night',
      starts_at: '2025-11-10T20:00:00Z',
      venue: 'Shoreditch, London',
      banner_url: 'https://example.com/banner.jpg',
      attendees_hint: '30+ going',
    };

    auditLog.log({
      action: 'event_preview_viewed',
      status: 'success',
      context: { event_id: eventId },
      ip: req.ip,
    });

    res.json({
      ok: true,
      event: mockEvent,
    });
  });

  /**
   * 4.6 POST /login/handshake/consume
   * Consume RID and establish session (called by native/web app)
   */
  app.post('/login/handshake/consume', (req: Request, res: Response) => {
    const { rid, device } = req.body;

    if (!rid || !device) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
      });
    }

    // Verify and consume RID
    const verification = ridService.verifyAndConsumeRid(rid);

    if (!verification.valid) {
      if (verification.error === 'already_used') {
        auditLog.log({
          action: 'handshake_consume',
          tg_id: verification.telegramId,
          status: 'failed',
          error: 'already_used',
          ip: req.ip,
        });
        return res.status(409).json({
          ok: false,
          error: 'already_used',
        });
      }

      auditLog.log({
        action: 'handshake_consume',
        status: 'failed',
        error: verification.error || 'invalid_rid',
        ip: req.ip,
      });
      return res.status(401).json({
        ok: false,
        error: verification.error || 'invalid_rid',
      });
    }

    // Create session
    const mockSession = {
      access_token: `session_${verification.telegramId}_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
    };

    auditLog.log({
      action: 'handshake_consumed',
      tg_id: verification.telegramId,
      status: 'success',
      context: { device, rid: rid.substring(0, 8) + '...' },
      ip: req.ip,
    });

    res.json({
      ok: true,
      session: mockSession,
    });
  });

  // Debug: Token stats endpoint
  app.get('/debug/tokens', (req, res) => {
    const stats = tokenService.getStats();
    res.json(stats);
  });

  // Debug: RID stats endpoint
  app.get('/debug/rids', (req, res) => {
    const stats = ridService.getStats();
    res.json(stats);
  });

  // Debug: Recent audit logs
  app.get('/debug/audit-logs', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = auditLog.getRecent(limit);
    res.json({ total: logs.length, logs });
  });

  // Debug: Audit logs for user
  app.get('/debug/audit-logs/user/:telegramId', (req, res) => {
    const telegramId = parseInt(req.params.telegramId, 10);
    const limit = parseInt(req.query.limit as string) || 50;

    if (isNaN(telegramId)) {
      return res.status(400).json({ error: 'Invalid telegramId' });
    }

    const logs = auditLog.getForUser(telegramId, limit);
    res.json({ telegramId, total: logs.length, logs });
  });

  // Debug: Generate test token (development only)
  app.post('/debug/generate-test-token', (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) {
      return res.status(400).json({ error: 'Missing telegramId' });
    }

    const token = tokenService.generateLoginToken(telegramId);
    // Use SLYDE_LOGIN_URL for Telegram's inline keyboard (e.g., ngrok URL for HTTPS)
    const slydeLoginUrl = process.env.SLYDE_LOGIN_URL || 'http://localhost:3001/login';
    const loginUrl = `${slydeLoginUrl}?token=${token}`;

    console.log(`🧪 [Debug] Generated test token for TG ${telegramId}`);
    console.log(`📍 [Debug] Login URL: ${loginUrl}`);

    res.json({
      token,
      telegramId,
      loginUrl,
      validationEndpoint: '/api/validate-token',
      authEndpoint: '/functions/v1/auth-telegram',
    });
  });

  // API: Telegram authentication (integrated with Supabase)
  // Handles user creation/authentication and session generation
  app.post('/functions/v1/auth-telegram', async (req, res) => {
    const { telegramId } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'Missing telegramId' });
    }

    console.log(`🔐 [AuthAPI] Authenticating telegram user: ${telegramId}`);

    // Use Supabase service to authenticate/create user
    const authResult = await supabaseService.authenticateTelegramUser(telegramId);

    if (!authResult.success) {
      console.error(`❌ [AuthAPI] Authentication failed:`, authResult.error);
      return res.status(401).json({
        error: authResult.error || 'Authentication failed',
      });
    }

    console.log(`✅ [AuthAPI] User authenticated: ${authResult.user?.username}`);

    res.json({
      session: authResult.session,
      user: authResult.user,
    });
  });

  // Start server
  app.listen(port, () => {
    console.log(`🌐 [Server] Web login server running on port ${port}`);
    console.log(`📍 [Server] Login endpoint: http://localhost:${port}/login?token=...`);
  });

  return app;
}
