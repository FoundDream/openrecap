import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { configExists, loadConfig, runSetup } from './config.js';
import { parseDateOption, discoverSessions } from './session/discover.js';
import { mapAllSessions } from './analysis/map.js';
import { reduceAnalyses } from './analysis/reduce.js';
import { renderHTML } from './render/html.js';
import { renderMarkdown } from './render/markdown.js';
import { openInBrowser } from './utils/open.js';
import { log, spinner } from './utils/logger.js';
import { getCached } from './cache/cache.js';
import type { DiscoveredSession } from './types.js';

const program = new Command();

program
  .name('openrecap')
  .description('Review your daily Claude Code sessions and generate learning reports')
  .version('0.1.0');

// ─── Default: list sessions ───

program
  .option('--date <date>', 'Target date or range (e.g. today, 2026-03-14, 2026-03-10:2026-03-14)', 'today')
  .option('--detail', 'Show estimated tokens and cache status')
  .action(async (opts) => {
    try {
      const dateRange = parseDateOption(opts.date);
      const dateStr = formatDateRange(opts.date, dateRange);

      const spin = spinner('Discovering sessions...');
      const sessions = await discoverSessions(dateRange);
      spin.stop();

      if (sessions.length === 0) {
        log.info(`No sessions found for ${dateStr}.`);
        process.exit(0);
      }

      await printList(sessions, dateStr, opts.detail);
    } catch (e) {
      log.error(String(e));
      process.exit(1);
    }
  });

// ─── generate: run LLM analysis ───

program
  .command('generate')
  .description('Generate a learning report')
  .option('--date <date>', 'Target date or range', 'today')
  .option('--sessions <ids>', 'Session numbers or IDs, comma-separated (e.g. 1,3,5 or abc123)')
  .option('--format <format>', 'Output format: html | md')
  .option('--output <dir>', 'Output directory')
  .option('--no-cache', 'Skip cache for analysis (still writes cache)')
  .option('--concurrency <n>', 'LLM concurrency limit', '3')
  .action(async (opts) => {
    try {
      let config;
      if (!configExists()) {
        config = await runSetup();
      } else {
        config = loadConfig();
      }

      const dateRange = parseDateOption(opts.date);
      const dateStr = formatDateRange(opts.date, dateRange);

      const spin = spinner('Discovering sessions...');
      let sessions = await discoverSessions(dateRange);
      spin.stop();

      if (sessions.length === 0) {
        log.info(`No sessions found for ${dateStr}.`);
        process.exit(0);
      }

      // Filter by --sessions
      if (opts.sessions) {
        sessions = filterSessions(sessions, opts.sessions);
        if (sessions.length === 0) {
          log.warn('No matching sessions found for the given IDs.');
          process.exit(1);
        }
        log.info(`Selected ${sessions.length} session(s).`);
      }

      // Map phase
      const mapResults = await mapAllSessions(sessions, config, {
        noCache: !opts.cache,
        concurrency: parseInt(opts.concurrency, 10),
      });

      if (mapResults.length === 0) {
        log.warn('No sessions produced analysis results.');
        process.exit(1);
      }

      // Reduce phase
      const report = await reduceAnalyses(mapResults, config);

      // Render
      const format = resolveFormat(opts.format || config.format);
      const outputDir = opts.output || config.outputDir;
      mkdirSync(outputDir.replace('~', process.env.HOME || ''), { recursive: true });

      const resolvedDir = outputDir.replace('~', process.env.HOME || '');
      const datePart = formatDateForFilename(opts.date, dateRange);
      const sessionSuffix = opts.sessions
        ? '_' + sessions.map((s) => s.sessionId.slice(0, 6)).join('_')
        : '';
      const fileName = `${datePart}${sessionSuffix}.${format}`;
      const outputPath = path.join(resolvedDir, fileName);

      const output = format === 'md'
        ? renderMarkdown(report, dateStr)
        : renderHTML(report, dateStr);
      writeFileSync(outputPath, output, 'utf-8');

      log.success(`Report saved to ${outputPath}`);
      if (format === 'html') {
        openInBrowser(outputPath);
      }
    } catch (e) {
      log.error(String(e));
      process.exit(1);
    }
  });

// ─── config ───

program
  .command('config')
  .description('Reconfigure OpenRecap')
  .action(async () => {
    await runSetup();
  });

program.parse();

// ─── Helpers ───

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateRange(
  input: string,
  range: { start: Date; end: Date },
): string {
  if (input === 'today') {
    return formatLocalDate(range.start);
  }
  if (input.includes(':')) {
    return `${formatLocalDate(range.start)} to ${formatLocalDate(range.end)}`;
  }
  return input;
}

function formatDateForFilename(
  input: string,
  range: { start: Date; end: Date },
): string {
  if (input === 'today') {
    return formatLocalDate(range.start);
  }
  if (input.includes(':')) {
    return `${formatLocalDate(range.start)}_${formatLocalDate(range.end)}`;
  }
  return input;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function filterSessions(sessions: DiscoveredSession[], input: string): DiscoveredSession[] {
  const selectors = input.split(',').map((s) => s.trim());
  const result: DiscoveredSession[] = [];

  for (const sel of selectors) {
    const num = parseInt(sel, 10);
    if (!isNaN(num) && num >= 1 && num <= sessions.length) {
      // By number (1-based index from list output)
      result.push(sessions[num - 1]);
    } else {
      // By session ID (prefix match)
      const match = sessions.find((s) => s.sessionId.startsWith(sel));
      if (match) result.push(match);
    }
  }

  // Deduplicate
  return [...new Map(result.map((s) => [s.sessionId, s])).values()];
}

function resolveFormat(value: string): 'html' | 'md' {
  if (value === 'html' || value === 'md') return value;
  throw new Error(`Unsupported format: ${value}. Expected "html" or "md".`);
}

async function printList(
  sessions: DiscoveredSession[],
  dateStr: string,
  detail: boolean,
): Promise<void> {
  console.log();
  console.log(chalk.bold(`Sessions for ${dateStr}`));
  console.log(chalk.dim(`Found ${sessions.length} sessions`));
  console.log();

  let totalTokens = 0;
  let cachedCount = 0;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const time = s.startedAt.toTimeString().slice(0, 5);
    const project = s.cwd.replace(process.env.HOME || '', '~');
    const title = s.title;

    console.log(
      `  ${chalk.red(String(i + 1).padStart(2, '0'))}  ${chalk.dim(time)}  ${chalk.cyan(project)}`,
    );
    console.log(
      `      ${title}`,
    );

    if (detail) {
      const estTokens = Math.round(s.fileSize * 0.085);
      totalTokens += estTokens;
      const cached = await getCached(s.sessionId, s.filePath);
      if (cached) cachedCount++;
      console.log(
        `      ${chalk.dim(`${formatSize(s.fileSize)}  ·  ~${estTokens.toLocaleString()} tokens  ·  cache: ${cached ? chalk.green('✓') : chalk.dim('✗')}`)}`,
      );
    } else {
      console.log(
        `      ${chalk.dim(`${formatSize(s.fileSize)}  ·  ${s.sessionId}`)}`,
      );
    }

    console.log();
  }

  if (detail) {
    console.log(
      chalk.dim(`Total: ~${totalTokens.toLocaleString()} estimated tokens | ${cachedCount} cached`),
    );
    console.log();
  }

  console.log(chalk.dim(`Run ${chalk.white('openrecap generate --date ' + (dateStr.includes(' ') ? `"${dateStr}"` : dateStr))} to create a report.`));
  console.log();
}
