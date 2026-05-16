# Compliance Rule Sources

Rules in this repo must include version metadata, effective dates, source notes, and tests.
Historical calculations should retain the rule version used at the time.

## GST

- GSTR-1 is treated as the outward supplies statement.
- GSTR-3B is treated as the summary return for GST liability and ITC reporting.
- QRMP users can file quarterly while paying monthly; IFF is relevant for B2B invoice details in
  the first two months of a quarter.
- E-invoicing threshold is modeled as aggregate turnover exceeding Rs 5 crore from 1 August 2023.
- E-way bill threshold is modeled as goods consignment value exceeding Rs 50,000.

## Income Tax

- AY 2026-27 new-regime slabs are represented in `packages/compliance-income-tax`.
- Section 44AD threshold is Rs 2 crore, extended to Rs 3 crore when cash/non-prescribed receipts
  do not exceed 5%.
- Section 44ADA threshold is Rs 50 lakh, extended to Rs 75 lakh when cash/non-prescribed receipts
  do not exceed 5%.
- 44ADA deemed profit is modeled at 50% of gross professional receipts.
- Form 10-IEA warnings are surfaced for business/profession users when opting out of the default
  new regime is relevant.

## Operating Rule

AI may explain and suggest, but deterministic rule packages calculate and validate compliance
numbers.
