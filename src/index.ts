// src/index.ts
// Main entry point for Slyde Telegram Bot

// MUST BE FIRST - Load environment variables before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { startCommandHandler } from './handlers/startHandler.js';
import { helpCommandHandler } from './handlers/helpHandler.js';
import { settingsCommandHandler } from './handlers/settingsHandler.js';
import { callbackQueryHandler } from './handlers/callbackHandler.js';
import { alertsCommandHandler } from './handlers/alertsHandler.js';
import { createLoginServer } from './server.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf<Context>(TELEGRAM_BOT_TOKEN);

console.log('🤖 [Bot] Initializing Slyde Telegram Bot...');

// ============================================
// MIDDLEWARE
// ============================================

// Logging middleware
bot.use((ctx, next) => {
  console.log(`📨 [${new Date().toISOString()}] ${ctx.updateType}:`, {
    from: ctx.from?.username,
    userId: ctx.from?.id,
  });
  return next();
});

// ============================================
// COMMANDS
// ============================================

bot.command('start', startCommandHandler);
bot.command('help', helpCommandHandler);
bot.command('settings', settingsCommandHandler);
bot.command('alerts', alertsCommandHandler);

// ============================================
// CALLBACK QUERIES (Button Presses)
// ============================================

bot.on('callback_query', callbackQueryHandler);

// ============================================
// TEXT MESSAGES
// ============================================

bot.on(message('text'), async (ctx) => {
  console.log(`💬 [Bot] Received message from ${ctx.from.username}: ${ctx.message.text}`);

  // Respond to unknown commands
  if (ctx.message.text.startsWith('/')) {
    await ctx.reply(
      'Unknown command. Type /help to see available commands.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Default response for text
  await ctx.reply(
    'Hi! I\'m the Slyde bot. Use /start to get started or /help for more info.',
    { parse_mode: 'HTML' }
  );
});

// ============================================
// ERROR HANDLING
// ============================================

bot.catch((err, ctx) => {
  console.error('❌ [Bot Error]', {
    error: err,
    from: ctx.from?.username,
    userId: ctx.from?.id,
  });
  ctx.reply('An error occurred. Please try again later.').catch(() => {});
});

// ============================================
// START BOT
// ============================================

const startBot = async () => {
  try {
    // Start web server for login handling
    const serverPort = parseInt(process.env.PORT || '3001', 10);
    createLoginServer(serverPort);

    console.log('✅ [Bot] Starting polling mode...');
    await bot.launch();
    console.log('✅ [Bot] Bot is running!');

    // Enable graceful stop
    process.once('SIGINT', () => {
      console.log('⏹️ [Bot] Stopping bot (SIGINT)...');
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
      console.log('⏹️ [Bot] Stopping bot (SIGTERM)...');
      bot.stop('SIGTERM');
    });
  } catch (err) {
    console.error('❌ [Bot] Failed to start:', err);
    process.exit(1);
  }
};

startBot();

export default bot;
