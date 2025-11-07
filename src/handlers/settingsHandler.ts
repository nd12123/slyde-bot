// src/handlers/settingsHandler.ts
// Handle /settings command

import { Context } from 'telegraf';

export async function settingsCommandHandler(ctx: Context) {
  try {
    const message = `
<b>⚙️ Settings</b>

Configure your Slyde bot preferences:

<b>Notification Settings:</b>
• Push notifications
• Email notifications
• Frequency (real-time, daily, weekly)

<b>Alert Categories:</b>
• Events
• Music
• Deals
• Updates

<b>Privacy Settings:</b>
• Profile visibility
• Data sharing

Choose an option below to configure:
`;

    await ctx.reply(message, {
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
              text: '👤 Profile',
              callback_data: 'settings_profile',
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
    console.error('❌ [SettingsHandler] Error:', err);
    await ctx.reply('An error occurred. Please try again later.');
  }
}
