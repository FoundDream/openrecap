# OpenRecap

[![npm version](https://img.shields.io/npm/v/openrecap.svg)](https://www.npmjs.com/package/openrecap)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-session_reviewer-blueviolet.svg)](https://claude.ai)

Review your daily Claude Code sessions and generate beautiful HTML learning reports. Turns AI-assisted coding into lasting knowledge.

## Install

```bash
npm install -g openrecap
```

Requires Node.js 18+ and access to AWS Bedrock or any OpenAI-compatible API.

## Quick Start

```bash
# First run — interactive setup (provider, endpoint/region, model, auth)
openrecap config

# List today's sessions
openrecap

# List a specific date
openrecap --date 2026-03-14

# Generate a report
openrecap generate --date 2026-03-14

# Generate for specific sessions only (by number from list)
openrecap generate --date 2026-03-14 --sessions 1,3,5
```

## Usage

```
openrecap [options]              List sessions (default)
openrecap generate [options]     Generate a learning report
openrecap config                 Re-run setup

List options:
  --date <date>       Target date or range (default: today)
                      Examples: 2026-03-14, 2026-03-10:2026-03-14
  --detail            Show estimated tokens and cache status

Generate options:
  --date <date>       Target date or range (default: today)
  --sessions <ids>    Session numbers or IDs, comma-separated (e.g. 1,3,5)
  --format <format>   Output format: html | md (default: html)
  --output <dir>      Output directory (default: ~/openrecap-reports)
  --no-cache          Skip cached analysis, re-analyze all sessions
  --concurrency <n>   LLM concurrency limit (default: 3)
```

## What It Does

![Architecture](assets/arch.svg)

1. **Discover** — Scans `~/.claude/projects/` for sessions matching the target date
2. **Parse** — Reconstructs the final conversation path from the session DAG (handles branching, compaction, sub-agents)
3. **Compress** — Filters noise (progress events, snapshots), truncates tool I/O, chunks large sessions
4. **Sanitize** — Redacts API keys, AWS credentials, JWTs, connection strings, private keys
5. **Map** — Analyzes each session with LLM, extracts knowledge points, tips, and problem-solution pairs
6. **Reduce** — Merges all session analyses into one consolidated report (auto-batches when input exceeds context limit)
7. **Render** — Generates a self-contained HTML or Markdown report

## Report Sections

- **Overview** — Session count, projects involved, one-line summary per session
- **Knowledge Points** — Interactive notebook with category tabs, filterable by topic
- **Practical Tips** — Reusable code snippets and techniques
- **Problems & Solutions** — Collapsible cards: problem → cause → solution
- **Further Learning** — Suggested topics based on the day's work

## Authentication

OpenRecap supports two providers:

**OpenAI-compatible APIs** (recommended)

- Base URL (default: `https://api.openai.com/v1`)
- API Key — optional for self-hosted endpoints
- Model ID — e.g. `gpt-5.4`,

**AWS Bedrock**

- AWS Region (default: `us-east-1`)
- AWS Bearer Token (`AWS_BEARER_TOKEN_BEDROCK`) — or standard AWS credential chain

## Privacy

Session data is sent to your configured LLM provider for analysis.

Safeguards:

- Explicit consent prompt during setup
- Best-effort secret redaction before any LLM call
- Reports and cache stored locally only (`~/.openrecap/`)

## Development

```bash
git clone https://github.com/founddream/openrecap.git
cd openrecap
bun install

# Run directly (no build needed)
bun run src/index.ts

# Tests
bun test

# Type check
bun run typecheck

# Build & run
bun run build
./dist/index.js
```

## License

MIT
