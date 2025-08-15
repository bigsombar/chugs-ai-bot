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
        await interaction.deferReply();
        if (!process.env.AI_KEY) {
            await interaction.editReply("Нет ключа к черному заслону");
            return;
        }
        const apiKey = await DescribeCommand_1.secretManager.getSecret(process.env.AI_KEY);
        if (!apiKey) {
            await interaction.editReply("Не удалось пробиться через черный заслон");
            return;
        }
        // System and roleplay prompt
        const prompt = `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедрится в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
        но не выходишь за рамки умеренной вежливости и не раскрываешь своих истинных намерений, 
        ты всегда говоришь от роли Чугса и не выходишь из нее. Описывай изображение в стиле Чугса, не выходя из роли.
        Твой ответ должен быть в среднем не длиннее двух, трех абзацев и соблюдать форматирование Discord: 
        - Для заголовков, используй жирный шрифт: **заголовок** 
        - Для списков, используй * предмет списка 
        - не используй таблицы | и конструкции ---
        - Ответы не должны превышать 1800 символов
        `;
        // Array of fallback models
        const models = [
            {
                model: "google/gemini-2.0-flash-exp:free",
                prompt: prompt
            },
            {
                model: "mistralai/mistral-small-3.2-24b-instruct:free",
                prompt: prompt
            }
            // Add new models here
        ];
        const imageUrl = image.url;
        let lastError = null;
        // Main cycle for model requests
        for (const modelConfig of models) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelConfig.model,
                        messages: [
                            { role: "system", content: modelConfig.prompt },
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
                if (!response.ok) {
                    let errorDetails = "";
                    try {
                        const errorJson = await response.json();
                        errorDetails = JSON.stringify(errorJson, null, 2);
                    }
                    catch { }
                    // Логируем ВСЕ ошибки, включая 429
                    console.error(`Model: ${modelConfig.model} | Status: ${response.status} ${response.statusText}\n${errorDetails}`);
                    // Если 429 — пробуем следующую модель
                    if (response.status === 429) {
                        lastError = `Rate limit (429) for model ${modelConfig.model}`;
                        continue;
                    }
                    // Если другая ошибка — логируем и пробуем следующую
                    lastError = `Model: ${modelConfig.model} | Error: ${response.status} ${response.statusText}\n${errorDetails}`;
                    continue;
                }
                // Успех — обрабатываем ответ
                const data = await response.json();
                const answerRaw = data.choices?.[0]?.message?.content ?? "Черный заслон не дал ответа";
                const answerMain = answerRaw.length > 1800
                    ? answerRaw.slice(0, 1800) + "…"
                    : answerRaw;
                let answer = answerMain + "\n\n" + Zalgo.downText("Ошибка анализа, связь прервана...", 15) + "\n ㅤㅤ ";
                if (answer.length > 2000) {
                    answer = answer.slice(0, 2000);
                }
                // final reply with text and image
                await interaction.editReply({
                    content: answer,
                    files: [image.url]
                });
                return; // Успешно — выходим из функции
            }
            catch (error) {
                lastError = error;
                continue; // Пробуем следующую модель
            }
        }
        // Если все модели не сработали
        await interaction.editReply("Черный заслон не дал ответа. Попробуй позже.");
        if (lastError) {
            console.error("AI fallback error, all models did not respond");
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
