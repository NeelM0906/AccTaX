import { safeJsonParse } from "./json";
import type {
  AiExtractionProvider,
  ExtractionProviderRequest,
  ExtractionProviderResponse
} from "./provider";
import { ExtractionProviderError } from "./provider";

export type OpenAiExtractionProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  name?: string;
  timeoutMs?: number;
};

type OpenAiResponsesPayload = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export class OpenAiExtractionProvider implements AiExtractionProvider {
  readonly name: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAiExtractionProviderOptions) {
    this.name = options.name ?? "openai";
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async extract<T>(
    request: ExtractionProviderRequest<T>
  ): Promise<ExtractionProviderResponse<T>> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          max_output_tokens: 3_000,
          input: [
            {
              role: "system",
              content:
                "Extract accounting data as strict JSON only. Do not include markdown, commentary, or invented values."
            },
            {
              role: "user",
              content: `${request.prompt ?? ""}\n\nDocument kind: ${request.documentKind}\n\nDocument text:\n${request.documentText}`
            }
          ]
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExtractionProviderError(
          this.name,
          `OpenAI extraction request timed out after ${this.timeoutMs}ms`,
          { timeoutMs: this.timeoutMs }
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await response.json().catch(() => ({}))) as OpenAiResponsesPayload & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new ExtractionProviderError(
        this.name,
        payload.error?.message ?? `OpenAI request failed with ${response.status}`,
        payload
      );
    }

    const rawOutput = extractResponseText(payload);
    const parsed = safeJsonParse<T>(rawOutput, {
      schema: request.schema,
      maxRepairAttempts: request.parse?.maxRepairAttempts
    });

    if (!parsed.ok) {
      throw new ExtractionProviderError(
        this.name,
        "OpenAI extraction response failed JSON parsing or schema validation",
        parsed
      );
    }

    return {
      data: parsed.data,
      rawOutput,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: payload.usage?.input_tokens,
        outputTokens: payload.usage?.output_tokens,
        totalTokens: payload.usage?.total_tokens
      },
      metadata: {
        requestId: payload.id,
        receivedAt: new Date().toISOString(),
        retries: parsed.metadata.repairAttempts,
        parse: parsed.metadata
      }
    };
  }
}

function extractResponseText(payload: OpenAiResponsesPayload): string {
  if (payload.output_text) return payload.output_text;

  const content = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter((text): text is string => Boolean(text));

  const text = content?.join("\n").trim();
  if (!text) {
    throw new ExtractionProviderError("openai", "OpenAI response did not include output text", payload);
  }

  return text;
}
