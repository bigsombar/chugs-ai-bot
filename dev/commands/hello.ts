import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";

@Discord()
export class HelloCommand { 
    @Slash({
        description: "Поздороваться с искином", 
        name: "привет"})
    async hello(interaction: CommandInteraction): Promise<void> {
        await interaction.reply("Для чего ты потревожил меня, человек? 💢");
    }
}