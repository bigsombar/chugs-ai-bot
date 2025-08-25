import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { BWSecretManager } from "../functions/bitwarden.js";
import { Zalgo } from "../functions/zalgo.js";
import { WebSearchService, TruthAssessment } from "../functions/webSearch.js";
import { QueryProcessingService } from "../functions/queryProcessing.js";

@Discord()
export class TruthCheckCommand {
    private static secretManager = new BWSecretManager();

    @Slash({ description: "Проверить правдивость утверждения через Чугса", name: "проверка-правды" })
    async truthCheck(
        @SlashOption({
            description: "Утверждение для проверки",
            name: "утверждение",
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        claim: string,
        interaction: CommandInteraction
    ): Promise<void> {

        // Defer the interaction as this will take some time
        await interaction.deferReply();

        // Validate claim length (increased to 1500 characters)
        if (claim.length > 1500) {
            await interaction.editReply("Слишком длинное утверждение. Максимум 1500 символов.");
            return;
        }

        // Get AI API key
        if (!process.env.AI_KEY) {
            await interaction.editReply("Нет ключа к черному заслону");
            return;
        }
        const aiApiKey = await TruthCheckCommand.secretManager.getSecret(process.env.AI_KEY);
        if (!aiApiKey) {
            await interaction.editReply("Не удалось пробиться через черный заслон");
            return;
        }

        // No API keys needed for web scraping approach
        console.log("Using direct web scraping for search functionality");

        try {
            // Step 1: Generate optimized search queries using AI
            console.log("Generating optimized search queries...");
            const searchQueries = await QueryProcessingService.generateSearchQueries(claim, aiApiKey);
            
            if (searchQueries.length === 0) {
                await interaction.editReply("Не удалось создать поисковые запросы. Попробуй позже.");
                return;
            }

            console.log(`Generated ${searchQueries.length} search queries:`, searchQueries.map(q => q.query));

            // Step 2: Perform multiple searches with generated queries
            const searchResults = await WebSearchService.searchMultipleQueries(searchQueries);
            
            if (searchResults.length === 0) {
                await this.sendNoEvidenceResponse(claim, aiApiKey, interaction);
                return;
            }

            console.log(`Found ${searchResults.length} total search results`);

            // Step 3: Process search results and extract evidence
            const evidenceItems = await WebSearchService.processSearchResults(searchResults);
            
            // Step 4: Create evidence summary for AI
            const evidenceSummary = WebSearchService.createEvidenceSummary(evidenceItems);
            
            // Step 5: Assess overall truth
            const truthAssessment = WebSearchService.assessTruth(evidenceItems);
            
            // Step 6: Send to Chugs AI for final response
            await this.sendToChugAI(claim, evidenceSummary, truthAssessment, aiApiKey, interaction);

        } catch (error: any) {
            console.error("Truth check error:", error);
            
            if (error.message.includes("Query generation") || error.message.includes("AI models failed")) {
                await interaction.editReply("Черный заслон не может обработать запрос. Попробуй позже.");
            } else if (error.message.includes("DuckDuckGo")) {
                await interaction.editReply("Поисковые модули черного заслона недоступны. Попробуй позже.");
            } else if (error.message.includes("timed out")) {
                await interaction.editReply("Черный заслон не отвечает. Сеть перегружена.");
            } else {
                await interaction.editReply(`Ошибка черного заслона: ${error.message}`);
            }
        }
    }

    // Handles case when no evidence is found
    private async sendNoEvidenceResponse(
        claim: string,
        apiKey: string,
        interaction: CommandInteraction
    ): Promise<void> {
        const systemPrompt = this.createChugsSystemPrompt();
        const userPrompt = `
        Человек утверждает: "${claim}"
        
        Я не смог найти никакой информации в интернете об этом утверждении через поисковые запросы.
        Возможно, это слишком новая информация, локальная информация, или полная выдумка.
        
        Ответь как Чугс, что ты думаешь об этом утверждении, когда нет доказательств в интернете.
        `;

        await this.callChugsAI(systemPrompt, userPrompt, apiKey, interaction);
    }

    // Sends evidence to Chugs AI for analysis
    private async sendToChugAI(
        claim: string,
        evidenceSummary: string,
        truthAssessment: TruthAssessment,
        apiKey: string,
        interaction: CommandInteraction
    ): Promise<void> {
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

        await this.callChugsAI(systemPrompt, userPrompt, apiKey, interaction);
    }

    // Creates the system prompt for Chugs persona
    private createChugsSystemPrompt(): string {
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
    private async callChugsAI(
        systemPrompt: string,
        userPrompt: string,
        apiKey: string,
        interaction: CommandInteraction
    ): Promise<void> {
        // Array of fallback models (following existing pattern from describe.ts)
        const models = [
            "tngtech/deepseek-r1t2-chimera:free",
            "microsoft/mai-ds-r1:free",
            "google/gemini-2.0-flash-exp:free",
            "mistralai/mistral-small-3.2-24b-instruct:free",
            "deepseek/deepseek-r1-0528:free",
            "deepseek/deepseek-chat-v3-0324:free",
            "deepseek/deepseek-r1:free"
        ];

        let lastError: any = null;

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
                    } catch { }
                    
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
                const data = await response.json() as {
                    choices?: { message?: { content?: string } }[]
                };
                
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
                
            } catch (error: any) {
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
}