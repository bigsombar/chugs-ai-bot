// Service for processing user text and generating optimized search queries using AI

export interface SearchQuery {
    query: string;
    priority: 'high' | 'medium' | 'low';
    type: 'factual' | 'opinion' | 'event';
}

export class QueryProcessingService {
    private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds timeout for AI requests

    /**
     * Generates optimized search queries from user input using AI
     * @param userText - The original user statement (up to 1000 characters)
     * @param apiKey - OpenRouter API key for AI processing
     * @returns Array of 3 optimized search queries
     */
    public static async generateSearchQueries(
        userText: string, 
        apiKey: string
    ): Promise<SearchQuery[]> {
        if (!userText || userText.trim().length === 0) {
            throw new Error("User text cannot be empty");
        }

        if (userText.length > 1000) {
            throw new Error("User text exceeds maximum length of 1000 characters");
        }

        try {
            const systemPrompt = this.createQueryExtractionPrompt();
            const userPrompt = `Проанализируй следующее утверждение и создай 3 поисковых запроса для проверки фактов:

"${userText}"

Верни результат в формате JSON массива с объектами, содержащими поля: query, priority, type.`;

            const aiResponse = await this.callAI(systemPrompt, userPrompt, apiKey);
            const queries = this.parseAIResponse(aiResponse);

            if (queries.length === 0) {
                // Fallback: create basic queries from user text if AI fails
                return this.createFallbackQueries(userText);
            }

            return queries;

        } catch (error: any) {
            console.error("Query generation failed:", error.message);
            
            // Fallback to basic keyword extraction
            return this.createFallbackQueries(userText);
        }
    }

    /**
     * Creates the system prompt for AI query extraction
     */
    private static createQueryExtractionPrompt(): string {
        return `Ты специалист по извлечению ключевых фактов для проверки правдивости утверждений. 

Твоя задача: проанализировать утверждение пользователя и создать ровно 3 поисковых запроса на русском языке, которые помогут найти информацию для проверки фактов.

Требования к запросам:
- Каждый запрос должен быть 2-8 слов
- Фокусируйся на проверяемых фактах, а не на мнениях
- Приоритизируй недавние события и конкретные утверждения
- Используй ключевые слова и имена из оригинального текста
- Избегай слишком общих формулировок

Типы запросов:
- factual: проверка конкретных фактов, цифр, дат
- event: проверка событий, происшествий, новостей
- opinion: проверка спорных утверждений, оценок

Приоритеты:
- high: ключевые факты, которые можно легко проверить
- medium: важные детали, требующие дополнительного поиска
- low: вспомогательная информация

Верни результат ТОЛЬКО в формате JSON массива:
[
  {"query": "поисковый запрос 1", "priority": "high", "type": "factual"},
  {"query": "поисковый запрос 2", "priority": "medium", "type": "event"},
  {"query": "поисковый запрос 3", "priority": "medium", "type": "factual"}
]`;
    }

    /**
     * Makes AI API call to generate queries
     */
    private static async callAI(
        systemPrompt: string, 
        userPrompt: string, 
        apiKey: string
    ): Promise<string> {
        // Use the same fallback models as in truthCheck.ts
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
        let attemptCount = 0;

        console.log("=== QUERY GENERATION REQUEST ===");
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`User text for query generation: "${userPrompt}"`);
        console.log(`User text length: ${userPrompt.length} characters`);
        console.log("===============================");

