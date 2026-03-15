import type { Report } from "../types.js";

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

export function renderHTML(report: Report, dateStr: string): string {
  // Collect unique categories for tabs
  const categories = [...new Set(report.knowledgeCards.map((c) => c.category))];

  const knowledgeNoteItems = report.knowledgeCards
    .map(
      (card, i) => `
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

  const categoryTabs = categories
    .map(
      (cat) =>
        `<div class="nb-tab" data-filter="${esc(cat)}">${esc(cat)}</div>`,
    )
    .join("\n");

  const tips = report.practicalTips
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

  const problems = report.problemsAndSolutions
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

  const sessionRows = report.overview.sessionSummaries
    .map(
      (s, i) =>
        `<div class="sess-row">
          <div class="sess-num">${String(i + 1).padStart(2, "0")}</div>
          <div class="sess-proj">${esc(s.project)}</div>
          <div class="sess-desc">${md(s.summary)}</div>
        </div>`,
    )
    .join("\n");

  const furtherLearning = report.furtherLearning
    .map(
      (fl) =>
        `<div class="fl-item"><strong>${esc(fl.topic)}</strong><span class="fl-reason">${md(fl.reason)}</span></div>`,
    )
    .join("\n");

  const projectTags = report.overview.projectsInvolved
    .map((p) => `<span class="otag">${esc(p)}</span>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(report.title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
:root {
  --bg: #0a0a0a;
  --surface: #141414;
  --surface2: #1a1a1a;
  --border: #2a2a2a;
  --text: #e8e8e8;
  --text2: #999;
  --accent: #FF3B30;
  --accent2: #FF6B5E;
  --code-bg: #111;
  --code-border: #333;
}
html.light {
  --bg: #f5f5f0;
  --surface: #ffffff;
  --surface2: #fafaf8;
  --border: #e0e0dc;
  --text: #0a0a0a;
  --text2: #666;
  --accent: #E8230A;
  --accent2: #FF3B30;
  --code-bg: #f0f0ec;
  --code-border: #ddd;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ─── HERO ─── */
.hero {
  padding: 4rem 2rem 3rem;
  border-bottom: 1px solid var(--border);
}
.hero-inner {
  max-width: 1000px;
  margin: 0 auto;
}
.hero-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text2);
}
.hero-brand { font-weight: 700; color: var(--accent); }
.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text2);
  transition: border-color 0.2s;
}
.theme-toggle:hover { border-color: var(--accent); color: var(--text); }
.hero-title {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 1.5rem;
  max-width: 900px;
}
.hero-stats {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.stat { display: flex; flex-direction: column; }
.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
}
.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text2);
  margin-top: 0.25rem;
}
.hero-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }

/* ─── LAYOUT ─── */
.main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 2rem 4rem;
}
.section { padding: 2.5rem 0; border-bottom: 1px solid var(--border); }
.section:last-child { border-bottom: none; }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.5rem;
}
.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--accent);
}
.section-count {
  font-size: 0.75rem;
  color: var(--text2);
  letter-spacing: 0.05em;
}

/* ─── OVERVIEW TABLE ─── */
.sess-row {
  display: grid;
  grid-template-columns: 2rem 180px 1fr;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  align-items: baseline;
}
.sess-row:last-child { border-bottom: none; }
.sess-num {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: var(--text2);
}
.sess-proj {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent2);
}
.sess-desc { font-size: 0.9rem; color: var(--text2); }

