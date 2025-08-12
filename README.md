# 🤖 Bloxora Discord Bot

The official Bloxora Discord bot that maintains presence and registers slash commands. This bot works in conjunction with the main Bloxora application.

## 🏗️ Architecture

- **This Bot (Railway)**: Maintains presence, registers commands, handles server joins/leaves
- **Main App (Netlify)**: Processes slash command interactions via webhooks
- **Firebase**: Shared database for settings and user data

## 🚀 Railway Deployment

### 1. Create New Railway Project
1. Go to [Railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Connect this repository

### 2. Environment Variables

Set these in Railway:

```env
# Discord Bot Credentials
DISCORD_BOT_TOKEN=MTExNjY5MDI5NDUyMjU1NzUyMA.GsH8Zg.your_actual_bot_token
DISCORD_APPLICATION_ID=1047909781033193472

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id

# Optional
PORT=3000
```

### 3. Get Firebase Admin Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. **Project Settings** → **Service Accounts**
4. **Generate New Private Key**
5. Copy the values from the downloaded JSON file

## ✅ Features

### 🟢 Bot Presence
- Always appears **online** in Discord
- Custom activity status (syncs with admin panel)
- Updates every 30 seconds

### ⚡ Command Registration
- Registers all slash commands globally
- `/setgroup` - Link Discord server to Roblox group
- `/setrank` - Set user's rank
- `/promote` - Promote user by one rank
- `/demote` - Demote user by one rank
- `/rank-info` - Get user's rank information

### 🛡️ Security Features
- Auto-leaves unauthorized servers
- Whitelist support (including Bloxora Hub)
- Owner verification via linked accounts

### 📊 Monitoring
- Health endpoint: `/health`
- Detailed logging
- Statistics tracking

## 🔄 How Commands Work

1. **User types** `/setrank @user 5` in Discord
2. **Discord sends** interaction to `https://bloxora.com/api/discord/interactions`
3. **Netlify processes** the command and updates Roblox
4. **Discord receives** response with embed
5. **Railway bot** maintains presence throughout

## 🎯 Admin Panel Integration

The bot automatically syncs with your Bloxora admin panel:

- **Enable/Disable**: Respects global bot toggle
- **Custom Activity**: Updates status from admin settings
- **Server Whitelist**: Auto-leaves non-approved servers
- **Security Settings**: Applies rate limits and restrictions

## 📝 Logs

Monitor Railway logs for:
- ✅ Bot startup and initialization
- 🎯 Presence updates
- 🎉 Server joins/leaves
- ⚡ Command registrations
- ❌ Errors and warnings

## 🆘 Troubleshooting

### Bot Not Coming Online
- Check `DISCORD_BOT_TOKEN` is correct
- Verify bot has proper permissions in Discord Developer Portal
- Check Railway logs for errors

### Commands Not Working
- Ensure Netlify has same Discord environment variables
- Check webhook URL: `https://bloxora.com/api/discord/interactions`
- Verify bot permissions in Discord servers

### Custom Activity Not Updating
- Check Firebase credentials are correct
- Verify admin panel settings are saved
- Monitor logs for Firebase connection errors

## 🔗 Related Services

- **Main App**: [Bloxora](https://bloxora.com)
- **Webhook Handler**: `https://bloxora.com/api/discord/interactions`
- **Admin Panel**: `https://bloxora.com/dashboard/super-admin`
