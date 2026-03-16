import { z } from "zod";

// ─── JSONL Message Types ───

export type MessageType =
  | "user"
  | "assistant"
  | "system"
  | "progress"
  | "file-history-snapshot"
  | "last-prompt"
  | "queue-operation";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "tool_result"; tool_use_id: string; content: unknown };

export interface JSONLMessage {
  type: MessageType;
  message?: {
    role: "user" | "assistant";
    content: string | ContentBlock[];
  };
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  uuid?: string;
  parentUuid?: string | null;
  logicalParentUuid?: string;
  isSidechain?: boolean;
  requestId?: string;
  toolUseID?: string;
  toolUseResult?: unknown;
}

// ─── Session Discovery ───

export interface DiscoveredSession {
  sessionId: string;
  filePath: string;
  cwd: string;
  title: string;
  startedAt: Date;
  fileSize: number;
}

// ─── Parsed Session ───

export interface ParsedMessage {
  type: MessageType;
  role?: "user" | "assistant";
  content: string | ContentBlock[];
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  logicalParentUuid?: string;
  isSidechain?: boolean;
  requestId?: string;
  cwd?: string;
}

// ─── Zod Schemas ───

export const sessionAnalysisSchema = z.object({
  sessionSummary: z.string(),
  language: z.enum(["zh", "en", "auto"]),
  knowledgePoints: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      explanation: z.string(),
      applicableScenarios: z.string(),
    }),
  ),
  practicalTips: z.array(
    z.object({
      tip: z.string(),
      snippet: z.string().optional(),
    }),
  ),
  problemsAndSolutions: z.array(
    z.object({
      problem: z.string(),
      cause: z.string(),
      solution: z.string(),
    }),
  ),
  technologies: z.array(z.string()),
});

export type SessionAnalysis = z.infer<typeof sessionAnalysisSchema>;

export const reportSchema = z.object({
  title: z.string(),
  overview: z.object({
    totalSessions: z.number(),
    summary: z.string(),
    sessionSummaries: z.array(
      z.object({ project: z.string(), summary: z.string() }),
    ),
    projectsInvolved: z.array(z.string()),
    technologies: z.array(
      z.object({
        category: z.string(),
        items: z.array(z.string()),
      }),
    ),
  }),
  knowledgeCards: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      explanation: z.string(),
      applicableScenarios: z.string(),
    }),
  ),
  practicalTips: z.array(
    z.object({
      tip: z.string(),
      snippet: z.string().optional(),
      sourceProject: z.string().optional(),
    }),
  ),
  problemsAndSolutions: z.array(
    z.object({
      problem: z.string(),
      cause: z.string(),
      solution: z.string(),
    }),
  ),
  furtherLearning: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
      resources: z
        .array(
          z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
          }),
        )
        .optional(),
    }),
  ),
});

export type Report = z.infer<typeof reportSchema>;

// ─── Config ───

const baseConfigSchema = z.object({
  model: z.string().min(1),
  outputDir: z.string().min(1),
  format: z.enum(["html", "md"]),
  language: z.enum(["auto", "zh", "en"]),
  tavilyApiKey: z.string().optional(),
});

const bedrockConfigSchema = baseConfigSchema.extend({
  provider: z.literal("bedrock"),
  awsRegion: z.string().min(1),
  awsBearerToken: z.string().optional(),
});

const openAICompatibleConfigSchema = baseConfigSchema.extend({
  provider: z.literal("openai-compatible"),
  openaiBaseURL: z.string().url(),
  openaiApiKey: z.string().optional(),
});

export const configSchema = z.discriminatedUnion("provider", [
  bedrockConfigSchema,
  openAICompatibleConfigSchema,
]);

export type Config = z.infer<typeof configSchema>;

// ─── Cache ───

export interface CacheEntry {
  sessionId: string;
  fileHash: string;
  analyzedAt: string;
  result: SessionAnalysis;
}

// ─── Map Result ───

export interface MapResult {
  sessionId: string;
  cwd: string;
  analysis: SessionAnalysis;
}
