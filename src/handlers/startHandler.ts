// src/handlers/startHandler.ts
// Handle /start command

import { Context } from 'telegraf';
import { tokenService } from '../services/tokenService.js';

export async function startCommandHandler(ctx: Context) {
  try {
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
    const { claimCode, claimCodeHash } = tokenService.generateClaimCode(telegramUserId);
    console.log(`🔐 [StartHandler] Generated claim code: ${claimCode}`);

    // Build trampoline URL that will:
    // 1. Receive the claim code
    // 2. Verify it via /handshake/pin
    // 3. Copy code to clipboard
    // 4. Open clean Expo link
    // Use TRAMPOLINE_URL env var (falls back to localhost for testing)
    const trampolineBase = process.env.TRAMPOLINE_URL || 'http://localhost:3001';
    const trampolineUrl = `${trampolineBase}/open-expo?cc=${encodeURIComponent(claimCodeHash)}`;
    console.log(`🔗 [StartHandler] Trampoline URL: ${trampolineUrl}`);

    // The clean Expo URL (will be opened by trampoline after copying code to clipboard)
    const expoUrl = `https://exp.host/@slyde/slyde`;
    console.log(`🔗 [StartHandler] Expo URL (clean, no params): ${expoUrl}`);
    console.log(`📋 [StartHandler] Claim code for TG ${telegramUserId}: ${claimCode}`);

    // Magic login button goes to trampoline page
    const magicLoginUrl = trampolineUrl;
    // ExpoGo button can go directly to Expo or to trampoline (both work)
    const expoGoUrl = trampolineUrl;

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
            text: '🔗 Magic Login',
            url: magicLoginUrl,
          },
          {
            text: '🚀 Open in Expo Go',
            url: expoGoUrl,
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
