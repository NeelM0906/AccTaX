import { z } from "zod";

export const boundingBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1)
  })
  .strict();

export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const extractionSourceSchema = z
  .object({
    page: z.number().int().positive().optional(),
    rawText: z.string().min(1).optional(),
    boundingBox: boundingBoxSchema.optional(),
    note: z.string().min(1).optional()
  })
  .strict();

export type ExtractionSource = z.infer<typeof extractionSourceSchema>;

export type ExtractedField<T> = {
  value: T | null;
  confidence: number;
  source?: ExtractionSource;
};

export function extractedFieldSchema<TSchema extends z.ZodTypeAny>(
  valueSchema: TSchema
) {
  const schema = z
    .object({
      value: valueSchema.nullable(),
      confidence: z.number().min(0).max(1),
      source: extractionSourceSchema.optional()
    })
    .strict();

  return z.preprocess((input) => {
    if (
      typeof input === "object" &&
      input !== null &&
      !Array.isArray(input) &&
      "value" in input
    ) {
      return input;
    }

    return {
      value: input ?? null,
      confidence: input === null || input === undefined || input === "" ? 0.2 : 0.65,
      source: {
        note: "Provider returned a scalar value without field-level evidence."
      }
    };
  }, schema);
}

export const createExtractedFieldSchema = extractedFieldSchema;