        // Try each model until one works
        for (const model of models) {
            attemptCount++;
            console.log(`\n--- Query Generation Attempt ${attemptCount}/${models.length} with model: ${model} ---`);
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

                const requestBody = {
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.3, // Lower temperature for more consistent results
                    max_tokens: 500   // Limit response length
                };

                console.log(`Query generation request body:`, JSON.stringify(requestBody, null, 2));

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                console.log(`Query generation response status: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    let errorDetails = "";
                    try {
                        const errorJson = await response.json();
                        errorDetails = JSON.stringify(errorJson, null, 2);
                        console.log(`Query generation error response:`, errorDetails);
                    } catch (parseError) {
                        console.log(`Could not parse query generation error response:`, parseError);
                    }
                    
                    console.error(`❌ Query generation model ${model} failed with status ${response.status}`);

                    // If rate limit (429), try next model
                    if (response.status === 429) {
                        lastError = `Rate limit (429) for model ${model}`;
                        console.log(`⏳ Query generation rate limited, trying next model...`);
                        continue;
                    }
                    
                    lastError = `Model: ${model} | Error: ${response.status} ${response.statusText}`;
                    console.log(`🔄 Query generation HTTP error, trying next model...`);
                    continue;
                }

                // Success - process response
                const data = await response.json() as {
                    choices?: { message?: { content?: string } }[],
                    usage?: any
                };
                
                console.log(`✅ Successful query generation response from ${model}`);
                console.log(`Full query generation response:`, JSON.stringify(data, null, 2));
                
                if (data.usage) {
                    console.log(`Query generation token usage:`, data.usage);
                }

                const content = data.choices?.[0]?.message?.content;
                
                console.log(`Query generation raw content: "${content}"`);
                console.log(`Query generation content length: ${content?.length || 0} characters`);
                
                if (!content) {
                    console.error(`❌ Query generation model ${model} returned no content`);
                    lastError = `No content received from model ${model}`;
                    continue;
                }

                if (content.trim().length === 0) {
                    console.error(`❌ Query generation model ${model} returned empty content`);
                    lastError = `Empty content received from model ${model}`;
                    continue;
                }

                console.log(`✅ Query generation model ${model} provided valid content`);
                return content;

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.error(`❌ Query generation timeout for model ${model}`);
                    lastError = `Timeout for model ${model}`;
                } else {
                    console.error(`❌ Query generation exception with model ${model}:`, error);
                    lastError = error;
                }
                continue;
            }
        }

        // If all models failed
        console.error(`💥 ALL QUERY GENERATION MODELS FAILED`);
        console.error(`Total query generation attempts: ${attemptCount}`);
        console.error(`Last query generation error:`, lastError);
        throw new Error(`All AI models failed. Last error: ${lastError}`);
    }

    /**
     * Parses AI response and extracts search queries
     */
    private static parseAIResponse(response: string): SearchQuery[] {
        console.log(`=== PARSING AI RESPONSE FOR QUERIES ===`);
        console.log(`Raw AI response: "${response}"`);
        console.log(`Response length: ${response.length} characters`);
        
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) {
                console.error(`❌ No JSON array found in AI response`);
                console.error(`Response content: "${response}"`);
                throw new Error("No JSON array found in AI response");
            }

            console.log(`✅ Found JSON in response: "${jsonMatch[0]}"`);
            
            const queries = JSON.parse(jsonMatch[0]) as SearchQuery[];
            console.log(`✅ Successfully parsed JSON, found ${queries.length} raw queries`);
            console.log(`Raw parsed queries:`, queries);
            
            // Validate and filter queries
            const validQueries = queries
                .filter(q => {
                    const isValid = q.query && q.query.trim().length > 0;
                    if (!isValid) {
                        console.warn(`⚠️ Filtering out invalid query:`, q);
                    }
                    return isValid;
                })
                .filter(q => {
                    const isReasonableLength = q.query.length <= 100;
                    if (!isReasonableLength) {
                        console.warn(`⚠️ Filtering out too long query (${q.query.length} chars):`, q.query);
                    }
                    return isReasonableLength;
                })
                .slice(0, 3); // Ensure exactly 3 queries

            console.log(`✅ After filtering: ${validQueries.length} valid queries`);

            // Fill missing fields with defaults
            const finalQueries = validQueries.map(q => ({
                query: q.query.trim(),
                priority: q.priority || 'medium',
                type: q.type || 'factual'
            }));

            console.log(`✅ Final processed queries:`, finalQueries);
            console.log(`========================================`);
            
            return finalQueries;

        } catch (error: any) {
            console.error(`❌ Failed to parse AI response for queries:`, error.message);
            console.error(`Error stack:`, error.stack);
            console.error(`AI response was: "${response}"`);
            console.error(`Response type:`, typeof response);
            console.error(`========================================`);
            return [];
        }
    }

    /**
     * Creates fallback queries when AI processing fails
     */
    private static createFallbackQueries(userText: string): SearchQuery[] {
        // Extract key words and phrases for basic search
        const cleanText = userText.toLowerCase()
            .replace(/[^\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u1C80-\u1C8F\w\s]/g, ' ') // Keep Cyrillic and Latin
            .replace(/\s+/g, ' ')
            .trim();

        // Extract important words (longer than 3 characters)
        const words = cleanText.split(' ')
            .filter(word => word.length > 3)
            .slice(0, 10); // Limit to first 10 important words

        const queries: SearchQuery[] = [];

        // Create 3 different query strategies
        if (words.length > 0) {
            // Query 1: First half of important words
            const firstHalf = words.slice(0, Math.ceil(words.length / 2)).join(' ');
            if (firstHalf.length > 0) {
                queries.push({
                    query: firstHalf,
                    priority: 'high',
                    type: 'factual'
                });
            }

            // Query 2: Second half of important words  
            const secondHalf = words.slice(Math.ceil(words.length / 2)).join(' ');
            if (secondHalf.length > 0) {
                queries.push({
                    query: secondHalf,
                    priority: 'medium',
                    type: 'event'
                });
            }

            // Query 3: Most important words (first few)
            const topWords = words.slice(0, 4).join(' ');
            if (topWords.length > 0 && topWords !== firstHalf) {
                queries.push({
                    query: topWords,
                    priority: 'medium', 
                    type: 'factual'
                });
            }
        }

        // If we still don't have enough queries, use the original text (truncated)
        while (queries.length < 3) {
            const truncatedText = userText.substring(0, 50).trim();
            queries.push({
                query: truncatedText,
                priority: 'low',
                type: 'factual'
            });
        }

        return queries.slice(0, 3); // Ensure exactly 3 queries
    }
}