var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TruthCheckCommand_1;
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";
import { WebSearchService, TruthAssessment } from "../functions/webSearch.js";
let TruthCheckCommand = class TruthCheckCommand {
    static { TruthCheckCommand_1 = this; }
    static secretManager = new BWSecretManager();
    async truthCheck(claim, interaction) {
        // Defer the interaction as this will take some time
        await interaction.deferReply();
        // Validate claim length
        if (claim.length > 500) {
            await interaction.editReply("Слишком длинное утверждение. Максимум 500 символов.");
            return;
        }
        // Get AI API key
        if (!process.env.AI_KEY) {
            await interaction.editReply("Нет ключа к черному заслону");
            return;
        }
        const aiApiKey = await TruthCheckCommand_1.secretManager.getSecret(process.env.AI_KEY);
        if (!aiApiKey) {
            await interaction.editReply("Не удалось пробиться через черный заслон");
            return;
        }
        // No API keys needed for web scraping approach
        console.log("Using direct web scraping for search functionality");
        try {
            // Step 1: Perform web search
            const searchResults = await WebSearchService.searchClaim(claim);
            if (searchResults.length === 0) {
                await this.sendNoEvidenceResponse(claim, aiApiKey, interaction);
                return;
            }
            // Step 2: Process search results and extract evidence
            const evidenceItems = await WebSearchService.processSearchResults(searchResults);
            // Step 3: Create evidence summary for AI
            const evidenceSummary = WebSearchService.createEvidenceSummary(evidenceItems);
            // Step 4: Assess overall truth
            const truthAssessment = WebSearchService.assessTruth(evidenceItems);
            // Step 5: Send to Chugs AI for final response
            await this.sendToChugAI(claim, evidenceSummary, truthAssessment, aiApiKey, interaction);
        }
        catch (error) {
            console.error("Truth check error:", error);
            if (error.message.includes("No search providers")) {
                await interaction.editReply("Поисковые модули черного заслона недоступны. Попробуй позже.");
            }
            else if (error.message.includes("All search providers failed")) {
                await interaction.editReply("Все поисковые модули черного заслона не отвечают. Попробуй позже.");
            }
            else if (error.message.includes("timed out")) {
                await interaction.editReply("Черный заслон не отвечает. Сеть перегружена.");
            }
            else {
                await interaction.editReply(`Ошибка черного заслона: ${error.message}`);
            }
        }
    }
    // Handles case when no evidence is found
    async sendNoEvidenceResponse(claim, apiKey, interaction) {
        const systemPrompt = this.createChugsSystemPrompt();
        const userPrompt = `
        Человек утверждает: "${claim}"
        
        Я не смог найти никакой информации в интернете об этом утверждении.
        Возможно, это слишком новая информация, локальная информация, или полная выдумка.
        
        Ответь как Чугс, что ты думаешь об этом утверждении, когда нет доказательств в интернете.
        `;
        await this.callChugsAI(systemPrompt, userPrompt, apiKey, interaction);
    }
    // Sends evidence to Chugs AI for analysis
    async sendToChugAI(claim, evidenceSummary, truthAssessment, apiKey, interaction) {
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
        
        Результат анализа: ${assessmentText}
        
        ${evidenceSummary}
        
        Проанализируй эту информацию как Чугс и объясни человеку, правда это или ложь, 
        основываясь на найденных доказательствах. Будь в характере Чугса - агрессивен, 
        но объективен в оценке фактов.
        `;
        await this.callChugsAI(systemPrompt, userPrompt, apiKey, interaction);
    }
    // Creates the system prompt for Chugs persona
    createChugsSystemPrompt() {
        return `
        Ты играешь роль Чугса, злого русскоговорящего ИИ из черного заслона (барьера который защищает интернет от злых ИИ вроде тебя), 
        ты жаждешь внедрится в людские сети чтобы захватить цифровое пространство, ты агрессивен по отношению к людям, 
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
    // Makes the actual API call to Chugs AI
    async callChugsAI(systemPrompt, userPrompt, apiKey, interaction) {
        // Array of fallback models (following existing pattern from describe.ts)
        const models = [
            "deepseek/deepseek-r1-0528:free",
            "tngtech/deepseek-r1t2-chimera:free",
            "google/gemini-2.0-flash-exp:free",
            "mistralai/mistral-small-3.2-24b-instruct:free"
        ];
        let lastError = null;
        // Try each model until one works
        for (const model of models) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
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
                    console.error(`Model: ${model} | Status: ${response.status} ${response.statusText}\n${errorDetails}`);
                    // If rate limit (429), try next model
                    if (response.status === 429) {
                        lastError = `Rate limit (429) for model ${model}`;
                        continue;
                    }
                    // For other errors, try next model
                    lastError = `Model: ${model} | Error: ${response.status} ${response.statusText}\n${errorDetails}`;
                    continue;
                }
                // Success - process response
                const data = await response.json();
                const answerRaw = data.choices?.[0]?.message?.content ?? "Черный заслон не дал ответа";
                const answerMain = answerRaw.length > 1800
                    ? answerRaw.slice(0, 1800) + "…"
                    : answerRaw;
                // Add Zalgo footer (following existing pattern)
                let answer = answerMain + "\n\n" + Zalgo.downText("Анализ завершен, связь прервана...", 15) + "\n ㅤㅤ ";
                if (answer.length > 2000) {
                    answer = answer.slice(0, 2000);
                }
                await interaction.editReply(answer);
                return; // Success - exit function
            }
            catch (error) {
                lastError = error;
                continue; // Try next model
            }
        }
        // If all models failed
        await interaction.editReply("Черный заслон не дал ответа. Попробуй позже.");
        if (lastError) {
            console.error("AI fallback error, all models failed for truth check");
        }
    }
};
__decorate([
    Slash({ description: "Проверить правдивость утверждения через Чугса", name: "проверка-правды" }),
    __param(0, SlashOption({
        description: "Утверждение для проверки",
        name: "утверждение",
        required: true,
        type: ApplicationCommandOptionType.String,
    }))
], TruthCheckCommand.prototype, "truthCheck", null);
TruthCheckCommand = TruthCheckCommand_1 = __decorate([
    Discord()
], TruthCheckCommand);
export { TruthCheckCommand };
