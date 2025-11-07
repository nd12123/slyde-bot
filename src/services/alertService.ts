// src/services/alertService.ts
// Service for managing alerts and notifications

import axios from 'axios';
import config from '../config/config.js';

export interface Alert {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: 'events' | 'music' | 'deals' | 'updates';
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

export interface UserAlertPreferences {
  userId: string;
  events: boolean;
  music: boolean;
  deals: boolean;
  updates: boolean;
  frequency: 'realtime' | 'daily' | 'weekly';
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

class AlertService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = config.slyde.apiUrl;
    this.apiKey = config.slyde.apiKey;
  }

  /**
   * Send alert to user via Telegram
   */
  async sendAlert(telegramUserId: number, alert: Alert): Promise<boolean> {
    try {
      console.log(`📢 [AlertService] Sending alert to user ${telegramUserId}:`, alert.title);

      // Format alert message
      const message = this.formatAlertMessage(alert);

      // In production, send via Telegram bot API
      // For now, just log it
      console.log(`✅ [AlertService] Alert sent: ${message}`);

      return true;
    } catch (err) {
      console.error('❌ [AlertService] Failed to send alert:', err);
      return false;
    }
  }

  /**
   * Get user's alert preferences from Slyde backend
   */
  async getUserAlertPreferences(userId: string): Promise<UserAlertPreferences | null> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ [AlertService] No API key configured, returning default preferences');
        return this.getDefaultPreferences(userId);
      }

      const response = await axios.get(
        `${this.apiUrl}/api/users/${userId}/alert-preferences`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error('❌ [AlertService] Failed to fetch preferences:', err);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update user's alert preferences
   */
  async updateUserAlertPreferences(
    userId: string,
    preferences: Partial<UserAlertPreferences>
  ): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ [AlertService] No API key configured, preferences not saved');
        return false;
      }

      await axios.put(
        `${this.apiUrl}/api/users/${userId}/alert-preferences`,
        preferences,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      console.log(`✅ [AlertService] Preferences updated for user ${userId}`);
      return true;
    } catch (err) {
      console.error('❌ [AlertService] Failed to update preferences:', err);
      return false;
    }
  }

  /**
   * Get pending alerts for user
   */
  async getPendingAlerts(userId: string, limit: number = 10): Promise<Alert[]> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ [AlertService] No API key configured, returning empty alerts');
        return [];
      }

      const response = await axios.get(`${this.apiUrl}/api/users/${userId}/alerts`, {
        params: { limit, read: false },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.data;
    } catch (err) {
      console.error('❌ [AlertService] Failed to fetch alerts:', err);
      return [];
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(userId: string, alertId: string): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      await axios.patch(
        `${this.apiUrl}/api/users/${userId}/alerts/${alertId}`,
        { read: true },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return true;
    } catch (err) {
      console.error('❌ [AlertService] Failed to mark alert as read:', err);
      return false;
    }
  }

  /**
   * Link Telegram user to Slyde user
   */
  async linkTelegramUser(
    slydeUserId: string,
    telegramUserId: number,
    telegramUsername?: string
  ): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ [AlertService] No API key configured, linking not saved');
        return false;
      }

      await axios.post(
        `${this.apiUrl}/api/telegram/link`,
        {
          slyde_user_id: slydeUserId,
          telegram_user_id: telegramUserId,
          telegram_username: telegramUsername,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      console.log(`✅ [AlertService] Linked Telegram ${telegramUserId} to Slyde ${slydeUserId}`);
      return true;
    } catch (err) {
      console.error('❌ [AlertService] Failed to link Telegram user:', err);
      return false;
    }
  }

  /**
   * Format alert for display
   */
  private formatAlertMessage(alert: Alert): string {
    const emoji = this.getCategoryEmoji(alert.category);
    return `${emoji} <b>${alert.title}</b>\n${alert.description || ''}`;
  }

  /**
   * Get emoji for alert category
   */
  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      events: '🎭',
      music: '🎵',
      deals: '💰',
      updates: '📢',
    };
    return emojis[category] || '📬';
  }

  /**
   * Get default alert preferences
   */
  private getDefaultPreferences(userId: string): UserAlertPreferences {
    return {
      userId,
      events: true,
      music: true,
      deals: true,
      updates: true,
      frequency: 'realtime',
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    };
  }
}

export const alertService = new AlertService();
export default alertService;
