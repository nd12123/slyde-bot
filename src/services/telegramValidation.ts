// src/services/telegramValidation.ts
// Telegram WebApp initData HMAC verification
// Validates that initData is legitimately from Telegram

import crypto from 'crypto';

/**
 * Verify Telegram WebApp initData signature using HMAC-SHA256
 * Per Telegram WebApp documentation:
 * https://core.telegram.org/bots/webapps#validating-data-received-from-the-web-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string
): {
  valid: boolean;
  data?: Record<string, any>;
  error?: string;
} {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' };
  }

  try {
    // Parse query string
    const params = new URLSearchParams(initData);

    // Extract hash from params
    const hash = params.get('hash');
    if (!hash) {
      console.warn('⚠️ [TelegramValidation] No hash in initData');
      return { valid: false, error: 'Missing hash' };
    }

    // Remove hash from params for verification
    params.delete('hash');

    // Sort remaining params and build verification string per Telegram docs
    const sortedEntries = Array.from(params.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const dataCheckString = sortedEntries
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create HMAC signature
    // Step 1: Compute secret key - HMAC_SHA256(BotToken, "WebAppData")
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Step 2: Compute hash - HMAC_SHA256(secret, dataCheckString)
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes (constant-time comparison to prevent timing attacks)
    const isValid = timingSafeCompare(hash, computedHash);

    if (!isValid) {
      console.warn(
        `⚠️ [TelegramValidation] Invalid signature for initData`
      );
      return { valid: false, error: 'invalid_signature' };
    }

    // Parse user data
    const userStr = params.get('user');
    let user: any = null;

    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        console.warn('⚠️ [TelegramValidation] Failed to parse user data');
      }
    }

    console.log(
      `✅ [TelegramValidation] Valid initData signature for TG ${user?.id}`
    );

    // Return parsed data
    const data: Record<string, any> = { user };

    // Add other optional fields
    const optionalFields = [
      'auth_date',
      'query_id',
      'start_param',
      'chat_instance',
    ];
    for (const field of optionalFields) {
      const value = params.get(field);
      if (value) {
        data[field] = field === 'auth_date' ? parseInt(value, 10) : value;
      }
    }

    return { valid: true, data };
  } catch (err: any) {
    console.error('❌ [TelegramValidation] Error:', err.message);
    return { valid: false, error: 'Validation error' };
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export default { verifyTelegramInitData };
