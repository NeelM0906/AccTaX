# LedgerAI NY/NJ/CT/SF MVP Scope

LedgerAI NY/NJ/CT/SF is a focused first-client port of the supervised accounting workspace. It keeps
the same operating model as the India product: AI extracts and drafts, deterministic rules calculate,
and risky actions stay approval-gated.

## Region Assumption

The live workspace targets New York, New Jersey, Connecticut, and San Francisco. Broader US, Canada,
and Mexico coverage is intentionally deferred until the first-client workflows are validated.

## MVP Modules

- Workspace dashboard for NY/NJ/CT/SF accounting health.
- Document inbox with OCR, review, reject, and re-parse.
- US freelancer/small-business tax cockpit:
  - Schedule C planning basis.
  - Self-employment tax estimate.
  - Federal 1040-ES installment draft.
  - 1099-K threshold monitoring.
  - Business mileage deduction support.
- Launch-region sales-tax cockpit:
  - Direct vs marketplace sales separation.
  - NY/NJ/CT/CA economic nexus monitor.
  - NYC, NY metro, NJ, CT, and San Francisco rate calculations.
  - NY reporting-code awareness.
  - Connecticut special-rate checks for common exceptions.
  - Explicit provider/official-lookup evidence requirement before live collection.

## Compliance Boundaries

- No tax return, sales-tax return, CRA return, or IRS payment is submitted automatically.
- Sales-tax calculations are scoped to launch jurisdictions and still need official lookup/provider
  snapshots before live checkout collection.
- All output is labeled as draft/planning until reviewed by a CPA, EA, bookkeeper, or taxpayer.
- Rule packages must keep source references and effective dates.

## First Client Readiness

The NA port is ready for a first-client demo covering document ingestion, review, invoicing, tax
planning, and NY/NJ/CT/SF sales-tax monitoring. Production onboarding still needs real auth, real
entity setup, and official jurisdiction/rate-provider evidence before paid compliance use.
