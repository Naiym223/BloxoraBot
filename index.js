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
        description: 'The new rank number (1-255)',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 255
      }
    ]
  },
  {
    name: 'promote',
    description: 'Promote a user by one rank in the active Roblox group',
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
    description: 'Demote a user by one rank in the active Roblox group',
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
    description: 'Get rank information for a user in the active Roblox group',
    options: [
      {
        name: 'user',
        description: 'The user to check (optional - defaults to you)',
        type: 6, // USER
        required: false
      }
    ]
  },
  {
    name: 'sync',
    description: 'Sync your Discord roles with your Roblox group rank'
  },
  {
    name: 'group',
    description: 'Display information about the connected Roblox group'
  },
  {
    name: 'unlink',
    description: 'Disconnect the Roblox group from this Discord server (Owner only)'
  },
  {
    name: 'help',
    description: 'Show help information about Bloxora Discord bot commands'
  }
];

// 🔥 Firebase Helper Functions
async function getAdminSettings() {
  try {
    const doc = await db.collection('adminSettings').doc('global').get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('❌ Error fetching admin settings:', error);
    return null;
  }
}

// 🎯 Register Discord Commands Globally
async function registerGlobalCommands() {
  try {
    console.log('📝 Registering global Discord commands...');
    
    const response = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(BLOXORA_COMMANDS)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register commands: ${response.status} ${error}`);
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

    // Check for custom status from primary workspace (Super Admin's workspace)
    // Priority: 1) Super Admin workspace custom status, 2) Admin settings custom status, 3) Default
    try {
      // Find Super Admin user (naiym222@gmail.com)
      const superAdminQuery = await db.collection('users')
        .where('email', '==', 'naiym222@gmail.com')
        .limit(1)
        .get();

      if (!superAdminQuery.empty) {
        const superAdminUser = superAdminQuery.docs[0];
        const superAdminId = superAdminUser.id;

        // Get Super Admin's workspace with custom status
        const workspacesQuery = await db.collection('workspaces')
          .where('owner', '==', superAdminId)
          .limit(1)
          .get();

        if (!workspacesQuery.empty) {
          const workspace = workspacesQuery.docs[0].data();
          const customStatus = workspace.settings?.discordBot?.customStatus;

          if (customStatus?.enabled && customStatus?.text) {
            const typeMap = {
              'PLAYING': ActivityType.Playing,
              'STREAMING': ActivityType.Streaming,
              'LISTENING': ActivityType.Listening,
              'WATCHING': ActivityType.Watching,
              'COMPETING': ActivityType.Competing
            };

            activity = {
              name: customStatus.text,
              type: typeMap[customStatus.type] || ActivityType.Watching
            };

            if (customStatus.type === 'STREAMING' && customStatus.url) {
              activity.url = customStatus.url;
            }

            console.log(`🎨 Using custom status from Super Admin workspace: ${activity.name}`);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not load workspace custom status, using default:', error.message);
    }

    // Fallback: Check admin settings for custom status (legacy support)
    if (activity.name === 'Bloxora Workspaces' && settings.discordBot.customStatus?.enabled && settings.discordBot.customStatus?.text) {
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
      
      console.log(`🎨 Using custom status from admin settings: ${activity.name}`);
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
  console.log(`📊 Serving ${client.guilds.cache.size} Discord servers`);
  
  // Register commands and update presence
  try {
    await registerGlobalCommands();
    await updateBotPresence();
    
    // Update presence every 30 minutes
    setInterval(updateBotPresence, 30 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ Startup error:', error);
  }
});

client.on('guildCreate', async (guild) => {
  console.log(`➕ Joined new server: ${guild.name} (${guild.id})`);
  botStats.serversJoined++;
  
  // Check if server is authorized
  const isAuthorized = await checkServerWhitelist(guild);
  if (!isAuthorized) {
    console.log(`🚫 Leaving unauthorized server: ${guild.name}`);
    try {
      await guild.leave();
    } catch (error) {
      console.error('❌ Error leaving server:', error);
    }
  }
});

client.on('guildDelete', (guild) => {
  console.log(`➖ Left server: ${guild.name} (${guild.id})`);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

// 🩺 Health Check Endpoint for Railway
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: Math.floor((Date.now() - botStats.startTime.getTime()) / 1000),
      servers: client.guilds.cache.size,
      commandsRegistered: botStats.commandsRegistered,
      lastStatusUpdate: botStats.lastStatusUpdate,
      presenceUpdates: botStats.presenceUpdates
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🩺 Health check server running on port ${PORT}`);
});

// 🚀 Start Discord Bot
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});

// 🛑 Graceful Shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  server.close();
  process.exit(0);
});
