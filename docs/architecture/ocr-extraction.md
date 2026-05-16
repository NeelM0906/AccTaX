# OCR and Extraction Pipeline

Document ingestion uses a layered OCR pipeline:

1. Native text extraction for text files, CSVs, and text PDFs.
2. High-resolution PDF rasterization for scanned PDFs.
3. Local Tesseract OCR as the offline baseline.
4. OpenAI vision OCR only when a valid OpenAI API key is configured.
5. Candidate scoring to choose the strongest OCR text rather than blindly accepting one provider.
6. Evidence-only extraction. Fallback extraction must never insert seeded workspace names, GSTINs,
   tax IDs, or amounts that are not visible in OCR text.

The fallback extractor is intentionally conservative:

- Missing GSTIN, HSN/SAC, place-of-supply, or tax-ID values are stored as null and marked
  `NEEDS_REVIEW`.
- Generic invoices outside India can still extract supplier, buyer, invoice number, date, currency,
  subtotal, and total without inventing GST fields.
- Re-run and reject actions are available at both the top of the review page and below the field
  table so incorrect parses can be corrected without posting.

For production, this pipeline should add a paid document-OCR provider adapter such as Azure Document
Intelligence, Google Document AI, AWS Textract, Mindee, or Veryfi. Provider responses should be
stored with page text, confidence, source snippets, request IDs, and timestamps.
