// src/handlers/alertsHandler.ts
// Handle /alerts command and alert management

import { Context } from 'telegraf';

export async function alertsCommandHandler(ctx: Context) {
  try {
    const message = `
<b>🔔 Alert Management</b>

Manage your notifications and alerts:

<b>Quick Actions:</b>
✅ Enable all alerts
❌ Disable all alerts
⚙️ Custom settings

<b>Alert Categories:</b>
🎭 <b>Events</b> - Local events, concerts, shows
🎵 <b>Music</b> - New releases, artist updates
💰 <b>Deals</b> - Special offers & discounts
📢 <b>Updates</b> - Platform news & features

Choose what to do:
`;

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '✅ Enable All',
              callback_data: 'alerts_enable_all',
            },
            {
              text: '❌ Disable All',
              callback_data: 'alerts_disable_all',
            },
          ],
          [
            {
              text: '🎭 Events',
              callback_data: 'alerts_toggle_events',
            },
          ],
          [
            {
              text: '🎵 Music',
              callback_data: 'alerts_toggle_music',
            },
          ],
          [
            {
              text: '💰 Deals',
              callback_data: 'alerts_toggle_deals',
            },
          ],
          [
            {
              text: '📢 Updates',
              callback_data: 'alerts_toggle_updates',
            },
          ],
          [
            {
              text: '⚙️ Advanced Settings',
              callback_data: 'alerts_advanced',
            },
          ],
          [
            {
              text: '← Back',
              callback_data: 'menu_main',
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error('❌ [AlertsHandler] Error:', err);
    await ctx.reply('An error occurred. Please try again later.');
  }
}

// Alert preference types
export interface AlertPreferences {
  events: boolean;
  music: boolean;
  deals: boolean;
  updates: boolean;
  frequency: 'realtime' | 'daily' | 'weekly';
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:mm format
  quiet_hours_end: string;
}

// Default preferences
export const defaultAlertPreferences: AlertPreferences = {
  events: true,
  music: true,
  deals: true,
  updates: true,
  frequency: 'realtime',
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
};
