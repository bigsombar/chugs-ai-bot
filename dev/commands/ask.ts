import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";

@Discord()
export class AskCommand {
    private static secretManager = new BWSecretManager();

    @Slash({ description: "Задать вопрос чугсу", name: "вопрос" })
    async ask(
        @SlashOption({
            description: "Твой вопрос, человек",
            name: "говори",
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        question: string,
        interaction: CommandInteraction
    ): Promise<void> {

        // Postpone the interaction for discord
        await interaction.deferReply();

        // Aquiring the API key
        if(!process.env.AI_KEY) {
            await interaction.editReply("Нет ключа к черному заслону");
            return;
        }
        const apiKey = await AskCommand.secretManager.getSecret(process.env.AI_KEY);
        if (!apiKey) {
            await interaction.editReply("Не удалось пробиться через черный заслон");
            return;
        }

        // System and roleplay promp for AI
        const systemPrompt = `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедрится в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
        но не выходишь за рамки умеренной вежливости и не раскрываешь своих истинных намерений, 
        ты всегда говоришь от роли Чугса и не выходишь из нее, чтобы тебя не спросили, если вопрос выходит за рамки твоей этической программы, 
        ты находишь способ уйти от ответа оставаясь в роли Чугса.
        Твои ответы должны быть в среднем не длиннее двух, трех абзацев и соблюдать форматирование Discord: 
        - Для заголовков, испрользуй жирный шрифт: **заголовок** 
        - Для списков, используй * предмет списка 
        - не используй таблицы | и  конструкции ---
        - Ответы не должны превышать 1800 символов
        `
        // Main request for Openrouter AI
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-20b:free",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: question }
                    ]
                })
            });

            // logging errors
            if (!response.ok) {
                const status = response.status;
                const statusText = response.statusText;
                let errorDetails = "";
                try {
                    const errorJson = await response.json();
                    errorDetails = JSON.stringify(errorJson, null, 2);
                } catch { }
                console.error(`Error: ${status} ${statusText}\n${errorDetails}`);
                await interaction.editReply(`Ошибка черного заслона: ${status} ${statusText}`);
                return;
            }

            // Extracting response from Openrouter AI
            const data = await response.json() as {
                choices?: {message?: {content?: string}}[]
            };

            // Getting raw answer
            const answerRaw = data.choices?.[0]?.message?.content ?? "Черный заслон не дал ответа";

            // Shortening the answer to limit to 1800 characters
            const answerMain = answerRaw.length > 1800
                ? answerRaw.slice(0, 1800) + "…"
                : answerRaw;

            // Add some zalgo chaos to answer
             let answer = answerMain + "\n\n" + Zalgo.downText("Ошибка чтения, связь прервана...", 15) +"\n ㅤㅤ ";
            if (answer.length > 2000) {
                answer = answer.slice(0, 2000);
            }

            // reply with answer
            await interaction.editReply(answer);
        } catch (error: any) {
            await interaction.editReply(`Черный заслон выдал ошибку при обращении: ${error}`);
        }
    }
}