/* ─── NOTEBOOK (Knowledge Points) ─── */
:root {
  --nb-bg: #1e1e1e;
  --nb-text: #e0e0e0;
  --nb-text2: #999;
  --nb-border: rgba(255,255,255,0.08);
  --nb-tab-inactive: #2a2a2a;
  --nb-code-bg: #161616;
  --nb-code-border: rgba(255,255,255,0.1);
  --nb-hover: rgba(255,255,255,0.03);
  --nb-cat-border: rgba(255,255,255,0.15);
  --nb-tag-border: rgba(255,255,255,0.2);
  --nb-scenarios: #777;
}
html.light {
  --nb-bg: #EAEAE6;
  --nb-text: #111;
  --nb-text2: #555;
  --nb-border: rgba(0,0,0,0.06);
  --nb-tab-inactive: #94A3B0;
  --nb-code-bg: #ddd9d4;
  --nb-code-border: rgba(0,0,0,0.1);
  --nb-hover: rgba(0,0,0,0.03);
  --nb-cat-border: currentColor;
  --nb-tag-border: #111;
  --nb-scenarios: #666;
}
.notebook {
  background: var(--nb-bg);
  border-radius: 12px;
  overflow: hidden;
  color: var(--nb-text);
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}
html.light .notebook { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.nb-tabs-bar {
  display: flex;
  align-items: flex-end;
  padding-left: 12px;
  gap: 0;
  background: transparent;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.nb-tab {
  padding: 10px 22px 8px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--nb-text2);
  background: var(--nb-tab-inactive);
  border-radius: 10px 10px 0 0;
  cursor: pointer;
  position: relative;
  white-space: nowrap;
  transition: background 0.15s, transform 0.15s;
  margin-right: -6px;
  z-index: 1;
  clip-path: polygon(8% 0, 92% 0, 100% 100%, 0% 100%);
  min-width: 80px;
  text-align: center;
}
.nb-tab:nth-child(even) { opacity: 0.85; }
.nb-tab:hover:not(.active) { transform: translateY(-2px); }
.nb-tab.active {
  background: var(--nb-bg);
  color: var(--nb-text);
  z-index: 5;
  font-weight: 600;
  padding-bottom: 10px;
}
.nb-list {
  padding: 8px 0;
}
.nb-item {
  padding: 16px 24px;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--nb-border);
  transition: background 0.12s;
}
.nb-item:last-child { border-bottom: none; }
.nb-item:hover { background: var(--nb-hover); }
.nb-item-head {
  margin-bottom: 6px;
}
.nb-item-cat {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 1px 8px;
  border: 1px solid var(--nb-cat-border);
  border-radius: 10px;
}
.nb-item-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--nb-text);
  margin-bottom: 8px;
  line-height: 1.35;
}
.nb-item-body {
  font-size: 13.5px;
  color: var(--nb-text2);
  line-height: 1.65;
}
.nb-item-body ol { margin: 0.4rem 0 0.4rem 1.4rem; }
.nb-item-body li { margin-bottom: 0.15rem; }
.nb-item-body code {
  background: var(--nb-code-bg);
  border: 1px solid var(--nb-code-border);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85em;
  color: var(--nb-text);
}
.nb-item-body pre {
  background: var(--nb-code-bg);
  border: 1px solid var(--nb-code-border);
  color: var(--nb-text);
}
.nb-item-body pre code {
  background: none;
  border: none;
  padding: 0;
}
.nb-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}
.nb-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 7px;
  border: 1px solid var(--nb-tag-border);
  border-radius: 10px;
  color: var(--nb-text2);
}
.nb-item-scenarios {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--nb-border);
  font-size: 12px;
  color: var(--nb-scenarios);
  line-height: 1.5;
}
.nb-item.hidden { display: none; }

/* ─── OUTLINE TAGS ─── */
.otag {
  display: inline-block;
  border: 1px solid var(--border);
  padding: 0.15rem 0.55rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text2);
}

/* ─── TIPS ─── */
.tip-item {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 1rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}
.tip-item:last-child { border-bottom: none; }
.tip-num {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
}
.tip-text { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.5rem; }
.tip-source {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text2);
  font-style: italic;
}

/* ─── PROBLEMS ─── */
.ps-item {
  border-bottom: 1px solid var(--border);
}
.ps-item:last-child { border-bottom: none; }
.ps-item summary {
  padding: 0.85rem 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  list-style: none;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.ps-item summary::-webkit-details-marker { display: none; }
.ps-item[open] summary .ps-icon { transform: rotate(90deg); }
.ps-icon {
  color: var(--accent);
  font-size: 0.8rem;
  transition: transform 0.15s;
  flex-shrink: 0;
}
.ps-item summary:hover { color: var(--accent); }
.ps-body { padding: 0 0 1.25rem 1.3rem; }
.ps-section { margin-bottom: 0.75rem; }
.ps-section:last-child { margin-bottom: 0; }
.ps-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

/* ─── FURTHER LEARNING ─── */
.fl-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}
.fl-item:last-child { border-bottom: none; }
.fl-reason {
  display: block;
  color: var(--text2);
  font-size: 0.85rem;
  margin-top: 0.2rem;
}

