# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies (always use bun, not npm/yarn)
npm run build        # Build with tsup (output: dist/)
npm run dev          # Build in watch mode
bun test             # Run all tests
bun test <file>      # Run a single test file
npx tsc --noEmit     # Type-check without emitting
npm run lint         # Lint and format check (Biome)
npm run lint:fix     # Auto-fix lint and format issues
```

## Architecture

OpenRecap analyzes Claude Code session files (`~/.claude/projects/**/*.jsonl`) and generates learning reports via a **Map-Reduce** pipeline:

```
Discover → Parse (DAG) → Compress → Sanitize → Map (LLM) → Reduce (LLM) → Render
```

### Key stages

- **Discover** (`session/discover.ts`): Scans `~/.claude/projects/` for `.jsonl` session files, extracts metadata (timestamp, cwd, title), filters by date range.
- **Parse** (`session/parser.ts`): Reconstructs conversation DAG from JSONL. Finds the latest leaf node, walks parent chain back to root to get the "final path". Merges streaming assistant chunks by `requestId`.
- **Compress** (`session/compress.ts`): Multi-level compression — filters message types, truncates content, drops thinking blocks, chunks by token budget (30K) if needed.
- **Sanitize** (`privacy/sanitizer.ts`): Regex-based secret redaction (API keys, JWTs, connection strings) before any LLM call.
- **Map** (`analysis/map.ts`): Analyzes each session independently via LLM with `generateObject()` + Zod schema. Runs concurrently (default 3) with exponential backoff retry. Results cached with SHA-256 file hash validation (`~/.openrecap/cache/`).
- **Reduce** (`analysis/reduce.ts`): Consolidates all session analyses into one report. Auto-batches if total tokens > 80K, merges batch reports. Falls back to manual report construction if LLM fails.
- **Render** (`render/html.ts`, `render/markdown.ts`): Transforms `Report` into HTML (with dark/light theme, interactive tabs) or Markdown.

### LLM provider abstraction

`analysis/llm.ts` creates a unified model interface via Vercel AI SDK (`ai` package). Supports OpenAI-compatible APIs and AWS Bedrock. Config stored in `~/.openrecap/config.json`.

### Token estimation

`utils/tokens.ts` uses a character-based heuristic: CJK chars = 1.5 tokens, others = 0.25 tokens. Used for chunking and batching decisions, not billing.

## Conventions

- **Use bun for dependencies**: Always use `bun install` / `bun add` to manage packages, not npm or yarn.
- **No hardcoded config**: All user-configurable values come from `~/.openrecap/config.json`. Never hardcode provider settings, model IDs, or paths.
- **ESM only**: All imports use `.js` extensions (Node16 module resolution).
- **Zod schemas as source of truth**: Types in `types.ts` are inferred from Zod schemas (`z.infer<typeof schema>`), shared between LLM structured output and internal logic.
- **Biome for linting/formatting**: Run `npm run lint:fix` before committing. Template files (`src/render/template/`) are excluded from Biome.
- **Output filenames**: `{date}.{format}` for full reports, `{date}_{sessionId6chars}.{format}` when `--sessions` is specified.
