import { dirname, importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { BWSecretManager } from "./functions/bitwarden.js";
// Main bot class that manages the Discord client lifecycle
export class Main {
    static _client;
    static _secretManager = new BWSecretManager();
    static get Client() {
        return this._client;
    }
    static get isDev() {
        return process.env.DEV === "true";
    }
    static async getDevGuildId() {
        if (!process.env.TEST_GUILD_ID) {
            console.log(">> No guild was specified");
            return null;
        }
        const guildId = await this._secretManager.getSecret(process.env.TEST_GUILD_ID);
        console.log(">> Using guild", guildId);
        return guildId;
    }
    static async getDiscordToken() {
        if (!process.env.DISCORD_TOKEN) {
            throw new Error("Could not find BOT_TOKEN ID in your environment");
        }
        const token = await this._secretManager.getSecret(process.env.DISCORD_TOKEN);
        if (!token) {
            throw new Error("Could not retrieve BOT_TOKEN from Bitwarden");
        }
        return token;
    }
    static setupClientEvents() {
        this._client.once("ready", async () => {
            await this._client.initApplicationCommands();
            console.log(">> Bot started");
        });
        this._client.on("interactionCreate", (interaction) => {
            this._client.executeInteraction(interaction);
        });
    }
    static async start() {
        const devGuildId = await this.getDevGuildId();
        this._client = new Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.GuildMembers,
            ],
            botGuilds: this.isDev && devGuildId ? [devGuildId] : undefined,
            silent: false,
        });
        this.setupClientEvents();
        await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);
        await this._client.login(await this.getDiscordToken());
    }
}
void Main.start();
