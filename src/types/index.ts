// src/types/index.ts
// Shared types for the bot

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
}

export interface SlydeUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
}

export interface UserSession {
  telegramUserId: number;
  slydeUserId: string;
  authToken: string;
  linkedAt: Date;
  lastActiveAt: Date;
}

export interface NotificationPreference {
  category: 'events' | 'music' | 'deals' | 'updates';
  enabled: boolean;
  frequency: 'realtime' | 'daily' | 'weekly';
}

export interface BotCommand {
  command: string;
  description: string;
  requires_auth?: boolean;
}

export const BOT_COMMANDS: BotCommand[] = [
  {
    command: 'start',
    description: 'Start using the bot and see available options',
  },
  {
    command: 'help',
    description: 'Show all available commands',
  },
  {
    command: 'alerts',
    description: 'Manage your alert preferences',
  },
  {
    command: 'settings',
    description: 'Configure your preferences',
  },
];

export const ALERT_CATEGORIES = ['events', 'music', 'deals', 'updates'] as const;
export const ALERT_FREQUENCIES = ['realtime', 'daily', 'weekly'] as const;
