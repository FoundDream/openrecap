import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Report } from "../types.js";

// ─── Template loading ───

function resolveTemplateDir(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  // Bundled (dist/index.js → dist/template/) vs unbundled (src/render/ → src/render/template/)
  for (const candidate of [
    path.join(dir, "template"),
    path.join(dir, "..", "render", "template"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Template directory not found");
}

let cachedTemplate: { html: string; css: string; js: string } | null = null;

function loadTemplate(): { html: string; css: string; js: string } {
  if (cachedTemplate) return cachedTemplate;
  const dir = resolveTemplateDir();
  cachedTemplate = {
    html: readFileSync(path.join(dir, "report.html"), "utf-8"),
    css: readFileSync(path.join(dir, "report.css"), "utf-8"),
    js: readFileSync(path.join(dir, "report.js"), "utf-8"),
  };
  return cachedTemplate;
}

// ─── Text helpers ───

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function md(str: string): string {
  const parts: string[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(str)) !== null) {
    if (match.index > lastIndex)
      parts.push(inlineMd(str.slice(lastIndex, match.index)));
    parts.push(`<pre><code>${esc(match[2].trim())}</code></pre>`);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < str.length) parts.push(inlineMd(str.slice(lastIndex)));
  return parts.join("");
}

function inlineMd(str: string): string {
  let result = esc(str);
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
  result = result.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ol>$1</ol>");
  result = result.replace(/\n(?!<)/g, "<br>\n");
  return result;
}

// ─── Category coloring ───

const COLOR_PALETTE = [
  "#3b82f6", "#a855f7", "#ec4899", "#f59e0b", "#10b981",
  "#6366f1", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

function categoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++)
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

// ─── Fragment builders ───

function buildProjectTags(projects: string[]): string {
  return projects.map((p) => `<span class="otag">${esc(p)}</span>`).join("");
}

function buildSessionRows(
  sessions: { project: string; summary: string }[],
): string {
  return sessions
    .map(
      (s, i) =>
        `<div class="sess-row">
          <div class="sess-num">${String(i + 1).padStart(2, "0")}</div>
          <div class="sess-proj">${esc(s.project)}</div>
          <div class="sess-desc">${md(s.summary)}</div>
        </div>`,
    )
    .join("\n");
}

function buildKnowledgeSection(cards: Report["knowledgeCards"]): string {
  if (cards.length === 0) return "";

  const categories = [...new Set(cards.map((c) => c.category))];

  const tabs = categories
    .map(
      (cat) =>
        `<div class="nb-tab" data-filter="${esc(cat)}">${esc(cat)}</div>`,
    )
    .join("\n");

  const items = cards
    .map(
      (card) => `
      <div class="nb-item" data-cat="${esc(card.category)}">
        <div class="nb-item-head">
          <span class="nb-item-cat" style="border-color:${categoryColor(card.category)};color:${categoryColor(card.category)}">${esc(card.category)}</span>
        </div>
        <div class="nb-item-title">${esc(card.title)}</div>
        <div class="nb-item-body">${md(card.explanation)}</div>
        ${card.tags.length ? `<div class="nb-item-tags">${card.tags.map((t) => `<span class="nb-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="nb-item-scenarios">${md(card.applicableScenarios)}</div>
      </div>`,
    )
    .join("\n");

  return `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Knowledge Points</span>
      <span class="section-count">${cards.length} items</span>
    </div>
    <div class="notebook">
      <div class="nb-tabs-bar">
        <div class="nb-tab active" data-filter="all">All</div>
        ${tabs}
      </div>
      <div class="nb-list">
        ${items}
      </div>
    </div>
  </div>`;
}

function buildTipsSection(tips: Report["practicalTips"]): string {
  if (tips.length === 0) return "";

  const items = tips
    .map(
      (tip, i) => `
      <div class="tip-item">
        <div class="tip-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="tip-content">
          <p class="tip-text">${md(tip.tip)}</p>
          ${tip.snippet ? `<pre><code>${esc(tip.snippet)}</code></pre>` : ""}
          ${tip.sourceProject ? `<span class="tip-source">${esc(tip.sourceProject)}</span>` : ""}
        </div>
      </div>`,
    )
    .join("\n");

  return `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Practical Tips</span>
      <span class="section-count">${tips.length} tips</span>
    </div>
    ${items}
  </div>`;
}

function buildProblemsSection(
  problems: Report["problemsAndSolutions"],
): string {
  if (problems.length === 0) return "";

  const items = problems
    .map(
      (ps) => `
      <details class="ps-item">
        <summary><span class="ps-icon">▸</span> ${esc(ps.problem)}</summary>
        <div class="ps-body">
          <div class="ps-section">
            <div class="ps-label">CAUSE</div>
            <div>${md(ps.cause)}</div>
          </div>
          <div class="ps-section">
            <div class="ps-label">SOLUTION</div>
            <div>${md(ps.solution)}</div>
          </div>
        </div>
      </details>`,
    )
    .join("\n");

  return `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Problems &amp; Solutions</span>
      <span class="section-count">${problems.length} items</span>
    </div>
    ${items}
  </div>`;
}

function buildFurtherLearningSection(
  items: Report["furtherLearning"],
): string {
  if (items.length === 0) return "";

  const list = items
    .map(
      (fl) =>
        `<div class="fl-item"><strong>${esc(fl.topic)}</strong><span class="fl-reason">${md(fl.reason)}</span></div>`,
    )
    .join("\n");

  return `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Further Learning</span>
    </div>
    ${list}
  </div>`;
}

// ─── Main render ───

export function renderHTML(report: Report, dateStr: string): string {
  const { html, css, js } = loadTemplate();

  const replacements: Record<string, string> = {
    "{{CSS}}": css,
    "{{JS}}": js,
    "{{TITLE}}": esc(report.title),
    "{{DATE}}": esc(dateStr),
    "{{STAT_SESSIONS}}": String(report.overview.totalSessions),
    "{{STAT_PROJECTS}}": String(report.overview.projectsInvolved.length),
    "{{STAT_KNOWLEDGE}}": String(report.knowledgeCards.length),
    "{{STAT_PROBLEMS}}": String(report.problemsAndSolutions.length),
    "{{PROJECT_TAGS}}": buildProjectTags(report.overview.projectsInvolved),
    "{{SESSION_COUNT}}": String(report.overview.totalSessions),
    "{{SESSION_ROWS}}": buildSessionRows(report.overview.sessionSummaries),
    "{{KNOWLEDGE_SECTION}}": buildKnowledgeSection(report.knowledgeCards),
    "{{TIPS_SECTION}}": buildTipsSection(report.practicalTips),
    "{{PROBLEMS_SECTION}}": buildProblemsSection(report.problemsAndSolutions),
    "{{FURTHER_LEARNING_SECTION}}": buildFurtherLearningSection(
      report.furtherLearning,
    ),
  };

  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}
