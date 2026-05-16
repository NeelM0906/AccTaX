export type OcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  boundingBox?: OcrBoundingBox;
};

export type OcrPage = {
  pageNumber: number;
  text: string;
  confidence?: number;
  words?: OcrWord[];
};

export type OcrInput = {
  documentId: string;
  contentType: string;
  fileName?: string;
  body: Uint8Array;
};

export type OcrResult = {
  text: string;
  pages: OcrPage[];
  provider: string;
  model?: string;
  completedAt: string;
};

export interface OcrAdapter {
  readonly name: string;
  recognize(input: OcrInput): Promise<OcrResult>;
}

export class OcrUnavailableError extends Error {
  constructor(adapterName: string, message = "OCR adapter is not configured") {
    super(`${adapterName}: ${message}`);
    this.name = "OcrUnavailableError";
  }
}