/* ─── CODE ─── */
pre {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  padding: 0.85rem 1rem;
  overflow-x: auto;
  font-size: 0.8rem;
  margin: 0.5rem 0;
  line-height: 1.5;
}
code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}
:not(pre) > code {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  padding: 0.1rem 0.35rem;
  font-size: 0.85em;
}

/* ─── FOOTER ─── */
.foot {
  text-align: center;
  padding: 2rem;
  font-size: 0.7rem;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 640px) {
  .hero { padding: 2rem 1rem 1.5rem; }
  .hero-title { font-size: 2rem; }
  .main { padding: 0 1rem 2rem; }
  .sess-row { grid-template-columns: 2rem 1fr; }
  .sess-proj { grid-column: 2; }
  .sess-desc { grid-column: 2; }
  .tip-item { grid-template-columns: 2rem 1fr; }
}
@media print {
  .theme-toggle { display: none; }
  .hero { padding: 1rem 0; }
  body { background: #fff; color: #000; }
}
</style>
</head>
<body>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-meta">
      <span class="hero-brand">OpenRecap</span>
      <span>${esc(dateStr)}</span>
      <button class="theme-toggle" onclick="toggleTheme()">◐ Theme</button>
    </div>
    <h1 class="hero-title">${esc(report.title)}</h1>
    <div class="hero-stats">
      <div class="stat">
        <span class="stat-value">${report.overview.totalSessions}</span>
        <span class="stat-label">Sessions</span>
      </div>
      <div class="stat">
        <span class="stat-value">${report.overview.projectsInvolved.length}</span>
        <span class="stat-label">Projects</span>
      </div>
      <div class="stat">
        <span class="stat-value">${report.knowledgeCards.length}</span>
        <span class="stat-label">Knowledge Points</span>
      </div>
      <div class="stat">
        <span class="stat-value">${report.problemsAndSolutions.length}</span>
        <span class="stat-label">Problems Solved</span>
      </div>
    </div>
    <div class="hero-tags">${projectTags}</div>
  </div>
</div>

<div class="main">
  <div class="section">
    <div class="section-header">
      <span class="section-title">Session Overview</span>
      <span class="section-count">${report.overview.totalSessions} sessions</span>
    </div>
    ${sessionRows}
  </div>

  ${
    report.knowledgeCards.length
      ? `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Knowledge Points</span>
      <span class="section-count">${report.knowledgeCards.length} items</span>
    </div>
    <div class="notebook">
      <div class="nb-tabs-bar">
        <div class="nb-tab active" data-filter="all">All</div>
        ${categoryTabs}
      </div>
      <div class="nb-list">
        ${knowledgeNoteItems}
      </div>
    </div>
  </div>`
      : ""
  }

  ${
    report.practicalTips.length
      ? `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Practical Tips</span>
      <span class="section-count">${report.practicalTips.length} tips</span>
    </div>
    ${tips}
  </div>`
      : ""
  }

  ${
    report.problemsAndSolutions.length
      ? `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Problems &amp; Solutions</span>
      <span class="section-count">${report.problemsAndSolutions.length} items</span>
    </div>
    ${problems}
  </div>`
      : ""
  }

  ${
    report.furtherLearning.length
      ? `
  <div class="section">
    <div class="section-header">
      <span class="section-title">Further Learning</span>
    </div>
    ${furtherLearning}
  </div>`
      : ""
  }
</div>

<div class="foot">Generated by OpenRecap</div>

<script>
(function() {
  var s = localStorage.getItem('openrecap-theme');
  if (s === 'light') document.documentElement.classList.add('light');
})();
function toggleTheme() {
  var on = document.documentElement.classList.toggle('light');
  localStorage.setItem('openrecap-theme', on ? 'light' : 'dark');
}
// Notebook tab filtering
(function() {
  var tabs = document.querySelectorAll('.nb-tab');
  var items = document.querySelectorAll('.nb-item');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var filter = tab.getAttribute('data-filter');
      items.forEach(function(item) {
        if (filter === 'all' || item.getAttribute('data-cat') === filter) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });
})();
</script>
</body>
</html>`;
}
