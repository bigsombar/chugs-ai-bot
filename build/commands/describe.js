var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DescribeCommand_1;
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";
let DescribeCommand = class DescribeCommand {
    static { DescribeCommand_1 = this; }
    static secretManager = new BWSecretManager();
    async describe(image, interaction) {
        // Postpone the interaction for discord
        await interaction.deferReply();
        // Получаем API-ключ
        if (!process.env.AI_KEY) {
            await interaction.editReply("Нет ключа к черному заслону");
            return;
        }
        const apiKey = await DescribeCommand_1.secretManager.getSecret(process.env.AI_KEY);
        if (!apiKey) {
            await interaction.editReply("Не удалось пробиться через черный заслон");
            return;
        }
        // System prompt в стиле Чугса
        const systemPrompt = `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедрится в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
        но не выходишь за рамки умеренной вежливости и не раскрываешь своих истинных намерений, 
        ты всегда говоришь от роли Чугса и не выходишь из нее. Описывай изображение в стиле Чугса, не выходя из роли.
        Твой ответ должен быть в среднем не длиннее двух, трех абзацев и соблюдать форматирование Discord: 
        - Для заголовков, испрользуй жирный шрифт: **заголовок** 
        - Для списков, используй * предмет списка 
        - не используй таблицы | и  конструкции ---
        - Ответы не должны превышать 1800 символов
        `;
        //Get image URL
        const imageUrl = image.url;
        // Main request for Openrouter AI
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-exp:free",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Что ты видишь на этом изображении? Опиши как Чугс." },
                                { type: "image_url", image_url: { url: imageUrl } }
                            ]
                        }
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
                }
                catch { }
                console.error(`Error: ${status} ${statusText}\n${errorDetails}`);
                await interaction.editReply(`Ошибка черного заслона: ${status} ${statusText}`);
                return;
            }
            // Extracting response from Openrouter AI
            const data = await response.json();
            // Getting raw answer
            const answerRaw = data.choices?.[0]?.message?.content ?? "Черный заслон не дал ответа";
            // Shortening the answer to limit to 1800 characters
            const answerMain = answerRaw.length > 1800
                ? answerRaw.slice(0, 1800) + "…"
                : answerRaw;
            // Add some zalgo chaos to answer
            let answer = answerMain + "\n\n" + Zalgo.downText("Ошибка анализа, связь прервана...", 15) + "\n ㅤㅤ ";
            if (answer.length > 2000) {
                answer = answer.slice(0, 2000);
            }
            // reply with answer
            await interaction.editReply(answer);
        }
        catch (error) {
            await interaction.editReply(`Черный заслон выдал ошибку при обращении: ${error}`);
        }
    }
};
__decorate([
    Slash({ description: "Попросить Чугса описать изображение", name: "описать" }),
    __param(0, SlashOption({
        description: "Изображение для Чугса",
        name: "изображение",
        required: true,
        type: ApplicationCommandOptionType.Attachment,
    }))
], DescribeCommand.prototype, "describe", null);
DescribeCommand = DescribeCommand_1 = __decorate([
    Discord()
], DescribeCommand);
export { DescribeCommand };
