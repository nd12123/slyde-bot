// src/handlers/helpHandler.ts
// Handle /help command

import { Context } from 'telegraf';

export async function helpCommandHandler(ctx: Context) {
  try {
    const message = `
<b>🤖 Slyde Bot - Help & Commands</b>

<b>Authentication:</b>
/auth - Link your Telegram account to Slyde
/logout - Unlink from Slyde

<b>Alerts & Notifications:</b>
/alerts - Manage your alerts
/subscribe &lt;category&gt; - Subscribe to alerts
/unsubscribe &lt;category&gt; - Unsubscribe from alerts
/status - Check alert status

<b>Account Management:</b>
/settings - View and update settings
/profile - View your profile
/preferences - Manage notification preferences

<b>Help & Info:</b>
/help - Show this message
/about - About Slyde

<b>Categories:</b>
• events - Local event alerts
• music - Music releases & concerts
• deals - Special deals & offers
• updates - Platform updates

<b>Example Usage:</b>
<code>/subscribe events</code> - Get event alerts
<code>/alerts on</code> - Enable all alerts
<code>/alerts off</code> - Disable all alerts

Need more help? Reply to this message or visit our website!
`;

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 Link Account',
              callback_data: 'auth_start',
            },
            {
              text: '🔔 Manage Alerts',
              callback_data: 'alerts_manage',
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error('❌ [HelpHandler] Error:', err);
    await ctx.reply('An error occurred. Please try again later.');
  }
}
