# Discord AI Moderation Bot

An advanced AI-powered Discord moderation bot with intelligent risk assessment, CAPTCHA verification, and comprehensive logging via Supabase.

## Features

- **AI-Powered Moderation**: Analyzes messages for spam, scams, harassment, and suspicious behavior
- **Risk Scoring System**: 0-100 risk scoring with SAFE, SUSPICIOUS, and DANGEROUS levels
- **CAPTCHA-First Policy**: New or suspicious users are prompted to verify via CAPTCHA before punishment
- **Supabase Integration**: Complete logging and analytics of all moderation actions
- **Automated Actions**: Delete, warn, mute, timeout, or kick based on risk assessment
- **Account Age Analysis**: Considers Discord account age and server join time
- **Historical Context**: Tracks warnings and previous violations per user

## Setup Instructions

### 1. Prerequisites

- Node.js 18 or higher
- A Discord bot token ([Create one here](https://discord.com/developers/applications))
- A Supabase project ([Create one here](https://supabase.com))

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (found in project settings)

### 4. Discord Bot Permissions

Your bot needs the following permissions:
- Read Messages/View Channels
- Send Messages
- Manage Messages (to delete)
- Timeout Members (to mute)
- Kick Members (for severe violations)

Invite URL format:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099511627830&scope=bot
```

### 5. Run the Bot

```bash
npm start
```

## How It Works

### Message Analysis

When a user sends a message, the bot:
1. Collects message metadata (content, links, attachments, etc.)
2. Retrieves user history from Supabase
3. Sends data to the AI moderation engine
4. Receives a risk assessment with recommended action
5. Executes the action automatically
6. Logs everything to Supabase

### CAPTCHA-First Policy

If a user meets ANY of these criteria:
- Account age < 7 days
- Server join time < 10 minutes
- Has previous warnings
- AND has not verified CAPTCHA

The bot will:
- Restrict messaging temporarily
- Request CAPTCHA verification
- NOT punish the user immediately

### Risk Levels

- **SAFE (0-30)**: Message allowed, no action taken
- **SUSPICIOUS (31-65)**: Warning issued, message may be deleted
- **DANGEROUS (66-100)**: Immediate action (mute, timeout, or kick)

## Database Schema

The bot uses the following Supabase tables:
- `discord_users`: User profiles and CAPTCHA status
- `server_members`: Server-specific membership data
- `messages`: Message metadata (privacy-preserving)
- `moderation_actions`: All moderation decisions with reasoning
- `user_warnings`: Warning history per user

## Security

- All secrets are stored in environment variables
- Message content is hashed, not stored in plaintext
- Row Level Security (RLS) enabled on all tables
- Service role key is never exposed to clients

## Support

For issues or questions, please refer to the code documentation or create an issue in the repository.