import { generateObject } from 'ai';
import type { Config, MapResult, Report, SessionAnalysis } from '../types.js';
import { reportSchema } from '../types.js';
import { createModel } from './llm.js';
import { REDUCE_SYSTEM_PROMPT, buildReduceUserPrompt } from './prompts.js';
import { log, spinner } from '../utils/logger.js';
import { estimateTokens } from '../utils/tokens.js';

const MAX_REDUCE_TOKENS = 80_000;

/**
 * Reduce phase: consolidate all session analyses into a single report.
 * If total input exceeds token budget, splits into batches, reduces each,
 * then merges batch reports into a final report.
 */
export async function reduceAnalyses(
  mapResults: MapResult[],
  config: Config,
): Promise<Report> {
  const sessionInputs = mapResults.map((r) => ({
    project: r.projectPath,
    analysis: JSON.stringify(r.analysis, null, 2),
  }));

  const totalTokens = estimateTokens(sessionInputs.map((s) => s.analysis).join(''));

  if (totalTokens <= MAX_REDUCE_TOKENS) {
    // Fits in one call
    return singleReduce(sessionInputs, mapResults, config);
  }

  // Split into batches
  log.info(`Input too large (~${totalTokens.toLocaleString()} tokens), reducing in batches...`);
  const batches = splitIntoBatches(sessionInputs, MAX_REDUCE_TOKENS);
  const batchReports: Report[] = [];

  const spin = spinner(`Reducing batch 1/${batches.length}...`);
  for (let i = 0; i < batches.length; i++) {
    spin.text = `Reducing batch ${i + 1}/${batches.length}...`;
    try {
      const model = createModel(config);
      const result = await generateObject({
        model,
        schema: reportSchema,
        system: REDUCE_SYSTEM_PROMPT,
        prompt: buildReduceUserPrompt(batches[i]),
      });
      batchReports.push(result.object);
    } catch (e) {
      log.warn(`Batch ${i + 1} failed: ${e}`);
    }
  }
  spin.succeed(`Reduced ${batches.length} batches.`);

  if (batchReports.length === 0) {
    log.warn('All reduce batches failed, using fallback.');
    return buildFallback(mapResults);
  }

  if (batchReports.length === 1) {
    return batchReports[0];
  }

  // Merge batch reports
  const mergeSpin = spinner('Merging batch results...');
  try {
    const mergeInputs = batchReports.map((r, i) => ({
      project: `Batch ${i + 1}`,
      analysis: JSON.stringify(r, null, 2),
    }));
    const model = createModel(config);
    const merged = await generateObject({
      model,
      schema: reportSchema,
      system: REDUCE_SYSTEM_PROMPT,
      prompt: buildReduceUserPrompt(mergeInputs),
    });
    mergeSpin.succeed('Report generated.');
    return merged.object;
  } catch {
    mergeSpin.fail('Merge failed, combining batches manually.');
    return mergeFallback(batchReports);
  }
}

async function singleReduce(
  sessionInputs: { project: string; analysis: string }[],
  mapResults: MapResult[],
  config: Config,
): Promise<Report> {
  const model = createModel(config);
  const spin = spinner('Generating consolidated report...');

  try {
    const result = await generateObject({
      model,
      schema: reportSchema,
      system: REDUCE_SYSTEM_PROMPT,
      prompt: buildReduceUserPrompt(sessionInputs),
    });
    spin.succeed('Report generated.');
    return result.object;
  } catch (e) {
    spin.fail('Failed to generate report.');
    return buildFallback(mapResults);
  }
}

function splitIntoBatches(
  items: { project: string; analysis: string }[],
  maxTokens: number,
): { project: string; analysis: string }[][] {
  const batches: { project: string; analysis: string }[][] = [];
  let current: { project: string; analysis: string }[] = [];
  let currentTokens = 0;

  for (const item of items) {
    const itemTokens = estimateTokens(item.analysis);
    if (currentTokens + itemTokens > maxTokens && current.length > 0) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(item);
    currentTokens += itemTokens;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

function buildFallback(mapResults: MapResult[]): Report {
  return {
    title: 'Daily Learning Report',
    overview: {
      totalSessions: mapResults.length,
      sessionSummaries: mapResults.map((r) => ({
        project: r.projectPath,
        summary: r.analysis.sessionSummary,
      })),
      projectsInvolved: [...new Set(mapResults.map((r) => r.projectPath))],
    },
    knowledgeCards: mapResults.flatMap((r) =>
      r.analysis.knowledgePoints.map((kp) => ({
        ...kp,
        tags: r.analysis.technologies,
      })),
    ),
    practicalTips: mapResults.flatMap((r) =>
      r.analysis.practicalTips.map((tip) => ({
        ...tip,
        sourceProject: r.projectPath,
      })),
    ),
    problemsAndSolutions: mapResults.flatMap(
      (r) => r.analysis.problemsAndSolutions,
    ),
    furtherLearning: [],
  };
}

function mergeFallback(reports: Report[]): Report {
  return {
    title: reports[0]?.title || 'Daily Learning Report',
    overview: {
      totalSessions: reports.reduce((sum, r) => sum + r.overview.totalSessions, 0),
      sessionSummaries: reports.flatMap((r) => r.overview.sessionSummaries),
      projectsInvolved: [...new Set(reports.flatMap((r) => r.overview.projectsInvolved))],
    },
    knowledgeCards: reports.flatMap((r) => r.knowledgeCards),
    practicalTips: reports.flatMap((r) => r.practicalTips),
    problemsAndSolutions: reports.flatMap((r) => r.problemsAndSolutions),
    furtherLearning: reports.flatMap((r) => r.furtherLearning),
  };
}
