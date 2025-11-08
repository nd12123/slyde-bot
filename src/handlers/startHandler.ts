// src/handlers/startHandler.ts
// Handle /start command

import { Context } from 'telegraf';
import { tokenService } from '../services/tokenService.js';

export async function startCommandHandler(ctx: Context) {
  try {
    // RID-based deep link flow implementation
    const telegramUserId = ctx.from?.id;
    const username = ctx.from?.username || 'User';
    const firstName = ctx.from?.first_name || 'Friend';

    if (!telegramUserId) {
      console.log('❌ [StartHandler] No telegram user ID found');
      await ctx.reply('Could not identify your Telegram account. Please try again.');
      return;
    }

    console.log(`👤 [StartHandler] User ${username} (${telegramUserId}) initiated /start`);

    // Generate a short claim code for login (e.g., "AB7K-39")
    // Returns both the code (for display) and hash (for storage)
    const { claimCode } = tokenService.generateClaimCode(telegramUserId);
    console.log(`🔐 [StartHandler] Generated claim code: ${claimCode}`);

    // Also generate a pending RID for fallback time-based lookup
    const pendingRID = tokenService.generatePendingRID(telegramUserId);
    console.log(`📋 [StartHandler] Generated pending RID: ${pendingRID.substring(0, 8)}...`);

    // Generate button URL via Vercel trampoline bridge
    // The trampoline will redirect to Expo Go with the proper deep link
    const trampolineBridge = process.env.EXPO_BRIDGE_URL || 'https://slyde-exp-bridge.vercel.app';
    const lanIp = process.env.EXPO_GO_LAN_IP || '192.168.1.134';
    const lanPort = process.env.EXPO_GO_PORT || '8081';

    // Button URL that Telegram accepts (HTTPS)
    // Parameters: host, port, code (bridge expects 'host' not 'ip')
    const expoAppUrl = `${trampolineBridge}?host=${encodeURIComponent(lanIp)}&port=${encodeURIComponent(lanPort)}&code=${encodeURIComponent(pendingRID)}`;
    console.log(`🔗 [StartHandler] Vercel bridge URL: ${expoAppUrl}`);

    // Log the actual Expo deep link for reference
    const expoDeepLink = `exp://${lanIp}:${lanPort}/--/auth?code=${encodeURIComponent(pendingRID)}`;
    console.log(`🔗 [StartHandler] Expo Go deep link (for Vercel bridge): ${expoDeepLink}`);

    console.log(`📋 [StartHandler] Claim code for TG ${telegramUserId}: ${claimCode}`);
    console.log(`📋 [StartHandler] Pending RID for TG ${telegramUserId}: ${pendingRID.substring(0, 8)}...`);

    const message = `
<b>Welcome to Slyde!</b> 🎉

Hi <b>${firstName}</b>! I'm the Slyde bot. I'll help you:
✨ Connect your Telegram account to Slyde
🔔 Manage alerts and notifications
⚙️ Configure your preferences

<b>Quick Start:</b>
Click the button below to login to Slyde with your Telegram account!

<i>Or use the commands:</i>
<code>/auth</code> - Link your Telegram to Slyde
<code>/alerts</code> - Manage your alerts
<code>/settings</code> - Update preferences
<code>/help</code> - View all commands
`;

    console.log(`📤 [StartHandler] Sending message with keyboard to user ${telegramUserId}`);

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🚀 Open Expo App',
            url: expoAppUrl,
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
    };

    console.log(`🎹 [StartHandler] Keyboard setup:`, JSON.stringify(keyboard));

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    console.log(`✅ [StartHandler] Message sent successfully`);
  } catch (err: any) {
    console.error('❌ [StartHandler] Error:', {
      message: err?.message,
      description: err?.response?.description,
      errorCode: err?.code,
      stack: err?.stack,
    });
    await ctx.reply('An error occurred. Please try again later.');
  }
}
