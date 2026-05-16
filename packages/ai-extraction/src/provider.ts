import type { z } from "zod";
import type { SafeJsonParseMetadata } from "./json";

export type ExtractionDocumentKind =
  | "invoice"
  | "bill"
  | "receipt"
  | "bank_statement"
  | "unknown";

export type ExtractionProviderRequest<T> = {
  documentKind: ExtractionDocumentKind;
  documentText: string;
  schema: z.ZodType<T>;
  prompt?: string;
  metadata?: Record<string, string | number | boolean | null>;
  parse?: {
    maxRepairAttempts?: number;
  };
};

export type ExtractionProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ExtractionProviderResponse<T> = {
  data: T;
  rawOutput: string;
  provider: string;
  model: string;
  usage?: ExtractionProviderUsage;
  metadata: {
    requestId?: string;
    receivedAt: string;
    retries: number;
    parse: SafeJsonParseMetadata;
  };
};

export interface AiExtractionProvider {
  readonly name: string;
  extract<T>(
    request: ExtractionProviderRequest<T>
  ): Promise<ExtractionProviderResponse<T>>;
}

export class ExtractionProviderError extends Error {
  readonly provider: string;
  readonly details?: unknown;

  constructor(provider: string, message: string, details?: unknown) {
    super(message);
    this.name = "ExtractionProviderError";
    this.provider = provider;
    this.details = details;
  }
}
