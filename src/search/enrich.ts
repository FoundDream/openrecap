import type { Report } from "../types.js";
import { spinner } from "../utils/logger.js";
import { searchTopic } from "./search.js";

/**
 * Enrich the report's furtherLearning topics with real search results.
 * Skips entirely if no Tavily API key is configured.
 */
export async function enrichReport(
  report: Report,
  tavilyApiKey?: string,
): Promise<Report> {
  if (!tavilyApiKey || report.furtherLearning.length === 0) return report;

  const spin = spinner("Searching learning resources...");
  const enriched = [];

  for (let i = 0; i < report.furtherLearning.length; i++) {
    const item = report.furtherLearning[i];
    spin.text = `Searching resources (${i + 1}/${report.furtherLearning.length})...`;

    const results = await searchTopic(
      `${item.topic} tutorial guide`,
      tavilyApiKey,
    );
    enriched.push({
      ...item,
      resources: results.length > 0 ? results : undefined,
    });
  }

  spin.succeed(
    `Found resources for ${enriched.filter((i) => i.resources).length}/${enriched.length} topics.`,
  );

  return { ...report, furtherLearning: enriched };
}
