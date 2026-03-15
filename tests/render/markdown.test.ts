import { describe, expect, test } from 'bun:test';
import { renderMarkdown } from '../../src/render/markdown.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  title: 'TypeScript and Testing',
  overview: {
    totalSessions: 2,
    sessionSummaries: [
      { project: '/repo/a', summary: 'Implemented a parser fix.' },
      { project: '/repo/b', summary: 'Improved test coverage.' },
    ],
    projectsInvolved: ['/repo/a', '/repo/b'],
  },
  knowledgeCards: [
    {
      title: 'Discriminated unions',
      category: 'language-feature',
      tags: ['typescript', 'types'],
      explanation: 'Useful for modeling variant states safely.',
      applicableScenarios: 'State machines and structured API responses.',
    },
  ],
  practicalTips: [
    {
      tip: 'Use focused fixtures for parser edge cases.',
      snippet: 'expect(parse(input)).toEqual(output)',
      sourceProject: '/repo/b',
    },
  ],
  problemsAndSolutions: [
    {
      problem: 'Parser picked the wrong branch.',
      cause: 'Leaf selection logic ignored the latest node.',
      solution: 'Sort leaf candidates by timestamp before backtracking.',
    },
  ],
  furtherLearning: [
    {
      topic: 'Property-based testing',
      reason: 'It can cover parser edge cases more systematically.',
    },
  ],
};

describe('renderMarkdown', () => {
  test('renders a markdown report with all main sections', () => {
    const output = renderMarkdown(report, '2026-03-15');

    expect(output).toContain('# TypeScript and Testing');
    expect(output).toContain('Date: 2026-03-15');
    expect(output).toContain('## Overview');
    expect(output).toContain('## Session Summaries');
    expect(output).toContain('## Knowledge Cards');
    expect(output).toContain('## Practical Tips');
    expect(output).toContain('## Problems and Solutions');
    expect(output).toContain('## Further Learning');
    expect(output).toContain('```');
    expect(output).toContain('Discriminated unions');
  });
});
