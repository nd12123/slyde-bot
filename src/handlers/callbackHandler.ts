// src/handlers/callbackHandler.ts
// Handle callback queries (button presses)

import { Context } from 'telegraf';
import { tokenService } from '../services/tokenService.js';
import { alertService } from '../services/alertService.js';

const SLYDE_LOGIN_URL = process.env.SLYDE_LOGIN_URL || 'http://localhost:8081/login';

// In-memory user preferences storage (in production, this would use a database)
const userPreferences: Map<number, any> = new Map();

// Helper function to get user preferences
function getDefaultPreferences() {
  return {
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

// Helper function to check if quiet hours are active
function isInQuietHours(prefs: any): boolean {
  if (!prefs.quiet_hours_enabled) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;

  const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);
  const endTime = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

// Export function to get all preferences (for API use)
export function getUserPreferences(telegramUserId: number) {
  return userPreferences.get(telegramUserId) || getDefaultPreferences();
}

// Export function to update preferences (for API use)
export function updateUserPreferences(telegramUserId: number, updates: any) {
  const current = userPreferences.get(telegramUserId) || getDefaultPreferences();
  const updated = { ...current, ...updates };
  userPreferences.set(telegramUserId, updated);
  return updated;
}

export async function callbackQueryHandler(ctx: Context) {
  try {
    const cbQuery = ctx.callbackQuery as any;
    const data = cbQuery?.data;
    console.log(`🎯 [CallbackHandler] Button pressed: ${data}`);

    if (!data) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    // Route callback based on action
    if (data.startsWith('auth_')) {
      await handleAuthCallbacks(ctx, data);
    } else if (data.startsWith('alerts_')) {
      await handleAlertsCallbacks(ctx, data);
    } else if (data.startsWith('settings_')) {
      await handleSettingsCallbacks(ctx, data);
    } else if (data.startsWith('help_')) {
      await handleHelpCallbacks(ctx, data);
    } else if (data.startsWith('menu_')) {
      await handleMenuCallbacks(ctx, data);
    } else {
      await ctx.answerCbQuery('Unknown action');
    }

    // Answer callback query to remove loading state
    await ctx.answerCbQuery();
  } catch (err) {
    console.error('❌ [CallbackHandler] Error:', err);
    await ctx.answerCbQuery('An error occurred', { show_alert: true });
  }
}

async function handleAuthCallbacks(ctx: Context, data: string) {
  if (data === 'auth_start') {
    const telegramUserId = ctx.from?.id;

    if (!telegramUserId) {
      await ctx.answerCbQuery('Could not identify your account', { show_alert: true });
      return;
    }

    // Generate secure one-time login token
    const loginToken = tokenService.generateLoginToken(telegramUserId);

    // Create login URL with token only (secure!)
    const loginUrl = `${SLYDE_LOGIN_URL}?token=${loginToken}`;

    const message = `
<b>🔗 Link Your Account</b>

To connect your Telegram account to Slyde:

1. Click the button below
2. Complete your profile
3. You'll be logged in instantly!

<b>Benefits of linking:</b>
✅ Fast login with Telegram
✅ Get alerts on Telegram
✅ Manage settings from chat
✅ Never forget your password

Ready to link?
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 Magic Login',
              url: loginUrl,
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
  }
}

async function handleAlertsCallbacks(ctx: Context, data: string) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    await ctx.answerCbQuery('Could not identify your account', { show_alert: true });
    return;
  }

  if (data === 'alerts_manage') {
    // Get current user preferences
    const prefs = userPreferences.get(telegramUserId) || {
      events: true,
      music: true,
      deals: true,
      updates: true,
      frequency: 'realtime',
    };

    const activeCategories = [
      prefs.events ? '✅ Events - Enabled' : '❌ Events - Disabled',
      prefs.music ? '✅ Music - Enabled' : '❌ Music - Disabled',
      prefs.deals ? '✅ Deals - Enabled' : '❌ Deals - Disabled',
      prefs.updates ? '✅ Updates - Enabled' : '❌ Updates - Disabled',
    ].join('\n');

    const allEnabled = prefs.events && prefs.music && prefs.deals && prefs.updates;
    const statusText = allEnabled ? '✅ <b>All Enabled</b>' : '⚠️ <b>Some Disabled</b>';

    const message = `
<b>📋 Your Alerts</b>

<b>Status:</b> ${statusText}

<b>Active Categories:</b>
${activeCategories}

<b>Frequency:</b> ${prefs.frequency === 'realtime' ? 'Real-time' : 'Digest'}

Want to change something?
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: allEnabled ? '❌ Disable All' : '✅ Enable All',
              callback_data: allEnabled ? 'alerts_disable_all' : 'alerts_enable_all',
            },
          ],
          [
            {
              text: prefs.events ? '✅ Events' : '❌ Events',
              callback_data: 'alerts_toggle_events',
            },
            {
              text: prefs.music ? '✅ Music' : '❌ Music',
              callback_data: 'alerts_toggle_music',
            },
          ],
          [
            {
              text: prefs.deals ? '✅ Deals' : '❌ Deals',
              callback_data: 'alerts_toggle_deals',
            },
            {
              text: prefs.updates ? '✅ Updates' : '❌ Updates',
              callback_data: 'alerts_toggle_updates',
            },
          ],
          [
            {
              text: '⚙️ Advanced',
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
  } else if (data === 'alerts_enable_all') {
    const prefs = userPreferences.get(telegramUserId) || {};
    prefs.events = true;
    prefs.music = true;
    prefs.deals = true;
    prefs.updates = true;
    userPreferences.set(telegramUserId, prefs);

    console.log(`✅ [AlertsCallback] Enabled all alerts for user ${telegramUserId}`);

    await ctx.editMessageText('✅ All alerts enabled!', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '← Back',
              callback_data: 'alerts_manage',
            },
          ],
        ],
      },
    });
  } else if (data === 'alerts_disable_all') {
    const prefs = userPreferences.get(telegramUserId) || {};
    prefs.events = false;
    prefs.music = false;
    prefs.deals = false;
    prefs.updates = false;
    userPreferences.set(telegramUserId, prefs);

    console.log(`❌ [AlertsCallback] Disabled all alerts for user ${telegramUserId}`);

    await ctx.editMessageText('❌ All alerts disabled!', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '← Back',
              callback_data: 'alerts_manage',
            },
          ],
        ],
      },
    });
  } else if (data === 'alerts_advanced') {
    const prefs = userPreferences.get(telegramUserId) || {
      frequency: 'realtime',
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    };

    const message = `
<b>⚙️ Advanced Alert Settings</b>

<b>Current Settings:</b>
📊 <b>Frequency:</b> ${prefs.frequency === 'realtime' ? 'Real-time (instant)' : prefs.frequency === 'daily' ? 'Daily digest' : 'Weekly digest'}

🔕 <b>Quiet Hours:</b> ${prefs.quiet_hours_enabled ? `${prefs.quiet_hours_start} - ${prefs.quiet_hours_end}` : 'Off'}

Choose an option to customize:
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📊 Change Frequency',
              callback_data: 'alerts_frequency',
            },
          ],
          [
            {
              text: '🔕 Quiet Hours',
              callback_data: 'alerts_quiet_hours',
            },
          ],
          [
            {
              text: '← Back',
              callback_data: 'alerts_manage',
            },
          ],
        ],
      },
    });
  } else if (data === 'alerts_frequency') {
    const prefs = userPreferences.get(telegramUserId) || { frequency: 'realtime' };
    const currentFreq = prefs.frequency || 'realtime';

    const message = `
<b>📊 Alert Frequency</b>

Choose how often you want to receive alerts:
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: currentFreq === 'realtime' ? '✅ Real-time' : '⭕ Real-time',
              callback_data: 'alerts_freq_realtime',
            },
          ],
          [
            {
              text: currentFreq === 'daily' ? '✅ Daily' : '⭕ Daily',
              callback_data: 'alerts_freq_daily',
            },
          ],
          [
            {
              text: currentFreq === 'weekly' ? '✅ Weekly' : '⭕ Weekly',
              callback_data: 'alerts_freq_weekly',
            },
          ],
          [
            {
              text: '← Back',
              callback_data: 'alerts_advanced',
            },
          ],
        ],
      },
    });
  } else if (data.startsWith('alerts_freq_')) {
    const freq = data.replace('alerts_freq_', '');
    const prefs = userPreferences.get(telegramUserId) || {};
    prefs.frequency = freq;
    userPreferences.set(telegramUserId, prefs);

    console.log(`⚙️ [AlertsCallback] Set frequency to ${freq} for user ${telegramUserId}`);

    const freqLabel =
      freq === 'realtime' ? 'Real-time' : freq === 'daily' ? 'Daily digest' : 'Weekly digest';

    await ctx.editMessageText(`✅ Frequency set to <b>${freqLabel}</b>!`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '← Back',
              callback_data: 'alerts_advanced',
            },
          ],
        ],
      },
    });
  } else if (data === 'alerts_quiet_hours') {
    const prefs = userPreferences.get(telegramUserId) || {
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    };

    const message = `
<b>🔕 Quiet Hours</b>

Set a time range when you don't want notifications:

<b>Current:</b> ${prefs.quiet_hours_enabled ? `${prefs.quiet_hours_start} - ${prefs.quiet_hours_end}` : 'Disabled'}

Choose an option:
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: prefs.quiet_hours_enabled ? '✅ Disable' : '❌ Enable',
              callback_data: 'alerts_quiet_toggle',
            },
          ],
          [
            {
              text: '← Back',
              callback_data: 'alerts_advanced',
            },
          ],
        ],
      },
    });
  } else if (data === 'alerts_quiet_toggle') {
    const prefs = userPreferences.get(telegramUserId) || { quiet_hours_enabled: false };
    prefs.quiet_hours_enabled = !prefs.quiet_hours_enabled;
    userPreferences.set(telegramUserId, prefs);

    console.log(
      `🔕 [AlertsCallback] Quiet hours ${prefs.quiet_hours_enabled ? 'enabled' : 'disabled'} for user ${telegramUserId}`
    );

    const status = prefs.quiet_hours_enabled ? 'enabled' : 'disabled';
    await ctx.editMessageText(`✅ Quiet hours ${status}!`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '← Back',
              callback_data: 'alerts_quiet_hours',
            },
          ],
        ],
      },
    });
  } else if (data.startsWith('alerts_toggle_')) {
    const category = data.replace('alerts_toggle_', '');
    const prefs = userPreferences.get(telegramUserId) || getDefaultPreferences();
    prefs[category] = !prefs[category];
    userPreferences.set(telegramUserId, prefs);

    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    const status = prefs[category] ? 'enabled' : 'disabled';

    console.log(`🔔 [AlertsCallback] Toggled ${category} to ${status} for user ${telegramUserId}`);

    await ctx.editMessageText(`✅ ${categoryName} alerts ${status}!`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '← Back',
              callback_data: 'alerts_manage',
            },
          ],
        ],
      },
    });
  }
}

async function handleSettingsCallbacks(ctx: Context, data: string) {
  if (data === 'settings_open') {
    const message = `
<b>⚙️ Settings</b>

Choose what to configure:
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔔 Notifications',
              callback_data: 'settings_notifications',
            },
          ],
          [
            {
              text: '🏷️ Categories',
              callback_data: 'settings_categories',
            },
          ],
          [
            {
              text: '🔒 Privacy',
              callback_data: 'settings_privacy',
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
  }
}

