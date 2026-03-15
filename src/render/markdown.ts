import type { Report } from '../types.js';

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n`;
}

function list(items: string[]): string {
  if (items.length === 0) return '- None';
  return items.map((item) => `- ${item}`).join('\n');
}

function fenced(code: string): string {
  return `\`\`\`\n${code}\n\`\`\``;
}

export function renderMarkdown(report: Report, dateStr: string): string {
  const overview = [
    `- Sessions: ${report.overview.totalSessions}`,
    `- Projects: ${report.overview.projectsInvolved.join(', ') || 'None'}`,
  ].join('\n');

  const sessionSummaries = list(
    report.overview.sessionSummaries.map(
      (session) => `**${session.project}**: ${session.summary}`,
    ),
  );

  const knowledgeCards = report.knowledgeCards.length
    ? report.knowledgeCards
        .map((card) => {
          const tags = card.tags.length ? `\nTags: ${card.tags.join(', ')}` : '';
          return [
            `### ${card.title}`,
            `Category: ${card.category}${tags}`,
            '',
            card.explanation,
            '',
            `Applicable scenarios: ${card.applicableScenarios}`,
          ].join('\n');
        })
        .join('\n\n')
    : 'No knowledge points extracted.';

  const practicalTips = report.practicalTips.length
    ? report.practicalTips
        .map((tip, index) => {
          const parts = [`${index + 1}. ${tip.tip}`];
          if (tip.snippet) {
            parts.push('', fenced(tip.snippet));
          }
          if (tip.sourceProject) {
            parts.push('', `Source: ${tip.sourceProject}`);
          }
          return parts.join('\n');
        })
        .join('\n\n')
    : 'No practical tips extracted.';

  const problemsAndSolutions = report.problemsAndSolutions.length
    ? report.problemsAndSolutions
        .map(
          (item, index) =>
            [
              `### ${index + 1}. ${item.problem}`,
              `Cause: ${item.cause}`,
              `Solution: ${item.solution}`,
            ].join('\n\n'),
        )
        .join('\n\n')
    : 'No problems recorded.';

  const furtherLearning = list(
    report.furtherLearning.map(
      (item) => `**${item.topic}**: ${item.reason}`,
    ),
  );

  return [
    `# ${report.title}`,
    '',
    `Date: ${dateStr}`,
    '',
    section('Overview', overview),
    section('Session Summaries', sessionSummaries),
    section('Knowledge Cards', knowledgeCards),
    section('Practical Tips', practicalTips),
    section('Problems and Solutions', problemsAndSolutions),
    section('Further Learning', furtherLearning),
  ].join('\n');
}
