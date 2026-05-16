# Codex Execution Plan

North star: build a polished India-first accounting workspace where AI acts like a supervised
junior accountant.

## Engineering Rules

- TypeScript-first.
- PostgreSQL and Prisma.
- Zod validation for inputs and AI outputs.
- Deterministic validators after every AI extraction.
- Audit every source record, calculation, AI suggestion, and approval.
- Version every compliance rule.
- Write tests for compliance functions.
- Do not copy GPL, AGPL, or no-license code into the commercial codebase.

## Build Order

1. Monorepo foundation, app shell, database schema, config, audit, RBAC.
2. Business onboarding with PAN/GSTIN awareness.
3. Document inbox, storage, lifecycle, extraction schemas, and review UI.
4. Accounting records and posting helpers.
5. GST invoice builder.
6. GST draft builders and cockpit.
7. GSTR-2A/2B-style uploaded-data reconciliation.
8. Freelancer income-tax planning.
9. Workspace integrations and client portal.
10. AI junior accountant with approval-required mutation actions.
11. Advanced GST integrations through GSP/e-invoice/e-waybill adapters.