async function handleHelpCallbacks(ctx: Context, data: string) {
  if (data === 'help_show') {
    const message = `
<b>ℹ️ About Slyde</b>

Slyde is your go-to platform for discovering local events, connecting with artists, and finding amazing opportunities.

<b>Features:</b>
🎭 Discover events & concerts
🎵 Follow your favorite artists
💼 Network with professionals
🎨 Showcase your talent
💰 Find great deals

<b>Need Help?</b>
Use /help to see all commands
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🌐 Visit Website',
              url: 'https://slyde.app',
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
  }
}

async function handleMenuCallbacks(ctx: Context, data: string) {
  if (data === 'menu_main') {
    const message = `
<b>Welcome to Slyde!</b> 🎉

I'm the Slyde bot. I'll help you:
✨ Connect your Telegram account to Slyde
🔔 Manage alerts and notifications
⚙️ Configure your preferences

<b>Quick Actions:</b>
`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 Link Telegram Account',
              callback_data: 'auth_start',
            },
          ],
          [
            {
              text: '🔔 Manage Alerts',
              callback_data: 'alerts_manage',
            },
            {
              text: '⚙️ Settings',
              callback_data: 'settings_open',
            },
          ],
          [
            {
              text: '❓ Help',
              callback_data: 'help_show',
            },
          ],
        ],
      },
    });
  }
}
