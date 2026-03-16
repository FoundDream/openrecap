import type { Report } from "../types.js";

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n`;
}

function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function fenced(code: string): string {
  return `\`\`\`\n${code}\n\`\`\``;
}

function inlineTags(tags: string[]): string {
  return tags.map((t) => `\`${t}\``).join(" ");
}

export function renderMarkdown(report: Report, dateStr: string): string {
  const sections: string[] = [`# ${report.title}`, "", `Date: ${dateStr}`, ""];

  // Summary
  if (report.overview.summary) {
    sections.push(`> ${report.overview.summary}`, "");
  }

  // Technologies
  if (report.overview.technologies.length > 0) {
    const techLines = report.overview.technologies
      .map((t) => `- **${t.category}:** ${inlineTags(t.items)}`)
      .join("\n");
    sections.push(techLines, "");
  }

  // Overview (always present)
  const overview = [
    `- Sessions: ${report.overview.totalSessions}`,
    `- Projects: ${report.overview.projectsInvolved.join(", ") || "None"}`,
  ].join("\n");
  sections.push(section("Overview", overview));

  // Session Summaries
  if (report.overview.sessionSummaries.length > 0) {
    sections.push(
      section(
        "Session Summaries",
        list(
          report.overview.sessionSummaries.map(
            (s) => `**${s.project}**: ${s.summary}`,
          ),
        ),
      ),
    );
  }

  // Knowledge Cards
  if (report.knowledgeCards.length > 0) {
    const cards = report.knowledgeCards
      .map((card) => {
        const tags = card.tags.length ? `\n${inlineTags(card.tags)}` : "";
        return [
          `### ${card.title}`,
          `**Category:** ${card.category}${tags}`,
          "",
          card.explanation,
          "",
          `**Applicable scenarios:** ${card.applicableScenarios}`,
        ].join("\n");
      })
      .join("\n\n");
    sections.push(section("Knowledge Cards", cards));
  }

  // Practical Tips
  if (report.practicalTips.length > 0) {
    const tips = report.practicalTips
      .map((tip, index) => {
        const parts = [`${index + 1}. ${tip.tip}`];
        if (tip.snippet) {
          parts.push("", fenced(tip.snippet));
        }
        if (tip.sourceProject) {
          parts.push("", `*Source: ${tip.sourceProject}*`);
        }
        return parts.join("\n");
      })
      .join("\n\n");
    sections.push(section("Practical Tips", tips));
  }

  // Problems and Solutions
  if (report.problemsAndSolutions.length > 0) {
    const problems = report.problemsAndSolutions
      .map((item, index) =>
        [
          `### ${index + 1}. ${item.problem}`,
          `> **Cause:** ${item.cause}`,
          "",
          `**Solution:** ${item.solution}`,
        ].join("\n\n"),
      )
      .join("\n\n");
    sections.push(section("Problems and Solutions", problems));
  }

  // Further Learning
  if (report.furtherLearning.length > 0) {
    const items = report.furtherLearning
      .map((item) => {
        const parts = [`### ${item.topic}`, "", item.reason];
        if (item.resources && item.resources.length > 0) {
          parts.push(
            "",
            item.resources
              .map((r) => `- [${r.title}](${r.url}) — ${r.snippet}`)
              .join("\n"),
          );
        }
        return parts.join("\n");
      })
      .join("\n\n");
    sections.push(section("Further Learning", items));
  }

  return sections.join("\n");
}
