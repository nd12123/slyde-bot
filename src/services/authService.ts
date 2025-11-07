// src/services/authService.ts
// Service for handling Telegram authentication

import crypto from 'crypto';
import axios from 'axios';
import config from '../config/config.js';

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface AuthToken {
  token: string;
  userId: string;
  expiresAt: Date;
}

class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private botToken: string;

  constructor() {
    this.apiUrl = config.slyde.apiUrl;
    this.apiKey = config.slyde.apiKey;
    this.botToken = config.telegram.botToken;
  }

  /**
   * Validate Telegram login data
   * Ensures data came from Telegram and hasn't been tampered with
   */
  validateTelegramData(data: TelegramAuthData): boolean {
    try {
      // Create data-check-string in alphabetical order (excluding hash)
      const dataKeys = Object.keys(data)
        .filter(key => key !== 'hash')
        .sort();

      const dataCheckString = dataKeys
        .map(key => `${key}=${(data as any)[key]}`)
        .join('\n');

      // Create HMAC SHA-256
      const secretKey = crypto.createHash('sha256').update(this.botToken).digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      const isValid = hash === data.hash;

      if (!isValid) {
        console.error('❌ [AuthService] Invalid Telegram data hash');
      }

      return isValid;
    } catch (err) {
      console.error('❌ [AuthService] Hash validation error:', err);
      return false;
    }
  }

  /**
   * Check if auth data is expired (older than 24 hours)
   */
  isAuthDataExpired(authDate: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 hours
    const isExpired = currentTime - authDate > maxAge;

    if (isExpired) {
      console.warn('⚠️ [AuthService] Telegram auth data is expired');
    }

    return isExpired;
  }

  /**
   * Authenticate user with Telegram data and link to Slyde
   */
  async authenticateWithTelegram(telegramData: TelegramAuthData): Promise<{
    success: boolean;
    authToken?: string;
    slydeUserId?: string;
    error?: string;
  }> {
    try {
      // Validate the data
      if (!this.validateTelegramData(telegramData)) {
        return {
          success: false,
          error: 'Invalid Telegram authentication data',
        };
      }

      // Check expiration
      if (this.isAuthDataExpired(telegramData.auth_date)) {
        return {
          success: false,
          error: 'Authentication data has expired',
        };
      }

      console.log(`🔐 [AuthService] Authenticating Telegram user: ${telegramData.username}`);

      if (!this.apiKey) {
        console.warn('⚠️ [AuthService] No API key configured, creating mock auth');
        return {
          success: true,
          authToken: 'mock_token_' + telegramData.id,
          slydeUserId: 'mock_user_' + telegramData.id,
        };
      }

      // Send to Slyde backend for authentication/linking
      const response = await axios.post(
        `${this.apiUrl}/api/auth/telegram`,
        {
          telegram_id: telegramData.id,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          username: telegramData.username,
          photo_url: telegramData.photo_url,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const { auth_token, user_id } = response.data;

      console.log(`✅ [AuthService] Telegram user authenticated successfully`);

      return {
        success: true,
        authToken: auth_token,
        slydeUserId: user_id,
      };
    } catch (err: any) {
      console.error('❌ [AuthService] Authentication failed:', err.message);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to authenticate with Slyde backend',
      };
    }
  }

  /**
   * Verify auth token with Slyde backend
   */
  async verifyAuthToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    error?: string;
  }> {
    try {
      if (!this.apiKey) {
        // Mock verification
        if (token.startsWith('mock_token_')) {
          const userId = token.replace('mock_token_', 'mock_user_');
          return { valid: true, userId };
        }
        return { valid: false, error: 'Invalid token format' };
      }

      const response = await axios.get(`${this.apiUrl}/api/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return {
        valid: true,
        userId: response.data.user_id,
      };
    } catch (err) {
      console.error('❌ [AuthService] Token verification failed:', err);
      return {
        valid: false,
        error: 'Invalid or expired token',
      };
    }
  }

  /**
   * Generate a deep link for logging in to Slyde app
   */
  generateDeepLink(telegramId: number, authToken: string): string {
    const params = new URLSearchParams({
      telegram_id: telegramId.toString(),
      auth_token: authToken,
    });

    return `slyde://login?${params.toString()}`;
  }

  /**
   * Generate a web link for logging in to Slyde web
   */
  generateWebLink(telegramId: number, authToken: string): string {
    const params = new URLSearchParams({
      telegram_id: telegramId.toString(),
      auth_token: authToken,
    });

    return `https://slyde.app/login/telegram?${params.toString()}`;
  }
}

export const authService = new AuthService();
export default authService;
