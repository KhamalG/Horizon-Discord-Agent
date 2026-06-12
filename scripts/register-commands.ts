#!/usr/bin/env ts-node
/**
 * Registers Lucan's slash commands with Discord.
 *
 * Dev (guild-scoped) — instant propagation:
 *   ts-node scripts/register-commands.ts --env dev
 *
 * Prod (global) — propagates within ~1 hour:
 *   ts-node scripts/register-commands.ts --env prod
 *
 * Required environment variables:
 *   DISCORD_APP_ID_DEV      Application (client) ID for Lucan Dev app
 *   DISCORD_APP_ID_PROD     Application (client) ID for Lucan (prod) app
 *   DISCORD_BOT_TOKEN_DEV   Bot token for Lucan Dev app
 *   DISCORD_BOT_TOKEN_PROD  Bot token for Lucan (prod) app
 *   DISCORD_GUILD_ID_DEV    Guild (server) ID for Horizon Dev (dev registration only)
 */

import { REST, Routes } from 'discord.js';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
if (envIndex === -1 || !args[envIndex + 1]) {
  console.error('Usage: ts-node scripts/register-commands.ts --env dev|prod');
  process.exit(1);
}
const env = args[envIndex + 1];
if (env !== 'dev' && env !== 'prod') {
  console.error('--env must be "dev" or "prod"');
  process.exit(1);
}

// ── Resolve credentials from environment ─────────────────────────────────────

function require_env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const appId = require_env(env === 'dev' ? 'DISCORD_APP_ID_DEV' : 'DISCORD_APP_ID_PROD');
const token = require_env(env === 'dev' ? 'DISCORD_BOT_TOKEN_DEV' : 'DISCORD_BOT_TOKEN_PROD');
if (env === 'dev' && !process.env.DISCORD_GUILD_ID_DEV) {
  console.error('DISCORD_GUILD_ID_DEV is required for dev registration (guild-scoped commands)');
  process.exit(1);
}
const guildId = env === 'dev' ? require_env('DISCORD_GUILD_ID_DEV') : null;

// ── Command definitions ───────────────────────────────────────────────────────

const commands = [
  {
    name: 'analyze',
    description: 'Request a trading analysis from Lucan',
    options: [
      {
        name: 'ticker',
        description: 'Stock ticker symbol (e.g. AAPL)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'depth',
        description: 'Analysis depth — defaults to shallow if omitted',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Shallow (< 5 min)', value: 'shallow' },
          { name: 'Medium (< 10 min) — costs 3× quota', value: 'medium' },
        ],
      },
    ],
  },
  {
    name: 'prep-for-arrival',
    description: '[Admin/Co-Admin only] Provision a private channel for a new member',
    options: [
      {
        name: 'username',
        description: 'Discord username (without #)',
        type: 3, // STRING
        required: true,
      },
    ],
    // Require ADMINISTRATOR bit in Discord's permission check — bot also enforces role check at runtime
    default_member_permissions: '8',
  },
];

// ── Register ──────────────────────────────────────────────────────────────────

async function main() {
  const rest = new REST({ version: '10' }).setToken(token);

  if (env === 'dev' && guildId) {
    console.log(`Registering ${commands.length} commands to guild ${guildId} (dev)...`);
    const data = await rest.put(Routes.applicationGuildCommands(appId, guildId), {
      body: commands,
    });
    const registered = Array.isArray(data) ? data.length : '?';
    console.log(`✅ Successfully registered ${registered} guild commands (instant propagation).`);
  } else {
    console.log(`Registering ${commands.length} commands globally (prod) — may take up to 1 hour...`);
    const data = await rest.put(Routes.applicationCommands(appId), {
      body: commands,
    });
    const registered = Array.isArray(data) ? data.length : '?';
    console.log(`✅ Successfully registered ${registered} global commands.`);
  }
}

main().catch((err) => {
  console.error('Command registration failed:', err);
  process.exit(1);
});
