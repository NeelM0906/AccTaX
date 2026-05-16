import type { z } from "zod";

export type JsonRepairAction =
  | "initial"
  | "strip_markdown_fence"
  | "extract_json_payload"
  | "remove_trailing_commas";

export type JsonParseAttempt = {
  action: JsonRepairAction;
  ok: boolean;
  error?: string;
};

export type SafeJsonParseMetadata = {
  attempts: JsonParseAttempt[];
  maxRepairAttempts: number;
  repairAttempts: number;
  repaired: boolean;
  repairsApplied: JsonRepairAction[];
  schemaValidated: boolean;
};

export type SafeJsonParseSuccess<T> = {
  ok: true;
  data: T;
  metadata: SafeJsonParseMetadata;
};

export type SafeJsonParseFailure = {
  ok: false;
  error: string;
  metadata: SafeJsonParseMetadata;
  data?: unknown;
};

export type SafeJsonParseResult<T> =
  | SafeJsonParseSuccess<T>
  | SafeJsonParseFailure;

export type SafeJsonParseOptions<T> = {
  schema?: z.ZodType<T>;
  maxRepairAttempts?: number;
};

type JsonRepair = {
  action: Exclude<JsonRepairAction, "initial">;
  apply: (input: string) => string;
};

const DEFAULT_MAX_REPAIR_ATTEMPTS = 2;

export function safeJsonParse<T = unknown>(
  input: string,
  options: SafeJsonParseOptions<T> = {}
): SafeJsonParseResult<T> {
  const maxRepairAttempts =
    options.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS;
  const attempts: JsonParseAttempt[] = [];
  const repairsApplied: JsonRepairAction[] = [];
  const schemaValidated = Boolean(options.schema);

  const buildMetadata = (
    repairAttempts: number
  ): SafeJsonParseMetadata => ({
    attempts,
    maxRepairAttempts,
    repairAttempts,
    repaired: repairsApplied.length > 0,
    repairsApplied,
    schemaValidated
  });

  const attempt = (
    action: JsonRepairAction,
    candidate: string,
    repairAttempts: number
  ): SafeJsonParseResult<T> | null => {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!options.schema) {
        attempts.push({ action, ok: true });
        return {
          ok: true,
          data: parsed as T,
          metadata: buildMetadata(repairAttempts)
        };
      }

      const schemaResult = options.schema.safeParse(parsed);
      if (!schemaResult.success) {
        const error = schemaResult.error.issues
          .map(
            (issue: z.ZodIssue) =>
              `${issue.path.join(".") || "<root>"}: ${issue.message}`
          )
          .join("; ");
        attempts.push({ action, ok: false, error });
        return {
          ok: false,
          error,
          data: parsed,
          metadata: buildMetadata(repairAttempts)
        };
      }

      attempts.push({ action, ok: true });
      return {
        ok: true,
        data: schemaResult.data,
        metadata: buildMetadata(repairAttempts)
      };
    } catch (error) {
      attempts.push({
        action,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  };

  const initialCandidate = input.trim();
  const initial = attempt("initial", initialCandidate, 0);
  if (initial?.ok) {
    return initial;
  }

  let candidate = initialCandidate;
  let repairAttempts = 0;
  let lastFailure: SafeJsonParseFailure | null =
    initial && !initial.ok ? initial : null;

  const repairs: JsonRepair[] = [
    {
      action: "strip_markdown_fence",
      apply: stripMarkdownFence
    },
    {
      action: "extract_json_payload",
      apply: extractJsonPayload
    },
    {
      action: "remove_trailing_commas",
      apply: removeTrailingCommas
    }
  ];

  for (const repair of repairs) {
    if (repairAttempts >= maxRepairAttempts) {
      break;
    }

    const repairedCandidate = repair.apply(candidate);
    if (repairedCandidate === candidate) {
      continue;
    }

    candidate = repairedCandidate;
    repairAttempts += 1;
    repairsApplied.push(repair.action);

    const result = attempt(repair.action, candidate, repairAttempts);
    if (result?.ok) {
      return result;
    }

    if (result && !result.ok) {
      lastFailure = result;
      break;
    }
  }

  const lastAttempt = attempts.at(-1);
  return (
    lastFailure ?? {
      ok: false,
      error: lastAttempt?.error ?? "Unable to parse JSON",
      metadata: buildMetadata(repairAttempts)
    }
  );
}

function stripMarkdownFence(input: string): string {
  const match = input.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? input;
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, "$1");
}

function extractJsonPayload(input: string): string {
  const starts = [input.indexOf("{"), input.indexOf("[")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  const start = starts[0];
  if (start === undefined) {
    return input;
  }

  const opening = input[start];
  if (opening !== "{" && opening !== "[") {
    return input;
  }

  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const character = input[index] ?? "";

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === opening) {
      depth += 1;
    }

    if (character === closing) {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1).trim();
      }
    }
  }

  return input;
}
