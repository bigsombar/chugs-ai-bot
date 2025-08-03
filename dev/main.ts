import { dirname, importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { getBWSecret } from './functions/bitwarden.js';
import 'dotenv/config';

// Main bot class that manages the Discord client lifecycle
export class Main {
  private static _client: Client; // Single instance of Discord client

  // Getter for accessing the client instance
  static get Client(): Client {
    return this._client;
  }

  // Check if running in development mode
  private static get isDev(): boolean {
    return process.env.DEV === "true";
  }

  // Retrieve test guild ID from Bitwarden
  private static async getDevGuildId(): Promise<string | null> {
    if (!process.env.TEST_GUILD_ID) {
      console.log(">> No guild was specified");
      return null;
    }

    const guildId = await getBWSecret(process.env.TEST_GUILD_ID);
    console.log(">> Using guild", guildId);
    return guildId;
  }

  // Retrieve Discord bot token from Bitwarden (throws if missing)
  private static async getDiscordToken(): Promise<string> {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error("Could not find BOT_TOKEN ID in your environment");
    }

    const token = await getBWSecret(process.env.DISCORD_TOKEN);
    if (!token) {
      throw new Error("Could not retrieve BOT_TOKEN from Bitwarden");
    }

    return token;
  }

  // Configure client event handlers
  private static setupClientEvents(): void {
    // Initialize commands when bot is ready
    this._client.once("ready", async () => {
      await this._client.initApplicationCommands();
      console.log(">> Bot started");
    });

    // Handle all interactions
    this._client.on("interactionCreate", (interaction) => {
      this._client.executeInteraction(interaction);
    });
  }

  // Main initialization method
  static async start(): Promise<void> {
    // Get development guild if configured
    const devGuildId = await this.getDevGuildId();

    // Create Discord client with specified intents
    this._client = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
      ],
      // Register commands only in dev guild during development
      botGuilds: this.isDev && devGuildId ? [devGuildId] : undefined,
      silent: false, // Enable debug logging
    });

    // Set up event listeners
    this.setupClientEvents();

    // Dynamically import all command files
    await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);

    // Authenticate with Discord
    await this._client.login(await this.getDiscordToken());
  }
}

// Start the bot
void Main.start();