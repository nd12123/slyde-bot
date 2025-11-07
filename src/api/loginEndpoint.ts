// src/api/loginEndpoint.ts
// API endpoint for Slyde app to validate login tokens

import { tokenService } from '../services/tokenService.js';
import { alertService } from '../services/alertService.js';

/**
 * Validate a login token and return Telegram user info
 * This endpoint is called by the Slyde backend
 *
 * Request:
 * POST /api/telegram/validate-token
 * { token: "abc123..." }
 *
 * Response (200):
 * {
 *   valid: true,
 *   telegramId: 123456,
 *   message: "Token valid and consumed"
 * }
 *
 * Response (400):
 * {
 *   valid: false,
 *   error: "Token expired"
 * }
 */
export async function validateLoginToken(token: string): Promise<{
  valid: boolean;
  telegramId?: number;
  error?: string;
}> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Invalid token format',
    };
  }

  // Verify and consume the token
  const result = tokenService.verifyAndConsumeToken(token);

  if (!result.valid) {
    console.error(`❌ [LoginEndpoint] Token validation failed:`, result.error);
    return result;
  }

  console.log(
    `✅ [LoginEndpoint] Token validated for Telegram user ${result.telegramId}`
  );

  return {
    valid: true,
    telegramId: result.telegramId,
  };
}

/**
 * Link Telegram account with Slyde user
 * This is called after successful login
 *
 * Request:
 * POST /api/telegram/link
 * {
 *   telegramId: 123456,
 *   slydeUserId: "user-uuid",
 *   telegramUsername: "john_doe",
 *   firstName: "John"
 * }
 *
 * Response (200):
 * { success: true, message: "Account linked" }
 *
 * Response (400):
 * { success: false, error: "Already linked" }
 */
export async function linkTelegramAccount(
  telegramId: number,
  slydeUserId: string,
  telegramUsername?: string,
  firstName?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Call the alert service to link the account
    const success = await alertService.linkTelegramUser(
      slydeUserId,
      telegramId,
      telegramUsername
    );

    if (success) {
      console.log(
        `✅ [LoginEndpoint] Linked Telegram ${telegramId} to Slyde ${slydeUserId}`
      );
      return { success: true };
    }

    return {
      success: false,
      error: 'Failed to link account',
    };
  } catch (err: any) {
    console.error('❌ [LoginEndpoint] Linking error:', err);
    return {
      success: false,
      error: err.message || 'Internal server error',
    };
  }
}

/**
 * Get token statistics (for monitoring/debugging)
 *
 * Response:
 * {
 *   totalTokens: 42,
 *   activeTokens: 5,
 *   usedTokens: 37
 * }
 */
export function getTokenStats() {
  return tokenService.getStats();
}
