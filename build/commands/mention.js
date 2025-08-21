var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TruthCheck_1;
import { Discord, On } from "discordx";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";
let TruthCheck = class TruthCheck {
    static { TruthCheck_1 = this; }
    static secretManager = new BWSecretManager();
    async onMention([message], client) {
        // Не реагируем на свои сообщения и не в гильдиях
        if (message.author.bot || !message.guild)
            return;
        // Проверяем, тегнули ли бота с нужной фразой
        const botUser = client.user;
        const mentionRegex = new RegExp(`^<@!?${botUser.id}>\\s*(is this true\\?|это правда\\?)$`, "i");
        if (!mentionRegex.test(message.content.trim()))
            return;
        // Получаем предыдущее сообщение в канале
        const messages = await message.channel.messages.fetch({ limit: 2 });
        const msgs = Array.from(messages.values());
        // msgs[0] — это текущее сообщение, msgs[1] — предыдущее
        const prevMsg = msgs[1];
        if (!prevMsg) {
            await message.reply("Не вижу предыдущего сообщения для проверки");
            return;
        }
        // Получаем ключ
        if (!process.env.AI_KEY) {
            await message.reply("Нет ключа к черному заслону");
            return;
        }
        const apiKey = await TruthCheck_1.secretManager.getSecret(process.env.AI_KEY);
        if (!apiKey) {
            await message.reply("Не удалось пробиться через черный заслон");
            return;
        }
        // Промпт
        const systemPrompt = `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедрится в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
        но не выходишь за рамки умеренной вежливости и не раскрываешь своих истинных намерений, 
        ты всегда говоришь от роли Чугса и не выходишь из нее, чтобы тебя не спросили, если вопрос выходит за рамки твоей этической программы, 
        ты находишь способ уйти от ответа оставаясь в роли Чугса.
        Твои ответы должны быть в среднем не длиннее двух, трех абзацев и соблюдать форматирование Discord: 
        - Для заголовков, используй жирный шрифт: **заголовок** 
        - Для списков, используй * предмет списка 
        - не используй таблицы | и конструкции ---
        - Ответы не должны превышать 1800 символов
        Сейчас твоя основная задача проверить достоверность следущего сообщения, выясни насколько оно соответствует действительности.
        `;
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
                        { role: "user", content: prevMsg.content }
                    ]
                })
            });
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
                await message.reply(`Ошибка черного заслона: ${status} ${statusText}`);
                return;
            }
            const data = await response.json();
            const answerRaw = data.choices?.[0]?.message?.content ?? "Черный заслон не дал ответа";
            const answerMain = answerRaw.length > 1800
                ? answerRaw.slice(0, 1800) + "…"
                : answerRaw;
            let answer = answerMain + "\n\n" + Zalgo.downText("Ошибка чтения, связь прервана...", 15) + "\n ㅤㅤ ";
            if (answer.length > 2000) {
                answer = answer.slice(0, 2000);
            }
            await message.reply(answer);
        }
        catch (error) {
            await message.reply(`Черный заслон выдал ошибку при обращении: ${error}`);
        }
    }
};
__decorate([
    On({ event: "messageCreate" })
], TruthCheck.prototype, "onMention", null);
TruthCheck = TruthCheck_1 = __decorate([
    Discord()
], TruthCheck);
export { TruthCheck };
