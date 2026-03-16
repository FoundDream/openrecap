import type { ContentBlock, ParsedMessage } from "../types.js";
import { estimateTokens } from "../utils/tokens.js";

const MAX_TOKENS_PER_CHUNK = 30_000;
const MAX_TEXT_LENGTH = 6000;
const TEXT_TAIL_LENGTH = 200;
const TOOL_INPUT_MAX = 200;
const TOOL_RESULT_MAX = 500;

/**
 * Multi-level compression pipeline.
 *
 * Level 0: DAG path extraction (already done by parser)
 * Level 1: Keep only user + assistant messages
 * Level 2: Trim content blocks (remove thinking, truncate tool I/O and long text)
 * Level 3: If estimated tokens > 30K, split into chunks by conversation turns
 */
export function compressSession(messages: ParsedMessage[]): string[] {
  // Level 1: filter to user + assistant only
  const filtered = messages.filter(
    (m) => m.type === "user" || m.type === "assistant",
  );

  // Level 2: trim content
  const trimmed = filtered.map(trimMessage);

  // Format to readable text
  const formatted = formatMessages(trimmed);

  // Level 3: chunk if too large
  const totalTokens = estimateTokens(formatted);
  if (totalTokens <= MAX_TOKENS_PER_CHUNK) {
    return [formatted];
  }

  return chunkByTurns(trimmed);
}

function trimMessage(msg: ParsedMessage): ParsedMessage {
  if (typeof msg.content === "string") {
    return { ...msg, content: truncateText(msg.content) };
  }

  const trimmedBlocks: ContentBlock[] = [];
  for (const block of msg.content) {
    switch (block.type) {
      case "thinking":
        // Drop thinking blocks entirely (they're empty in practice)
        break;
      case "tool_use":
        trimmedBlocks.push({
          ...block,
          input: truncateText(
            typeof block.input === "string"
              ? block.input
              : JSON.stringify(block.input),
            TOOL_INPUT_MAX,
          ),
        });
        break;
      case "tool_result":
        trimmedBlocks.push({
          ...block,
          content: truncateText(
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content),
            TOOL_RESULT_MAX,
          ),
        });
        break;
      case "text":
        trimmedBlocks.push({ ...block, text: truncateText(block.text) });
        break;
      default:
        trimmedBlocks.push(block);
    }
  }

  return { ...msg, content: trimmedBlocks };
}

function truncateText(text: string, maxLen = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLen + TEXT_TAIL_LENGTH) return text;
  return (
    text.slice(0, maxLen) +
    `\n...[truncated ${text.length - maxLen - TEXT_TAIL_LENGTH} chars]...\n` +
    text.slice(-TEXT_TAIL_LENGTH)
  );
}

function formatMessages(messages: ParsedMessage[]): string {
  return messages.map(formatMessage).join("\n\n");
}

function formatMessage(msg: ParsedMessage): string {
  const role = msg.role === "user" ? "[user]" : "[assistant]";

  if (typeof msg.content === "string") {
    return `${role}\n${msg.content}`;
  }

  const parts: string[] = [role];
  for (const block of msg.content) {
    switch (block.type) {
      case "text":
        parts.push(block.text);
        break;
      case "tool_use":
        parts.push(
          `  → Tool: ${block.name}(${typeof block.input === "string" ? block.input : JSON.stringify(block.input)})`,
        );
        break;
      case "tool_result": {
        const content =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content);
        parts.push(`  ← Result: ${content}`);
        break;
      }
    }
  }

  return parts.join("\n");
}

/**
 * Split messages into chunks by conversation turns, each under the token limit.
 */
function chunkByTurns(messages: ParsedMessage[]): string[] {
  const chunks: string[] = [];
  let currentChunk: ParsedMessage[] = [];
  let currentTokens = 0;

  for (const msg of messages) {
    const msgText = formatMessage(msg);
    const msgTokens = estimateTokens(msgText);

    if (
      currentTokens + msgTokens > MAX_TOKENS_PER_CHUNK &&
      currentChunk.length > 0
    ) {
      chunks.push(formatMessages(currentChunk));
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(msg);
    currentTokens += msgTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(formatMessages(currentChunk));
  }

  return chunks;
}
