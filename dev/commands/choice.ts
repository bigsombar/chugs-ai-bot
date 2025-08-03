import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashChoice, SlashOption } from "discordx";

@Discord()
export class Example {
  @Slash({ description: "choice-test", name: "choice-test" })
  async min(
    @SlashChoice({ name: "alex", value: "alex" })
    @SlashChoice({ name: "mike", value: "mike" })
    @SlashOption({
      description: "input",
      name: "input",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    input: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.reply(`${input}`);
  }
} 