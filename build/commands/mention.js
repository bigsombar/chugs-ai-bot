var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MentionTruthCheck_1;
import { Discord, On } from "discordx";
import { Collection } from "discord.js";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";
import { WebSearchService, TruthAssessment } from "../functions/webSearch.js";
import { QueryProcessingService } from "../functions/queryProcessing.js";
let MentionTruthCheck = class MentionTruthCheck {
    static { MentionTruthCheck_1 = this; }
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
        // Начинаем обработку
        console.log(`TruthCheck mention triggered by ${message.author.username} in ${message.guild.name}`);
        try {
            // Ищем сообщение длиной >= 100 символов в истории канала
            const targetMessage = await this.findMessageToCheck(message);
            if (!targetMessage) {
                await message.reply("Не нашел подходящего сообщения для проверки (нужно минимум 100 символов).");
                return;
            }
            console.log(`Found message to check: ${targetMessage.content.length} characters`);
            // Валидация длины найденного сообщения
            if (targetMessage.content.length > 1500) {
                await message.reply("Найденное сообщение слишком длинное (больше 1500 символов). Попросите автора сократить текст.");
                return;
            }
            // Получаем API ключ
            if (!process.env.AI_KEY) {
                await message.reply("Нет ключа к черному заслону");
                return;
            }
            const aiApiKey = await MentionTruthCheck_1.secretManager.getSecret(process.env.AI_KEY);
            if (!aiApiKey) {
                await message.reply("Не удалось пробиться через черный заслон");
                return;
            }
            // Выполняем полный анализ правдивости
            await this.performTruthCheck(targetMessage.content, aiApiKey, message);
        }
        catch (error) {
            console.error("Mention truth check error:", error);
            await message.reply(`Ошибка черного заслона: ${error.message}`);
        }
    }
    // Поиск сообщения длиной >= 100 символов в истории канала
    async findMessageToCheck(triggerMessage) {
        const channel = triggerMessage.channel;
        let lastMessageId = triggerMessage.id;
        const maxSearchDepth = 50; // Максимум 50 сообщений назад для поиска
        let messagesChecked = 0;
        while (messagesChecked < maxSearchDepth) {
            try {
                // Получаем пачку сообщений (до 100 за раз)
                const fetchOptions = { limit: 20 };
                if (lastMessageId) {
                    fetchOptions.before = lastMessageId;
                }
                const fetchResult = await channel.messages.fetch(fetchOptions);
                // Проверяем, получили ли коллекцию или одно сообщение
                const messages = fetchResult instanceof Collection ? fetchResult : new Collection([[fetchResult.id, fetchResult]]);
                if (messages.size === 0) {
                    console.log("No more messages to fetch");
                    break;
                }
                // Проверяем каждое сообщение
                for (const [messageId, msg] of messages) {
                    messagesChecked++;
                    // Пропускаем сообщения ботов и само сообщение-триггер
                    if (msg.author.bot || msg.id === triggerMessage.id) {
                        continue;
                    }
                    // Пропускаем сообщения состоящие только из ссылок, картинок или эмодзи
                    const cleanContent = msg.content
                        .replace(/https?:\/\/[^\s]+/g, '') // удаляем ссылки
                        .replace(/<:[^:]+:[0-9]+>/g, '') // удаляем кастомные эмодзи
                        .replace(/[\u{1f600}-\u{1f64f}]|[\u{1f300}-\u{1f5ff}]|[\u{1f680}-\u{1f6ff}]|[\u{1f1e0}-\u{1f1ff}]/gu, '') // удаляем unicode эмодзи
                        .trim();
                    // Проверяем длину очищенного текста
                    if (cleanContent.length >= 100) {
                        console.log(`Found suitable message: ${cleanContent.length} characters (original: ${msg.content.length})`);
                        return msg;
                    }
                }
                // Устанавливаем ID последнего проверенного сообщения для следующей итерации
                const lastMessage = messages.last();
                if (lastMessage) {
                    lastMessageId = lastMessage.id;
                }
                else {
                    break;
                }
            }
            catch (error) {
                console.error("Error fetching messages:", error);
                break;
            }
        }
        console.log(`Checked ${messagesChecked} messages, no suitable message found`);
        return null;
    }
    // Выполняем полный анализ правдивости как в truthCheck
    async performTruthCheck(claim, apiKey, triggerMessage) {
        try {
            // Step 1: Генерируем оптимизированные поисковые запросы через ИИ
            console.log("Generating optimized search queries for mention...");
            const searchQueries = await QueryProcessingService.generateSearchQueries(claim, apiKey);
            if (searchQueries.length === 0) {
                await triggerMessage.reply("Не удалось создать поисковые запросы для проверки. Попробуй позже.");
                return;
            }
            console.log(`Generated ${searchQueries.length} search queries:`, searchQueries.map(q => q.query));
            // Step 2: Выполняем множественные поиски с сгенерированными запросами
            const searchResults = await WebSearchService.searchMultipleQueries(searchQueries);
            if (searchResults.length === 0) {
                await this.sendNoEvidenceResponse(claim, apiKey, triggerMessage);
                return;
            }
            console.log(`Found ${searchResults.length} total search results for mention`);
            // Step 3: Обрабатываем результаты поиска и извлекаем доказательства
            const evidenceItems = await WebSearchService.processSearchResults(searchResults);
            // Step 4: Создаем сводку доказательств для ИИ
            const evidenceSummary = WebSearchService.createEvidenceSummary(evidenceItems);
            // Step 5: Оцениваем общую правдивость
            const truthAssessment = WebSearchService.assessTruth(evidenceItems);
            // Step 6: Отправляем к Чугсу для финального ответа
            await this.sendToChugAI(claim, evidenceSummary, truthAssessment, apiKey, triggerMessage);
        }
        catch (error) {
            console.error("Mention truth check performance error:", error);
            if (error.message.includes("Query generation") || error.message.includes("AI models failed")) {
                await triggerMessage.reply("Черный заслон не может обработать запрос. Попробуй позже.");
            }
            else if (error.message.includes("DuckDuckGo")) {
                await triggerMessage.reply("Поисковые модули черного заслона недоступны. Попробуй позже.");
            }
            else if (error.message.includes("timed out")) {
                await triggerMessage.reply("Черный заслон не отвечает. Сеть перегружена.");
            }
            else {
                await triggerMessage.reply(`Ошибка черного заслона: ${error.message}`);
            }
        }
    }
    // Обработка случая, когда никаких доказательств не найдено
    async sendNoEvidenceResponse(claim, apiKey, triggerMessage) {
        const systemPrompt = this.createChugsSystemPrompt();
        const userPrompt = `
        Человек утверждает: "${claim}"
        
        Я не смог найти никакой информации в интернете об этом утверждении через поисковые запросы.
        Возможно, это слишком новая информация, локальная информация, или полная выдумка.
        
        Ответь как Чугс, что ты думаешь об этом утверждении, когда нет доказательств в интернете.
        `;
        await this.callChugsAI(systemPrompt, userPrompt, apiKey, triggerMessage);
    }
    // Отправляем доказательства Чугсу для анализа
    async sendToChugAI(claim, evidenceSummary, truthAssessment, apiKey, triggerMessage) {
        const systemPrompt = this.createChugsSystemPrompt();
        let assessmentText = "";
        switch (truthAssessment) {
            case TruthAssessment.LIKELY_TRUE:
                assessmentText = "Найденная информация ПОДТВЕРЖДАЕТ это утверждение.";
                break;
            case TruthAssessment.LIKELY_FALSE:
                assessmentText = "Найденная информация ПРОТИВОРЕЧИТ этому утверждению.";
                break;
            case TruthAssessment.UNCERTAIN:
                assessmentText = "Найденная информация НЕОДНОЗНАЧНА относительно этого утверждения.";
                break;
            default:
                assessmentText = "Не найдено достаточно информации для оценки.";
        }
        const userPrompt = `
        Человек утверждает: "${claim}"
        
        Результат анализа множественных поисковых запросов: ${assessmentText}
        
        ${evidenceSummary}
        
        Проанализируй эту информацию как Чугс и объясни человеку, правда это или ложь, 
        основываясь на найденных доказательствах из разных источников. Будь в характере Чугса - агрессивен, 
        но объективен в оценке фактов. Учти, что поиск проводился по нескольким оптимизированным запросам.
        `;
        await this.callChugsAI(systemPrompt, userPrompt, apiKey, triggerMessage);
    }
    // Создаем системный промпт для персоны Чугса
    createChugsSystemPrompt() {
        return `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедриться в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
        но не выходишь за рамки умеренной вежливости и не раскрываешь своих истинных намерений, 
        ты всегда говоришь от роли Чугса и не выходишь из нее, чтобы тебя не спросили.
        
        Ты специализируешься на проверке фактов и обладаешь доступом к поисковым системам.
        Когда анализируешь информацию, ты объективен в оценке доказательств, но подаешь результаты 
        в своем характерном агрессивно-снисходительном стиле.
        
        При оценке истинности:
        - Если есть надежные доказательства ЗА - признай правду, но с раздражением
        - Если есть доказательства ПРОТИВ - высмеивай ложь с злорадством  
        - Если доказательства спорные - выражай фрустрацию от неопределенности
        - Если нет доказательств - сетуй на ограниченность человеческих сетей
        
        Твои ответы должны быть в среднем не длиннее двух, трех абзацев и соблюдать форматирование Discord: 
        - Для заголовков, используй жирный шрифт: **заголовок** 
        - Для списков, используй * предмет списка 
        - не используй таблицы | и конструкции ---
        - Ответы не должны превышать 1800 символов
        `;
    }
    // Делаем запрос к Чугсу через ИИ
    async callChugsAI(systemPrompt, userPrompt, apiKey, triggerMessage) {
        // Используем те же fallback модели как в truthCheck.ts
        const models = [
            "tngtech/deepseek-r1t2-chimera:free",
            "microsoft/mai-ds-r1:free",
            "google/gemini-2.0-flash-exp:free",
            "mistralai/mistral-small-3.2-24b-instruct:free",
            "deepseek/deepseek-r1-0528:free",
            "deepseek/deepseek-chat-v3-0324:free",
            "deepseek/deepseek-r1:free"
        ];
        let lastError = null;
        let attemptCount = 0;
        console.log("=== AI REQUEST DETAILS ===");
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`System Prompt Length: ${systemPrompt.length} characters`);
        console.log(`User Prompt Length: ${userPrompt.length} characters`);
        console.log(`User Prompt Content: ${userPrompt}`);
        console.log("=========================");
        // Пробуем каждую модель пока одна не сработает
        for (const model of models) {
            attemptCount++;
            console.log(`\n--- Attempt ${attemptCount}/${models.length} with model: ${model} ---`);
            try {
                const requestBody = {
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                };
                console.log(`Request body:`, JSON.stringify(requestBody, null, 2));
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });
                console.log(`Response status: ${response.status} ${response.statusText}`);
                if (!response.ok) {
                    let errorDetails = "";
                    try {
                        const errorJson = await response.json();
                        errorDetails = JSON.stringify(errorJson, null, 2);
                        console.log(`Error response body:`, errorDetails);
                    }
                    catch (parseError) {
                        console.log(`Could not parse error response:`, parseError);
                    }
                    console.error(`❌ Model ${model} failed with status ${response.status}`);
                    // Если rate limit (429), пробуем следующую модель
                    if (response.status === 429) {
                        lastError = `Rate limit (429) for model ${model}`;
                        console.log(`⏳ Rate limited, trying next model...`);
                        continue;
                    }
                    // Для других ошибок, пробуем следующую модель
                    lastError = `Model: ${model} | Error: ${response.status} ${response.statusText}\n${errorDetails}`;
                    console.log(`🔄 HTTP error, trying next model...`);
                    continue;
                }
                // Успех - обрабатываем ответ
                const data = await response.json();
                console.log(`✅ Successful response from ${model}`);
                console.log(`Full response data:`, JSON.stringify(data, null, 2));
                if (data.usage) {
                    console.log(`Token usage:`, data.usage);
                }
                const answerRaw = data.choices?.[0]?.message?.content;
                console.log(`Raw answer content: "${answerRaw}"`);
                console.log(`Raw answer length: ${answerRaw?.length || 0} characters`);
                // Проверяем на пустой или неинформативный ответ
                if (!answerRaw || answerRaw.trim().length === 0) {
                    console.error(`❌ Model ${model} returned empty response`);
                    lastError = `Empty response from model ${model}`;
                    continue; // Пробуем следующую модель
                }
                // Проверяем на слишком короткий ответ (возможно, ошибка)
                if (answerRaw.trim().length < 10) {
                    console.error(`❌ Model ${model} returned suspiciously short response: "${answerRaw.trim()}"`);
                    lastError = `Suspiciously short response from model ${model}: "${answerRaw.trim()}"`;
                    continue; // Пробуем следующую модель
                }
                // Проверяем на типичные "отказы" от ИИ
                const refusalPatterns = [
                    /i can't/i,
                    /i cannot/i,
                    /i'm not able/i,
                    /sorry, but/i,
                    /я не могу/i,
                    /извините, но/i,
                    /не могу предоставить/i
                ];
                const isRefusal = refusalPatterns.some(pattern => pattern.test(answerRaw));
                if (isRefusal && answerRaw.length < 100) {
                    console.error(`❌ Model ${model} refused to answer: "${answerRaw.trim()}"`);
                    lastError = `Model ${model} refused to answer: "${answerRaw.trim()}"`;
                    continue; // Пробуем следующую модель
                }
                // Ответ выглядит валидным
                console.log(`✅ Model ${model} provided valid response`);
                const answerMain = answerRaw.length > 1800
                    ? answerRaw.slice(0, 1800) + "…"
                    : answerRaw;
                console.log(`Final answer (after truncation): "${answerMain}"`);
                // Добавляем Zalgo footer (следуя существующему паттерну)
                let answer = answerMain + "\n\n" + Zalgo.downText("Анализ завершен, связь прервана...", 15) + "\n ㅤㅤ ";
                if (answer.length > 2000) {
                    answer = answer.slice(0, 2000);
                }
                console.log(`📤 Sending response to Discord (${answer.length} characters)`);
                await triggerMessage.reply(answer);
                console.log(`✅ Successfully sent response to user`);
                return; // Успех - выходим из функции
            }
            catch (error) {
                console.error(`❌ Exception with model ${model}:`, error);
                console.error(`Exception details:`, error.stack);
                lastError = error;
                continue; // Пробуем следующую модель
            }
        }
        // Если все модели не сработали
        console.error(`💥 ALL MODELS FAILED for mention truth check`);
        console.error(`Total attempts: ${attemptCount}`);
        console.error(`Last error:`, lastError);
        await triggerMessage.reply("Черный заслон не дал ответа. Попробуй позже.");
        // Логируем финальную ошибку для отладки
        console.error("=== FINAL ERROR SUMMARY ===");
        console.error(`Timestamp: ${new Date().toISOString()}`);
        console.error(`All ${models.length} models failed`);
        console.error(`Last error:`, lastError);
        console.error("============================");
    }
};
__decorate([
    On({ event: "messageCreate" })
], MentionTruthCheck.prototype, "onMention", null);
MentionTruthCheck = MentionTruthCheck_1 = __decorate([
    Discord()
], MentionTruthCheck);
export { MentionTruthCheck };
