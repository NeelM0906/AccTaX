export const documentKinds = [
  "invoice",
  "bill",
  "receipt",
  "bank_statement",
  "other",
  "unknown"
] as const;

export type DocumentKind = (typeof documentKinds)[number];

export const documentLifecycleStatuses = [
  "uploaded",
  "stored",
  "ocr_pending",
  "ocr_complete",
  "classified",
  "extraction_pending",
  "extraction_complete",
  "validation_pending",
  "review_required",
  "approved",
  "posted",
  "archived",
  "failed"
] as const;

export type DocumentLifecycleStatus =
  (typeof documentLifecycleStatuses)[number];

export type DocumentActorType = "system" | "user" | "worker";

export type DocumentLifecycleActor = {
  type: DocumentActorType;
  id?: string;
};

export type DocumentLifecycleEvent = {
  id: string;
  documentId: string;
  fromStatus?: DocumentLifecycleStatus;
  toStatus: DocumentLifecycleStatus;
  actor: DocumentLifecycleActor;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt: string;
};

export type DocumentFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export type DocumentLifecycleRecord = {
  id: string;
  tenantId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  storageKey: string;
  kind: DocumentKind;
  status: DocumentLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  failure?: DocumentFailure;
  classification?: {
    kind: DocumentKind;
    confidence: number;
    classifiedAt: string;
  };
  ocr?: {
    textLength: number;
    pageCount?: number;
    completedAt: string;
  };
  extraction?: {
    provider: string;
    model: string;
    completedAt: string;
  };
  review?: {
    required: boolean;
    reviewerId?: string;
    completedAt?: string;
  };
};

export const allowedDocumentLifecycleTransitions: Record<
  DocumentLifecycleStatus,
  readonly DocumentLifecycleStatus[]
> = {
  uploaded: ["stored", "failed"],
  stored: ["ocr_pending", "classified", "archived", "failed"],
  ocr_pending: ["ocr_complete", "failed"],
  ocr_complete: ["classified", "failed"],
  classified: ["extraction_pending", "review_required", "archived", "failed"],
  extraction_pending: ["extraction_complete", "failed"],
  extraction_complete: ["validation_pending", "review_required", "failed"],
  validation_pending: ["review_required", "approved", "failed"],
  review_required: ["approved", "archived", "failed"],
  approved: ["posted", "archived"],
  posted: ["archived"],
  archived: [],
  failed: ["stored", "archived"]
};

export function canTransitionDocumentLifecycle(
  from: DocumentLifecycleStatus,
  to: DocumentLifecycleStatus
): boolean {
  return allowedDocumentLifecycleTransitions[from].includes(to);
}
