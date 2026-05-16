# LedgerAI India Architecture

LedgerAI India is an India-first AI accounting workspace for freelancers, small businesses,
independent enterprises, and accountants. The product is built as a supervised operating layer:
AI extracts and suggests, deterministic rule packages calculate and validate, and humans approve
compliance-critical mutations.

## Core Flow

```text
Documents
  -> AI extraction
  -> Human review
  -> Deterministic validators
  -> Accounting records
  -> GST / tax drafts
  -> Human approval
  -> Export or explicit external submission
```

The AI stack is not the compliance engine. GST and income-tax outputs must be produced by
versioned TypeScript packages with fixtures and tests.

## Monorepo

- `apps/web`: Next.js App Router workspace UI.
- `packages/db`: Prisma schema and client export for PostgreSQL.
- `packages/ui`: Shared Tailwind/shadcn-style UI primitives.
- `packages/config`: Zod environment validation and shared India formatting helpers.
- `packages/auth`: RBAC roles and permissions.
- `packages/audit`: Audit event helper and sensitive-data redaction.
- `packages/compliance-gst`: Versioned GST validators, calculators, and return builders.
- `packages/compliance-income-tax`: Versioned AY 2026-27 planning and presumptive-tax logic.
- `packages/ai-extraction`: Strict Zod extraction schemas, providers, prompts, validators.
- `packages/documents`: Document lifecycle, private storage adapter, OCR/classification interfaces.
- `packages/accounting`: Chart of accounts, categories, and posting helpers.

## Trust Boundaries

- Every workspace-scoped table includes `workspaceId`.
- RBAC is represented by explicit roles: owner, admin, accountant, reviewer, staff, read-only
  CA/client.
- Audit events cover create/update/delete, uploads, AI suggestions, human approvals, exports,
  period locks, credential updates, and external submission requests.
- Document storage is private by default. Signed URL behavior belongs in storage adapters, not UI.
- PAN, GSTIN, credentials, tokens, and secrets are redacted before audit/log persistence.

## Integration Strategy

Phase 1 is manual import/export: PDF/CSV/Excel, GST portal JSON/Excel, bank statement upload,
email send placeholders. Phase 2 adds Gmail/Drive/client portal/payment links. Phase 3 adds GSP,
GSTIN verification, e-invoice, e-waybill, GSTR-2A/2B reconciliation, Account Aggregator, and UPI
Autopay.

No direct filing or external API submit may occur without an explicit reviewed approval flow.
