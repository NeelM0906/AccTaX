# First Client Runbook

Last reviewed: 2026-05-15

LedgerAI India is now a wired first-client MVP. It is still a supervised accounting workspace, not
a statutory filing system: outputs are drafts until a human reviewer approves them and any official
submission happens outside the app or through a future explicitly approved integration.

## URLs

- Public tunnel: `https://hmm.ngrok.dev/app/dashboard`
- Local app: `http://localhost:3001/app/dashboard`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

The local Next server uses port `3001` because another process is occupying `3000`.

## Services

From the repo root:

```bash
docker compose up -d postgres redis minio
docker compose ps
pnpm dev
```

Configured services:

- `postgres`: PostgreSQL 16, database/user/password `ledgerai`, exposed on `5432`.
- `redis`: Redis 7, exposed on `6379`.
- `minio`: S3-compatible local service, API on `9000`, console on `9001`.

## Env

The OpenAI key is stored locally in `.env.local` and `apps/web/.env.local` with `600` permissions.
Do not print or commit either file. Current AI settings:

- `AI_PROVIDER=openai`
- `OPENAI_ALLOWED_MODELS=*`
- `OPENAI_DEFAULT_MODEL=gpt-4.1-mini`

If live model extraction fails, document upload falls back to deterministic heuristic extraction and
records the AI run failure for review.

## Functional Surface

- `/app/onboarding`: saves business, PAN, GSTIN, filing frequency, tax profile, and regime flags.
- `/app/dashboard`: DB-backed health cards, financial pulse, review feed, and AI suggestions.
- `/app/inbox`: uploads files to private local storage, classifies them, creates extraction fields,
  and routes them to review.
- `/app/inbox/[documentId]`: reviewer edits fields, approves, and posts invoices, bills, generic
  transactions, or bank-statement rows.
- `/app/invoices/new`: creates issued GST invoices, computes CGST/SGST/IGST, posts ledger
  transactions, and adds GSTR-1 candidates.
- `/app/invoices/[invoiceId]/print`: printable invoice/PDF-by-browser route.
- `/app/gst`: GSTR-1/GSTR-3B draft summaries, validation cards, JSON/CSV export, external filed
  marker, and period lock.
- `/app/taxes`: 44ADA planning, presumptive income, and old/new regime comparison.
- `/app/reports`: working-paper exports for GST, transactions, invoices, and tax planning.
- `/app/clients`: persisted collaborator invites and document request tasks.
- `/app/settings`: persisted integration labels, role view, audit summary, and AI config view.

Download routes:

- `/api/exports/transactions.csv`
- `/api/exports/gst.json`
- `/api/exports/gst.csv`
- `/api/exports/tax-planning.json`
- `/api/exports/invoice-pack.csv`

## Still Guarded

These remain deliberately non-live:

- Direct GST filing, GSP API submit, GSTIN API verification, e-invoice IRN generation, and e-waybill
  generation.
- Real email delivery and payment-link creation. Invoice email currently queues a review task.
- Production authentication. The current workspace is a seeded first-client workspace.
- MinIO/S3 upload adapter in the UI; current upload storage is private local filesystem.
- Official ITR filing and statutory submission flows.

## Demo Flow

1. Open `https://hmm.ngrok.dev/app/dashboard`.
2. Review the seeded workspace metrics and AI suggestions.
3. Upload a text/CSV invoice, bill, receipt, or bank statement in `/app/inbox`.
4. Open the uploaded document, review extracted fields, then approve and post.
5. Create a GST invoice in `/app/invoices/new`; confirm it appears in invoices, transactions, and
   the GST cockpit.
6. Open the printable invoice route from the invoice register.
7. Export GST JSON, GST CSV, transactions CSV, invoice pack CSV, and tax planning JSON from reports.
8. Save onboarding changes, create a document request, and add an integration label to verify
   persistence and audit logging.

Use precise language with clients: "draft", "candidate", "planning", "reviewed", "posted", and
"marked externally filed". Do not say the app directly files returns or submits statutory payloads.

## Verification

Current validation commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Browser smoke verified:

- App routes render with page headings.
- Invoice creation and print route.
- GST, transaction, invoice-pack, and tax-planning exports.
- Bank-statement CSV upload, review, and posting.
- ngrok dashboard returns HTTP 200.

## Guardrails

- Do not upload real client documents to live AI providers without explicit client approval.
- Do not expose real PAN/GSTIN credentials, OTPs, portal screenshots, or bank statements through a
  public tunnel.
- Treat all GST and tax outputs as working papers until reviewed by the taxpayer, CA, or authorized
  reviewer.
- For any future live submit flow, require payload preview, deterministic validation, reviewer
  approval, audit log, idempotency key, provider response capture, and an external acknowledgement
  reference.
