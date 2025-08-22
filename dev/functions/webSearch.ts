import { load } from "cheerio";

// Interface for search results
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    displayUrl: string;
    datePublished?: string;
}

// Interface for processed evidence after content extraction
export interface EvidenceItem {
    source: string;
    url: string;
    content: string;
    reliability: 'high' | 'medium' | 'low';
    relevance: number;
}

// Enum for truth assessment categories
export enum TruthAssessment {
    LIKELY_TRUE = 'likely_true',
    LIKELY_FALSE = 'likely_false',
    UNCERTAIN = 'uncertain',
    NO_EVIDENCE = 'no_evidence'
}

// Main class for web search and content processing functionality
export class WebSearchService {
    private static readonly MAX_CONTENT_LENGTH = 1000; // Limit content extraction
    private static readonly REQUEST_TIMEOUT = 15000; // 15 seconds timeout
    
    // Main search function with multiple scraping strategies
    public static async searchClaim(query: string): Promise<SearchResult[]> {
        const maxResults = parseInt(process.env.MAX_SEARCH_RESULTS || "5");
        
        // Try different search strategies
        const strategies = [
            () => this.scrapeStartpage(query, maxResults),
            () => this.scrapeDuckDuckGo(query, maxResults),
            () => this.scrapeYandex(query, maxResults)
        ];
        
        for (const strategy of strategies) {
            try {
                const results = await strategy();
                if (results.length > 0) {
                    return results;
                }
            } catch (error: any) {
                console.log(`Search strategy failed: ${error.message}`);
                continue;
            }
        }
        
        throw new Error("All search strategies failed");
    }

    // Scrape Startpage (uses Google results but privacy-focused)
    private static async scrapeStartpage(query: string, maxResults: number): Promise<SearchResult[]> {
        console.log("Trying Startpage search...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        try {
            const searchUrl = new URL("https://www.startpage.com/sp/search");
            searchUrl.searchParams.append("query", query);
            searchUrl.searchParams.append("language", "english");
            searchUrl.searchParams.append("count", maxResults.toString());
            
            const response = await fetch(searchUrl.toString(), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en,ru,ru-RU;q=0.9"
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Startpage returned ${response.status}`);
            }
            
            const html = await response.text();
            const $ = load(html);
            const results: SearchResult[] = [];
            
            // Parse Startpage results
            $('.w-gl__result').each((i, element) => {
                if (results.length >= maxResults) return false;
                
                const $element = $(element);
                const titleElement = $element.find('.w-gl__result-title a');
                const snippetElement = $element.find('.w-gl__description');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');
                const snippet = snippetElement.text().trim();
                
                if (title && url && snippet) {
                    results.push({
                        title,
                        url,
                        snippet,
                        displayUrl: url
                    });
                }
            });
            
            console.log(`Startpage found ${results.length} results`);
            return results;
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("Startpage search timed out");
            }
            throw new Error(`Startpage search failed: ${error.message}`);
        }
    }

    // Scrape DuckDuckGo HTML (fallback)
    private static async scrapeDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
        console.log("Trying DuckDuckGo search...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        try {
            const searchUrl = new URL("https://html.duckduckgo.com/html/");
            searchUrl.searchParams.append("q", query);
            
            const response = await fetch(searchUrl.toString(), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`DuckDuckGo returned ${response.status}`);
            }
            
            const html = await response.text();
            const $ = load(html);
            const results: SearchResult[] = [];
            
            // Parse DuckDuckGo results
            $('.result').each((i, element) => {
                if (results.length >= maxResults) return false;
                
                const $element = $(element);
                const titleElement = $element.find('.result__title a');
                const snippetElement = $element.find('.result__snippet');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');
                const snippet = snippetElement.text().trim();
                
                if (title && url && snippet) {
                    results.push({
                        title,
                        url,
                        snippet,
                        displayUrl: url
                    });
                }
            });
            
            console.log(`DuckDuckGo found ${results.length} results`);
            return results;
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("DuckDuckGo search timed out");
            }
            throw new Error(`DuckDuckGo search failed: ${error.message}`);
        }
    }

    // Scrape Yandex (works well internationally)
    private static async scrapeYandex(query: string, maxResults: number): Promise<SearchResult[]> {
        console.log("Trying Yandex search...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        try {
            const searchUrl = new URL("https://yandex.com/search/");
            searchUrl.searchParams.append("text", query);
            searchUrl.searchParams.append("lr", "84"); // English results
            
            const response = await fetch(searchUrl.toString(), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en,ru,ru-RU;q=0.9"
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Yandex returned ${response.status}`);
            }
            
            const html = await response.text();
            const $ = load(html);
            const results: SearchResult[] = [];
            
            // Parse Yandex results
            $('.serp-item').each((i, element) => {
                if (results.length >= maxResults) return false;
                
                const $element = $(element);
                const titleElement = $element.find('.organic__url-text, .organic__title-wrapper a');
                const snippetElement = $element.find('.organic__text, .text-container');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href') || $element.find('a').first().attr('href');
                const snippet = snippetElement.text().trim();
                
                if (title && url && snippet) {
                    // Clean up Yandex URLs
                    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
                    results.push({
                        title,
                        url: cleanUrl,
                        snippet,
                        displayUrl: cleanUrl
                    });
                }
            });
            
            console.log(`Yandex found ${results.length} results`);
            return results;
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("Yandex search timed out");
            }
            throw new Error(`Yandex search failed: ${error.message}`);
        }
    }

    // Extracts and processes content from search results
    public static async processSearchResults(results: SearchResult[]): Promise<EvidenceItem[]> {
        const evidenceItems: EvidenceItem[] = [];

        for (const result of results) {
            try {
                const content = await this.extractContentFromUrl(result.url);
                const reliability = this.assessSourceReliability(result.displayUrl);
                const relevance = this.calculateRelevance(result.snippet, content || '');

                evidenceItems.push({
                    source: result.title,
                    url: result.url,
                    content: content || result.snippet, // Fallback to snippet if extraction fails
                    reliability,
                    relevance
                });
            } catch (error) {
                // If content extraction fails, use snippet as fallback
                evidenceItems.push({
                    source: result.title,
                    url: result.url,
                    content: result.snippet,
                    reliability: this.assessSourceReliability(result.displayUrl),
                    relevance: 0.5 // Medium relevance for snippet-only content
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
    private static async extractContentFromUrl(url: string): Promise<string | null> {
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
        } catch (error) {
            return null;
        }
    }

    // Assesses the reliability of a source based on domain
    private static assessSourceReliability(domain: string): 'high' | 'medium' | 'low' {
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

    // Calculates relevance score based on content similarity
    private static calculateRelevance(snippet: string, content: string): number {
        // Simple relevance calculation based on content length and snippet presence
        if (!content || content.length < 50) {
            return 0.3;
        }

        if (content.length > 500) {
            return 0.9;
        }

        return 0.6;
    }

    // Creates a summary of evidence for AI analysis
    public static createEvidenceSummary(evidenceItems: EvidenceItem[]): string {
        if (evidenceItems.length === 0) {
            return "Информация не найдена в доступных источниках.";
        }

        let summary = "Найденная информация:\n\n";

        evidenceItems.slice(0, 3).forEach((item, index) => {
            summary += `**Источник ${index + 1}** (${item.reliability} надежность):\n`;
            summary += `${item.source}\n`;
            summary += `${item.content.substring(0, 300)}...\n\n`;
        });

        return summary;
    }

    // Assesses overall truth based on evidence
    public static assessTruth(evidenceItems: EvidenceItem[]): TruthAssessment {
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