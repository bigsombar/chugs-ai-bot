import { load } from "cheerio";
// Enum for truth assessment categories
export var TruthAssessment;
(function (TruthAssessment) {
    TruthAssessment["LIKELY_TRUE"] = "likely_true";
    TruthAssessment["LIKELY_FALSE"] = "likely_false";
    TruthAssessment["UNCERTAIN"] = "uncertain";
    TruthAssessment["NO_EVIDENCE"] = "no_evidence";
})(TruthAssessment || (TruthAssessment = {}));
// Main class for web search and content processing functionality
export class WebSearchService {
    static MAX_CONTENT_LENGTH = 1000; // Limit content extraction
    static REQUEST_TIMEOUT = 15000; // 15 seconds timeout
    static QUERY_DELAY = 500; // Delay between queries to avoid rate limiting
    // Main search function for single query (legacy support)
    static async searchClaim(query) {
        const maxResults = parseInt(process.env.MAX_SEARCH_RESULTS || "8");
        return await this.searchDuckDuckGo(query, maxResults);
    }
    // New function for searching multiple queries sequentially
    static async searchMultipleQueries(queries) {
        const maxResultsPerQuery = 8;
        const allResults = [];
        for (let i = 0; i < queries.length; i++) {
            const queryObj = queries[i];
            if (!queryObj || !queryObj.query) {
                console.warn(`Skipping invalid query at index ${i}`);
                continue;
            }
            try {
                console.log(`Searching query ${i + 1}/${queries.length}: "${queryObj.query}"`);
                const results = await this.searchDuckDuckGo(queryObj.query, maxResultsPerQuery);
                // Add source query tracking
                const taggedResults = results.map(result => ({
                    ...result,
                    sourceQuery: queryObj.query
                }));
                allResults.push(...taggedResults);
                // Add delay between queries to avoid rate limiting
                if (i < queries.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.QUERY_DELAY));
                }
            }
            catch (error) {
                console.error(`Query "${queryObj.query}" failed:`, error.message);
                // Continue with next query even if this one fails
                continue;
            }
        }
        // Remove duplicates based on URL
        const uniqueResults = this.removeDuplicateResults(allResults);
        console.log(`Total unique results found: ${uniqueResults.length}`);
        return uniqueResults;
    }
    // Remove duplicate results from multiple queries
    static removeDuplicateResults(results) {
        const seen = new Set();
        const unique = [];
        for (const result of results) {
            const urlKey = result.url.toLowerCase();
            if (!seen.has(urlKey)) {
                seen.add(urlKey);
                unique.push(result);
            }
        }
        return unique;
    }
    // Enhanced DuckDuckGo search with improved parsing and reliability
    static async searchDuckDuckGo(query, maxResults) {
        console.log(`Searching DuckDuckGo for: "${query}"`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        try {
            const searchUrl = new URL("https://html.duckduckgo.com/html/");
            searchUrl.searchParams.append("q", query);
            searchUrl.searchParams.append("kl", "ru-ru"); // Add Russian locale for better results
            // Rotate user agents for better reliability
            const userAgents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
            ];
            const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            // Create headers object with proper typing
            const headers = {
                "User-Agent": randomUserAgent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            };
            const response = await fetch(searchUrl.toString(), {
                method: "GET",
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`DuckDuckGo returned ${response.status}: ${response.statusText}`);
            }
            const html = await response.text();
            const $ = load(html);
            const results = [];
            // Enhanced DuckDuckGo result parsing with multiple selectors
            const resultSelectors = [
                '.result',
                '.result__body',
                '.web-result',
                '.serp__results .result'
            ];
            for (const selector of resultSelectors) {
                $(selector).each((i, element) => {
                    if (results.length >= maxResults)
                        return false;
                    const $element = $(element);
                    // Try multiple title selectors
                    let titleElement = $element.find('.result__title a');
                    if (titleElement.length === 0) {
                        titleElement = $element.find('.result__a');
                    }
                    if (titleElement.length === 0) {
                        titleElement = $element.find('h2 a, h3 a');
                    }
                    // Try multiple snippet selectors
                    let snippetElement = $element.find('.result__snippet');
                    if (snippetElement.length === 0) {
                        snippetElement = $element.find('.result__body');
                    }
                    if (snippetElement.length === 0) {
                        snippetElement = $element.find('.snippet');
                    }
                    const title = titleElement.text().trim();
                    const url = titleElement.attr('href');
                    const snippet = snippetElement.text().trim();
                    // Validate result quality
                    if (title && url && snippet &&
                        title.length > 10 &&
                        snippet.length > 20 &&
                        !results.some(r => r.url === url)) { // Avoid duplicates
                        results.push({
                            title,
                            url,
                            snippet,
                            displayUrl: url
                        });
                    }
                });
                // If we found results with this selector, break
                if (results.length > 0)
                    break;
            }
            console.log(`DuckDuckGo found ${results.length} results for query: "${query}"`);
            // Retry with simpler query if no results found
            if (results.length === 0 && query.split(' ').length > 3) {
                console.log("No results found, retrying with simplified query...");
                const simplifiedQuery = query.split(' ').slice(0, 3).join(' ');
                return await this.searchDuckDuckGo(simplifiedQuery, maxResults);
            }
            return results;
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error("DuckDuckGo search timed out");
            }
            throw new Error(`DuckDuckGo search failed: ${error.message}`);
        }
    }
    // Enhanced evidence processing for multiple queries
    static async processSearchResults(results) {
        const evidenceItems = [];
        for (const result of results) {
            try {
                const content = await this.extractContentFromUrl(result.url);
                const reliability = this.assessSourceReliability(result.displayUrl);
                const relevance = this.calculateRelevance(result.snippet, content || '', result.sourceQuery);
                evidenceItems.push({
                    source: result.title,
                    url: result.url,
                    content: content || result.snippet, // Fallback to snippet if extraction fails
                    reliability,
                    relevance,
                    sourceQuery: result.sourceQuery
                });
            }
            catch (error) {
                // If content extraction fails, use snippet as fallback
                evidenceItems.push({
                    source: result.title,
                    url: result.url,
                    content: result.snippet,
                    reliability: this.assessSourceReliability(result.displayUrl),
                    relevance: 0.5, // Medium relevance for snippet-only content
                    sourceQuery: result.sourceQuery
                });
            }
        }
        // Sort by reliability and relevance
        return evidenceItems.sort((a, b) => {
            const reliabilityScore = { high: 3, medium: 2, low: 1 };
            const scoreA = reliabilityScore[a.reliability] + a.relevance;
            const scoreB = reliabilityScore[b.reliability] + b.relevance;
            return scoreB - scoreA;
        });
    }
    // Extracts text content from a web page
    static async extractContentFromUrl(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; FactCheckBot/1.0)"
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return null;
            }
            const html = await response.text();
            const $ = load(html);
            // Remove script and style elements
            $('script, style').remove();
            // Extract text from main content areas
            const content = $('article, main, .content, .article-body, p').text()
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, this.MAX_CONTENT_LENGTH);
            return content || null;
        }
        catch (error) {
            return null;
        }
    }
    // Assesses the reliability of a source based on domain
    static assessSourceReliability(domain) {
        const highReliability = [
            'bbc.com', 'reuters.com', 'ap.org', 'npr.org', 'pbs.org',
            'gov.uk', 'gov.au', 'canada.ca', 'europa.eu',
            'nature.com', 'science.org', 'nejm.org', 'thelancet.com',
            'who.int', 'cdc.gov', 'nih.gov'
        ];
        const mediumReliability = [
            'wikipedia.org', 'britannica.com', 'snopes.com', 'factcheck.org',
            'politifact.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
            'wsj.com', 'ft.com', 'economist.com'
        ];
        const lowerDomain = domain.toLowerCase();
        if (highReliability.some(trusted => lowerDomain.includes(trusted))) {
            return 'high';
        }
        if (mediumReliability.some(decent => lowerDomain.includes(decent))) {
            return 'medium';
        }
        return 'low';
    }
    // Enhanced relevance calculation with source query consideration
    static calculateRelevance(snippet, content, sourceQuery) {
        // Simple relevance calculation based on content length and snippet presence
        if (!content || content.length < 50) {
            return 0.3;
        }
        let baseRelevance = 0.6;
        if (content.length > 500) {
            baseRelevance = 0.9;
        }
        // Boost relevance if source query keywords are found in content
        if (sourceQuery && content.toLowerCase().includes(sourceQuery.toLowerCase())) {
            baseRelevance = Math.min(1.0, baseRelevance + 0.2);
        }
        return baseRelevance;
    }
    // Enhanced evidence summary creation for multiple queries
    static createEvidenceSummary(evidenceItems) {
        if (evidenceItems.length === 0) {
            return "Информация не найдена в доступных источниках.";
        }
        let summary = "Найденная информация по результатам поиска:\n\n";
        // Group evidence by source query if available
        const queryGroups = new Map();
        const noQueryItems = [];
        evidenceItems.forEach(item => {
            if (item.sourceQuery) {
                if (!queryGroups.has(item.sourceQuery)) {
                    queryGroups.set(item.sourceQuery, []);
                }
                queryGroups.get(item.sourceQuery).push(item);
            }
            else {
                noQueryItems.push(item);
            }
        });
        // Add grouped evidence
        let sourceIndex = 1;
        for (const [query, items] of queryGroups) {
            if (items.length > 0) {
                summary += `**По запросу "${query}":**\n`;
                const topItems = items.slice(0, 2); // Top 2 per query
                topItems.forEach(item => {
                    summary += `• ${item.source} (${item.reliability} надежность)\n`;
                    summary += `  ${item.content.substring(0, 200)}...\n\n`;
                });
            }
        }
        // Add ungrouped evidence
        if (noQueryItems.length > 0) {
            summary += "**Дополнительные источники:**\n";
            noQueryItems.slice(0, 2).forEach(item => {
                summary += `• ${item.source} (${item.reliability} надежность)\n`;
                summary += `  ${item.content.substring(0, 200)}...\n\n`;
            });
        }
        return summary;
    }
    // Assesses overall truth based on evidence
    static assessTruth(evidenceItems) {
        if (evidenceItems.length === 0) {
            return TruthAssessment.NO_EVIDENCE;
        }
        const highReliabilityItems = evidenceItems.filter(item => item.reliability === 'high');
        const mediumReliabilityItems = evidenceItems.filter(item => item.reliability === 'medium');
        // If we have high-reliability sources, base assessment on them
        if (highReliabilityItems.length > 0) {
            return highReliabilityItems.length >= 2 ? TruthAssessment.LIKELY_TRUE : TruthAssessment.UNCERTAIN;
        }
        // If we have medium-reliability sources
        if (mediumReliabilityItems.length >= 2) {
            return TruthAssessment.LIKELY_TRUE;
        }
        // Default to uncertain if we don't have enough reliable sources
        return TruthAssessment.UNCERTAIN;
    }
}
