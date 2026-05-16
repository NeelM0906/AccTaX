import type { DocumentKind } from "./lifecycle";

export type DocumentClassificationInput = {
  fileName?: string;
  contentType?: string;
  textSample?: string;
};

export type DocumentClassificationResult = {
  kind: DocumentKind;
  confidence: number;
  reason: string;
  requiresHumanReview: boolean;
};

export function classifyDocumentStub(
  input: DocumentClassificationInput
): DocumentClassificationResult {
  const evidence = [
    input.fileName ?? "",
    input.contentType ?? "",
    input.textSample ?? ""
  ]
    .join("\n")
    .toLowerCase();

  if (
    evidence.includes("bank statement") ||
    evidence.includes("bank-statement") ||
    evidence.includes("bank_statement") ||
    (evidence.includes("ifsc") &&
      evidence.includes("balance") &&
      (evidence.includes("debit") || evidence.includes("credit"))) ||
    (evidence.includes("balance") &&
      evidence.includes("debit") &&
      evidence.includes("credit") &&
      evidence.includes("description"))
  ) {
    return result("bank_statement", 0.72, "Matched bank statement keywords");
  }

  if (
    evidence.includes("tax invoice") ||
    evidence.includes("invoice no") ||
    evidence.includes("invoice number") ||
    (evidence.includes("invoice") &&
      (evidence.includes("bill to") ||
        evidence.includes("subtotal") ||
        evidence.includes("payment terms") ||
        evidence.includes("due date")))
  ) {
    return result("invoice", 0.7, "Matched invoice keywords");
  }

  if (
    evidence.includes("receipt") &&
    !evidence.includes("due on receipt") &&
    !evidence.includes("payment terms")
  ) {
    return result("receipt", 0.64, "Matched receipt keywords");
  }

  if (evidence.includes("paid by") || evidence.includes("payment receipt")) {
    return result("receipt", 0.64, "Matched receipt keywords");
  }

  if (evidence.includes("bill to") || evidence.includes("bill number")) {
    return result("bill", 0.62, "Matched bill keywords");
  }

  return result("unknown", 0.2, "No deterministic classification matched");
}

function result(
  kind: DocumentKind,
  confidence: number,
  reason: string
): DocumentClassificationResult {
  return {
    kind,
    confidence,
    reason,
    requiresHumanReview: confidence < 0.8
  };
}
