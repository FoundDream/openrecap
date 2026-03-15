import { readdirSync, statSync, createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import type { DiscoveredSession } from '../types.js';
import { log } from '../utils/logger.js';

const CLAUDE_PROJECTS_DIR = path.join(homedir(), '.claude', 'projects');

/**
 * Validate that a constructed Date matches the input parts (catches overflow like month 13).
 */
function assertValidDate(d: Date, parts: number[], input: string): void {
  if (isNaN(d.getTime()) || d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2]) {
    throw new Error(`Invalid date: "${input}". Expected format: YYYY-MM-DD`);
  }
}

/**
 * Parse a date option string into a start/end Date range (local timezone, inclusive).
 *
 * Supported formats:
 *   "today"           → today 00:00 ~ 23:59:59.999
 *   "2026-03-14"      → that day
 *   "2026-03-10:2026-03-14" → range
 */
export function parseDateOption(dateStr: string): { start: Date; end: Date } {
  if (dateStr === 'today') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (dateStr.includes(':')) {
    const [startStr, endStr] = dateStr.split(':');
    const startParts = startStr.split('-').map(Number);
    const endParts = endStr.split('-').map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
    assertValidDate(start, startParts, startStr);
    assertValidDate(end, endParts, endStr);
    return { start, end };
  }

  const parts = dateStr.split('-').map(Number);
  const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  const end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  assertValidDate(start, parts, dateStr);
  return { start, end };
}

/**
 * Decode a project directory name back to a path.
 * `-Users-foo-code` → `/Users/foo/code`
 */
function decodeProjectPath(dirName: string): string {
  // The encoding replaces `/` with `-`, so the first `-` was a leading `/`
  return '/' + dirName.slice(1).replace(/-/g, '/');
}

/**
 * Read the first N lines of a file and find the earliest timestamp.
 */
async function findStartTime(filePath: string, maxLines = 10): Promise<{ timestamp: Date; cwd: string } | null> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let cwd = '';

  for await (const line of rl) {
    if (++lineCount > maxLines) break;

    try {
      const obj = JSON.parse(line);
      if (obj.cwd && !cwd) cwd = obj.cwd;
      if (obj.timestamp) {
        rl.close();
        return { timestamp: new Date(obj.timestamp), cwd: cwd || obj.cwd || '' };
      }
    } catch {
      // skip malformed lines
    }
  }

  return null;
}

/**
 * Extract a title from the first user message in a session JSONL file.
 */
export async function getSessionTitle(filePath: string, maxChars = 80): Promise<string> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  for await (const line of rl) {
    if (++lineCount > 50) break;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'user' && obj.message?.content) {
        rl.close();
        const text = typeof obj.message.content === 'string'
          ? obj.message.content
          : obj.message.content
              .filter((b: { type: string }) => b.type === 'text')
              .map((b: { text: string }) => b.text)
              .join(' ');
        const firstLine = text.split('\n')[0].trim();
        if (!firstLine) continue;
        return firstLine.length > maxChars
          ? firstLine.slice(0, maxChars - 1) + '…'
          : firstLine;
      }
    } catch {
      // skip
    }
  }
  return '(empty session)';
}

/**
 * Discover Claude Code sessions matching a date range.
 */
export async function discoverSessions(dateRange: { start: Date; end: Date }): Promise<DiscoveredSession[]> {
  if (!statSync(CLAUDE_PROJECTS_DIR, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      `Claude Code session directory not found: ${CLAUDE_PROJECTS_DIR}\n` +
      'Please make sure Claude Code is installed and has been used at least once.',
    );
  }

  const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const sessions: DiscoveredSession[] = [];

  for (const dir of projectDirs) {
    const projectDir = path.join(CLAUDE_PROJECTS_DIR, dir.name);
    let files: string[];
    try {
      files = readdirSync(projectDir).filter(
        (f) => f.endsWith('.jsonl') && !f.startsWith('agent-'),
      );
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectDir, file);
      const sessionId = file.replace('.jsonl', '');

      try {
        const info = await findStartTime(filePath);
        if (!info) continue;

        // Check if the session's start time falls within the date range (local timezone)
        if (info.timestamp >= dateRange.start && info.timestamp <= dateRange.end) {
          const stat = statSync(filePath);
          sessions.push({
            sessionId,
            filePath,
            projectPath: decodeProjectPath(dir.name),
            cwd: info.cwd,
            startedAt: info.timestamp,
            fileSize: stat.size,
          });
        }
      } catch (e) {
        log.warn(`Failed to read session ${file}: ${e}`);
      }
    }
  }

  // Sort by start time
  sessions.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return sessions;
}
