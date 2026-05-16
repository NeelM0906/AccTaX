import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button, Input } from "@ledgerai/ui";
import { StatusChip } from "@/components/status-chip";
import { approveDocument, rejectDocument, rerunDocumentExtraction } from "@/app/app/actions";
import { getDocumentReviewData } from "@/lib/server/workspace";

export type DocumentReviewProps = {
  params: Promise<{ documentId: string }>;
  basePath: "/app" | "/na";
};

export async function DocumentReview({ params, basePath }: DocumentReviewProps) {
  const { documentId } = await params;
  const data = await getDocumentReviewData(documentId);
  if (!data) {
    return <div className="p-8 text-sm text-zinc-600">Document not found.</div>;
  }
  const { document, extraction, fields } = data;
  const metadata = metadataObject(document.metadata);
  const ocr = metadataObject(metadata.ocr);
  const ocrWarnings = stringArray(ocr.warnings);
  const fileUrl = `/api/documents/${document.id}/file`;
  const isImage = document.mimeType.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf";
  const reviewHref = `${basePath}/vault/${document.id}`;
  const vaultHref = `${basePath}/vault`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-8 py-4">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-medium text-zinc-950">{document.originalFilename}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{stringValue(ocr.provider) ?? "ocr pending"}</span>
            <span>Pages {stringValue(ocr.pageCount) ?? "0"}</span>
            <span>Score {stringValue(ocr.textScore) ?? "0"}</span>
            <StatusChip status={document.status.replaceAll("_", " ").toLowerCase()} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={rerunDocumentExtraction}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="returnTo" value={reviewHref} />
            <Button type="submit" variant="secondary">
              <RotateCcw className="size-4" />
              Re-run extraction
            </Button>
          </form>
          <form action={rejectDocument}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="returnTo" value={vaultHref} />
            <Button type="submit" variant="destructive">
              <XCircle className="size-4" />
              Reject
            </Button>
          </form>
        </div>
      </header>

      <main className="grid flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_32rem]">
        <section className="overflow-auto bg-zinc-50 p-6">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {isPdf ? (
              <iframe src={fileUrl} title={document.originalFilename} className="h-[78vh] w-full bg-white" />
            ) : isImage ? (
              <img src={fileUrl} alt={document.originalFilename} className="max-h-[78vh] w-full object-contain" />
            ) : (
              <div className="flex aspect-[1/1.35] items-center justify-center p-6 text-center text-sm text-zinc-600">
                Preview is unavailable for this file type. The original remains stored privately.
              </div>
            )}
          </div>
          {ocrWarnings.length > 0 ? (
            <div className="mx-auto mt-4 max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-medium">OCR warnings</div>
              {ocrWarnings.map((warning) => <div key={warning}>{warning}</div>)}
            </div>
          ) : null}
        </section>

        <aside className="overflow-auto border-l border-zinc-200 p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-zinc-950">Extracted fields</div>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Edit incorrect values, re-run OCR, reject the document, or approve and post only after review.
            </p>
          </div>

          <form action={approveDocument} className="space-y-4">
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="returnTo" value={vaultHref} />
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
              {fields.map((field) => (
                <label key={field.id} className="grid gap-2 p-3">
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-zinc-950">{field.fieldPath}</span>
                      <span className="block text-xs text-zinc-500">Confidence {Math.round(Number(field.confidence ?? 0) * 100)}%</span>
                    </span>
                    <StatusChip status={field.validationStatus.replaceAll("_", " ").toLowerCase()} />
                  </span>
                  <Input name={`field:${field.fieldPath}`} defaultValue={jsonDisplay(field.reviewerValue ?? field.value)} aria-label={field.fieldPath} />
                </label>
              ))}
              {fields.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500">No fields have been extracted yet. Re-run extraction to parse this document.</div>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
              Extraction status: {extraction?.status.replaceAll("_", " ").toLowerCase() ?? "pending"}.
              Approval creates normalized accounting records and audit events.
            </div>

            <Button type="submit" className="w-full">
              <CheckCircle2 className="size-4" />
              Approve and post
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}

function jsonDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "toString" in value && value.constructor?.name === "Decimal") return String(value);
  return JSON.stringify(value);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
