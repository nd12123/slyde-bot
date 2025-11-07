# Slyde Telegram Bot - Quick Start Guide

## Setup in 5 Minutes

### 1. Get Your Bot Token

1. Open Telegram and search for `@BotFather`
2. Type `/newbot` and follow the instructions
3. Copy your new bot token (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Clone and Install

```bash
cd slyde-tg-bot
npm install
```

### 3. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add:
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_BOT_USERNAME=your_bot_username_here
```

### 4. Run the Bot

```bash
npm run dev
```

You should see:
```
✅ [Bot] Starting polling mode...
✅ [Bot] Bot is running!
```

### 5. Test It!

Search for your bot on Telegram and try:
- `/start` - See the welcome message
- `/help` - View all commands
- `/alerts` - Manage alerts
- Click the buttons!

## Features Implemented

### Commands
- ✅ `/start` - Welcome & quick actions
- ✅ `/help` - Command help
- ✅ `/alerts` - Alert management
- ✅ `/settings` - User preferences

### Alert Management
- ✅ Enable/disable alerts by category
- ✅ Set notification frequency
- ✅ Quiet hours configuration
- ✅ Category filters (events, music, deals, updates)

### Authentication
- ✅ Telegram data validation
- ✅ Hash verification
- ✅ Deep link generation for app login
- ✅ Web link generation for browser

### Interactive Buttons
- ✅ Inline keyboard navigation
- ✅ Callback query handling
- ✅ Multi-level menus

## Next Steps

1. **Integrate with Slyde Backend**
   - Add `SLYDE_API_KEY` to `.env`
   - Backend endpoints will handle user linking and alerts

2. **Deploy to Production**
   - Build: `npm run build`
   - Use webhook mode instead of polling
   - Deploy to your server

3. **Add More Features**
   - Event recommendations
   - User statistics
   - Search functionality
   - Direct messaging

## Troubleshooting

### Bot not responding?
1. Check if token is correct: `TELEGRAM_BOT_TOKEN`
2. Check bot username: `TELEGRAM_BOT_USERNAME`
3. Restart the bot: `npm run dev`

### Commands not working?
1. Make sure bot is running
2. Try `/start` first
3. Check console for errors

### Wrong responses?
1. Clear bot commands cache: `/start` again
2. Check handler logic in `src/handlers/`
3. Look at console logs for debugging

## File Structure

```
src/
├── index.ts                    # Bot initialization & message routing
├── config/config.ts           # Configuration loader
├── handlers/                   # Command & callback handlers
│   ├── startHandler.ts        # /start command
│   ├── helpHandler.ts         # /help command
│   ├── alertsHandler.ts       # /alerts command
│   ├── settingsHandler.ts     # /settings command
│   └── callbackHandler.ts     # Button click handlers
├── services/                   # Business logic
│   ├── authService.ts         # Telegram auth validation
│   └── alertService.ts        # Alert management
└── types/index.ts             # TypeScript types
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | ✅ | Bot username (without @) |
| `SLYDE_API_URL` | ❌ | Slyde backend URL |
| `SLYDE_API_KEY` | ❌ | API key for backend |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | development or production |

## API Endpoints Used

The bot expects these endpoints on the Slyde backend:

```
POST /api/auth/telegram
  - Authenticate & link Telegram user
  - Body: { telegram_id, first_name, username, photo_url }
  - Response: { auth_token, user_id }

GET /api/users/{id}/alert-preferences
  - Get user's alert preferences
  - Response: { events, music, deals, updates, frequency, ... }

PUT /api/users/{id}/alert-preferences
  - Update alert preferences
  - Body: { category, enabled, frequency, ... }

GET /api/users/{id}/alerts
  - Get pending alerts
  - Response: [ { id, title, category, ... } ]
```

## Common Issues

### "TELEGRAM_BOT_TOKEN not set"
Solution: Add token to `.env` file and restart

### "Invalid Telegram authentication data"
Solution: Ensure bot token matches across bot and app

### "Failed to update preferences"
Solution: Check if `SLYDE_API_KEY` is configured

## Need Help?

1. Check the README.md for detailed docs
2. Look at handler files for examples
3. Check TypeScript types in `src/types/`
4. Review Telegraf documentation: https://telegraf.js.org/

Happy coding! 🚀
