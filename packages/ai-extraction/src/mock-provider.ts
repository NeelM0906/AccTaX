import type {
  AiExtractionProvider,
  ExtractionProviderRequest,
  ExtractionProviderResponse
} from "./provider";
import {
  ExtractionProviderError
} from "./provider";
import { safeJsonParse } from "./json";

type MockPayload<T> =
  | unknown
  | string
  | ((request: ExtractionProviderRequest<T>) => unknown | string)
  | ((request: ExtractionProviderRequest<T>) => Promise<unknown | string>);

export type MockExtractionProviderOptions = {
  name?: string;
  model?: string;
  defaultResponse?: MockPayload<unknown>;
  responses?: Partial<Record<string, MockPayload<unknown>>>;
};

export class MockExtractionProvider implements AiExtractionProvider {
  readonly name: string;
  readonly model: string;

  private readonly defaultResponse?: MockPayload<unknown>;
  private readonly responses: Partial<Record<string, MockPayload<unknown>>>;

  constructor(options: MockExtractionProviderOptions = {}) {
    this.name = options.name ?? "mock";
    this.model = options.model ?? "mock-extraction-v1";
    this.defaultResponse = options.defaultResponse;
    this.responses = options.responses ?? {};
  }

  async extract<T>(
    request: ExtractionProviderRequest<T>
  ): Promise<ExtractionProviderResponse<T>> {
    const payload = this.responses[request.documentKind] ?? this.defaultResponse;

    if (payload === undefined) {
      throw new ExtractionProviderError(
        this.name,
        `No mock extraction response configured for ${request.documentKind}`
      );
    }

    const output =
      typeof payload === "function" ? await payload(request) : payload;
    const rawOutput = serializeMockOutput(this.name, output);

    const parsed = safeJsonParse<T>(rawOutput, {
      schema: request.schema,
      maxRepairAttempts: request.parse?.maxRepairAttempts
    });

    if (!parsed.ok) {
      throw new ExtractionProviderError(
        this.name,
        "Mock extraction response failed JSON parsing or schema validation",
        parsed
      );
    }

    return {
      data: parsed.data,
      rawOutput,
      provider: this.name,
      model: this.model,
      metadata: {
        receivedAt: new Date().toISOString(),
        retries: parsed.metadata.repairAttempts,
        parse: parsed.metadata
      }
    };
  }
}

function serializeMockOutput(providerName: string, output: unknown): string {
  if (typeof output === "string") {
    return output;
  }

  const serialized = JSON.stringify(output);
  if (serialized === undefined) {
    throw new ExtractionProviderError(
      providerName,
      "Mock extraction response is not JSON serializable"
    );
  }

  return serialized;
}
