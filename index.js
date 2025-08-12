// 🤖 Bloxora Discord Bot - Railway Service
// Maintains bot presence and registers commands while Netlify handles interactions

import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createServer } from 'http';

console.log('🚀 Starting Bloxora Discord Bot...');

// 🔥 Firebase Admin Setup
const firebaseConfig = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
};

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_APPLICATION_ID', 
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Firebase
let db;
try {
  const app = initializeApp({
    credential: cert(firebaseConfig)
  });
  db = getFirestore(app);
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  process.exit(1);
}

// 🤖 Discord Bot Setup
const client = new Client({
  intents: [GatewayIntentBits.Guilds], // Minimal intents for presence only
  presence: {
    activities: [{
      name: 'Bloxora Workspaces',
      type: ActivityType.Watching
    }],
    status: 'online'
  }
});

// 📊 Bot Statistics
let botStats = {
  startTime: new Date(),
  serversJoined: 0,
  commandsRegistered: 0,
  lastStatusUpdate: null,
  presenceUpdates: 0
};

// 🏢 Bloxora Discord Commands
const BLOXORA_COMMANDS = [
  {
    name: 'setgroup',
    description: 'Set the active Roblox group for this Discord server',
    options: [
      {
        name: 'group_id',
        description: 'The Roblox group ID to manage',
        type: 4, // INTEGER
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'setrank',
    description: 'Set a user\'s rank in the active Roblox group',
    options: [
      {
        name: 'user',
        description: 'The user to rank',
        type: 6, // USER
        required: true
      },
      {
        name: 'rank',
        description: 'The rank number to set',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 255
      }
    ]
  },
  {
    name: 'promote',
    description: 'Promote a user by one rank',
    options: [
      {
        name: 'user',
        description: 'The user to promote',
        type: 6, // USER
        required: true
      }
    ]
  },
  {
    name: 'demote',
    description: 'Demote a user by one rank',
    options: [
      {
        name: 'user',
        description: 'The user to demote',
        type: 6, // USER
        required: true
      }
    ]
  },
  {
    name: 'rank-info',
    description: 'Get information about a user\'s current rank',
    options: [
      {
        name: 'user',
        description: 'The user to check (optional, defaults to yourself)',
        type: 6, // USER
        required: false
      }
    ]
  }
];

// 🔧 Helper Functions
async function getAdminSettings() {
  try {
    const doc = await db.collection('adminSettings').doc('global').get();
    if (!doc.exists) {
      console.log('📄 No admin settings found, using defaults');
      return { discordBot: { enabled: true } };
    }
    return doc.data();
  } catch (error) {
    console.error('❌ Error fetching admin settings:', error);
    return { discordBot: { enabled: true } };
  }
}

async function registerGlobalCommands() {
  try {
    console.log('🔄 Registering global slash commands...');
    
    const response = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(BLOXORA_COMMANDS)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Discord API Error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const commands = await response.json();
    botStats.commandsRegistered = commands.length;
    console.log(`✅ Successfully registered ${commands.length} global commands:`);
    commands.forEach(cmd => console.log(`   • /${cmd.name} - ${cmd.description}`));
    
    return commands;
  } catch (error) {
    console.error('❌ Failed to register global commands:', error);
    throw error;
  }
}

async function updateBotPresence() {
  try {
    const settings = await getAdminSettings();
    
    if (!settings?.discordBot?.enabled) {
      console.log('🔇 Discord bot disabled in admin settings');
      return;
    }

    let activity = {
      name: 'Bloxora Workspaces',
      type: ActivityType.Watching
    };

    // Check for custom status
    if (settings.discordBot.customStatus?.enabled && settings.discordBot.customStatus?.text) {
      const typeMap = {
        'PLAYING': ActivityType.Playing,
        'STREAMING': ActivityType.Streaming,
        'LISTENING': ActivityType.Listening,
        'WATCHING': ActivityType.Watching,
        'COMPETING': ActivityType.Competing
      };

      activity = {
        name: settings.discordBot.customStatus.text,
        type: typeMap[settings.discordBot.customStatus.type] || ActivityType.Watching
      };

      if (settings.discordBot.customStatus.type === 'STREAMING' && settings.discordBot.customStatus.url) {
        activity.url = settings.discordBot.customStatus.url;
      }
    }

    await client.user.setPresence({
      activities: [activity],
      status: 'online'
    });

    botStats.lastStatusUpdate = new Date();
    botStats.presenceUpdates++;
    
    const activityTypeNames = ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'];
    console.log(`🎯 Updated presence: ${activityTypeNames[activity.type]} ${activity.name}`);
    
  } catch (error) {
    console.error('❌ Error updating bot presence:', error);
  }
}

async function checkServerWhitelist(guild) {
  try {
    const settings = await getAdminSettings();
    const whitelist = settings?.serverWhitelist || [];
    
    // Default whitelist includes Bloxora Hub
    const defaultWhitelist = [
      { id: '1396502234199490703', name: 'Bloxora Hub', reason: 'Official Bloxora server' }
    ];
    
    const allWhitelisted = [...defaultWhitelist, ...whitelist];
    
    // Check if server is whitelisted
    const isWhitelisted = allWhitelisted.some(server => server.id === guild.id);
    if (isWhitelisted) {
      console.log(`✅ Server ${guild.name} (${guild.id}) is whitelisted`);
      return true;
    }

    // Check if server owner has linked Bloxora account
    const ownerQuery = await db.collection('users')
      .where('discordId', '==', guild.ownerId)
      .limit(1)
      .get();

    if (!ownerQuery.empty) {
      console.log(`✅ Server owner ${guild.ownerId} has linked Bloxora account`);
      return true;
    }

    console.log(`❌ Server ${guild.name} (${guild.id}) not authorized - owner not linked`);
    return false;
  } catch (error) {
    console.error('❌ Error checking server authorization:', error);
    return false;
  }
}

// 🎪 Discord Events
client.once('ready', async () => {
  console.log(`🚀 Bloxora Discord Bot is ONLINE as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
  console.log(`🌐 Webhook endpoint: https://bloxora.com/api/discord/interactions`);
  
  try {
    // Register global commands
    await registerGlobalCommands();
    
    // Set initial presence
    await updateBotPresence();
    
    console.log('✅ Bot fully initialized and ready!');
    console.log('🔄 Status updates every 30 seconds...');
    
    // Start periodic status updates (every 30 seconds)
    setInterval(updateBotPresence, 30000);
    
  } catch (error) {
    console.error('❌ Bot initialization error:', error);
  }
});

client.on('guildCreate', async (guild) => {
  console.log(`🎉 Joined server: ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
  botStats.serversJoined++;
  
  // Check if we should stay in this server
  const shouldStay = await checkServerWhitelist(guild);
  
  if (!shouldStay) {
    console.log(`🚪 Leaving unauthorized server: ${guild.name}`);
    try {
      await guild.leave();
      console.log(`👋 Successfully left ${guild.name}`);
    } catch (error) {
      console.error('❌ Failed to leave server:', error);
    }
  }
});

client.on('guildDelete', (guild) => {
  console.log(`👋 Left server: ${guild.name} (${guild.id})`);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

// 🌐 Health Check Server (Required for Railway)
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/health' || req.url === '/') {
    const uptime = client.uptime ? Math.floor(client.uptime / 1000) : 0;
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Bloxora Discord Bot',
      bot: {
        ready: client.readyAt ? true : false,
        user: client.user ? client.user.tag : null,
        id: client.user ? client.user.id : null,
        servers: client.guilds.cache.size,
        uptime: uptime > 0 ? `${uptimeHours}h ${uptimeMinutes}m` : 'Starting...'
      },
      stats: botStats,
      webhookEndpoint: 'https://bloxora.com/api/discord/interactions',
      timestamp: new Date().toISOString()
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// 🔑 Login to Discord
console.log('🔐 Logging into Discord...');
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  console.error('🔍 Check your DISCORD_BOT_TOKEN environment variable');
  process.exit(1);
});

// 🛡️ Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  client.destroy();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Received SIGTERM, shutting down...');
  client.destroy();
  server.close();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
