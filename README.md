# Bloxora Discord Bot

Discord bot for Bloxora - maintains presence and registers global commands while Netlify handles interactions.

## Features

- 🤖 Maintains bot online presence
- 📝 Registers global Discord slash commands
- 🎨 Custom status support from workspace settings
- 🔒 Server authorization and whitelist management
- 🩺 Health check endpoint for Railway

## Commands

- `/setgroup [group_id]` - Set active Roblox group for server
- `/setrank [user] [rank]` - Set user's rank in group
- `/promote [user]` - Promote user by one rank
- `/demote [user]` - Demote user by one rank
- `/rank-info [user]` - Get rank information (defaults to yourself)
- `/sync` - Sync Discord roles with Roblox rank
- `/group` - Show connected group information
- `/unlink` - Disconnect group from server (Owner only)
- `/help` - Show help information

## Environment Variables

Required for Railway deployment:

```
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_discord_application_id
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_CLIENT_ID=your_firebase_client_id
FIREBASE_PRIVATE_KEY_ID=your_firebase_private_key_id
```

## Deployment

This bot is designed to run on Railway.app for 24/7 presence while command interactions are handled by Netlify Functions.

## Architecture

- **Railway**: Bot presence and command registration
- **Netlify**: Command interaction handling via webhooks
- **Firebase**: Database and configuration storage
