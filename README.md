# Slyde Telegram Bot

A Telegram bot for the Slyde platform that enables:
- Quick login with Telegram authentication
- Alert and notification management
- User preference settings
- Integration with the Slyde app

## Features

✅ **Telegram Authentication** - Link your Telegram account to Slyde
🔔 **Alert Management** - Enable/disable alerts by category
⚙️ **Settings** - Configure your preferences and notification frequency
📢 **Notifications** - Receive real-time alerts via Telegram

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Telegram Bot Token (from @BotFather)
- Slyde API credentials (optional, for full integration)

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd slyde-tg-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and add your configuration
```

### Configuration

Create a `.env` file in the root directory:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username_here

# Slyde Backend
SLYDE_API_URL=http://localhost:3000
SLYDE_API_KEY=your_api_key_here

# Server
PORT=3001
NODE_ENV=development
```

### Running the Bot

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## Commands

- `/start` - Welcome message and quick actions
- `/help` - Show all available commands
- `/alerts` - Manage your alerts
- `/settings` - Configure preferences
- `/auth` - Link your Telegram account

## Project Structure

```
src/
├── index.ts                 # Main bot entry point
├── config/
│   └── config.ts           # Configuration management
├── handlers/
│   ├── startHandler.ts     # /start command
│   ├── helpHandler.ts      # /help command
│   ├── alertsHandler.ts    # /alerts command
│   ├── settingsHandler.ts  # /settings command
│   └── callbackHandler.ts  # Button callbacks
└── services/
    ├── authService.ts      # Telegram authentication
    └── alertService.ts     # Alert management
```

## Architecture

### Authentication Flow

1. User clicks "Login with Telegram" on Slyde app
2. Bot validates Telegram data using cryptographic hash
3. User is authenticated and linked to Slyde account
4. Auth token is generated for seamless login

### Alert System

1. User subscribes to alert categories via bot
2. Preferences are stored on Slyde backend
3. When alerts occur, bot sends notifications to user
4. User can manage settings directly from Telegram

## API Integration

The bot integrates with the Slyde backend API for:
- User authentication and linking
- Alert preference management
- Sending real-time notifications
- Storing user data

### Required Endpoints

- `POST /api/auth/telegram` - Authenticate Telegram user
- `GET /api/auth/verify` - Verify auth token
- `GET/PUT /api/users/{id}/alert-preferences` - Manage alert preferences
- `GET /api/users/{id}/alerts` - Fetch pending alerts
- `POST /api/telegram/link` - Link Telegram to Slyde account

## Development

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Troubleshooting

### Bot not responding
- Check if `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is running: `npm run dev`
- Check logs for errors

### Auth failing
- Ensure `TELEGRAM_BOT_TOKEN` is the same across app and bot
- Check if Slyde API is reachable
- Verify `SLYDE_API_KEY` is configured

### Alerts not received
- Check user's alert preferences via `/alerts`
- Verify Slyde backend is sending notifications
- Check bot has permission to send messages

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT

## Support

For issues or questions:
- Create an issue on GitHub
- Contact: support@slyde.app
