import { log } from "../utils/logger.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 3;

/**
 * Search for resources related to a topic.
 * Uses Tavily if API key is provided, otherwise skips.
 */
export async function searchTopic(
  query: string,
  tavilyApiKey?: string,
): Promise<SearchResult[]> {
  if (!tavilyApiKey) return [];

  try {
    return await searchTavily(query, tavilyApiKey);
  } catch (e) {
    log.warn(`Tavily search failed for "${query}": ${e}`);
    return [];
  }
}

async function searchTavily(
  query: string,
  apiKey: string,
): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    results: { title: string; url: string; content: string }[];
  };
  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 200),
  }));
}
