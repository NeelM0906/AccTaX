import { validationIssue, type ValidationResult } from "./errors";
import { isKnownGstStateCode } from "./states";

const GSTIN_CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_BODY_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function calculateGstinCheckDigit(gstinWithoutCheckDigit: string): string {
  const normalized = gstinWithoutCheckDigit.trim().toUpperCase();

  if (normalized.length !== 14 || !GSTIN_BODY_PATTERN.test(normalized)) {
    throw new Error("GSTIN body must be the first 14 normalized GSTIN characters.");
  }

  let factor = 2;
  let sum = 0;

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const character = normalized.charAt(index);
    const codePoint = GSTIN_CHECKSUM_CHARS.indexOf(character);

    if (codePoint < 0) {
      throw new Error(`Invalid GSTIN character: ${character}`);
    }

    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }

  const checkCodePoint = (36 - (sum % 36)) % 36;
  const checkDigit = GSTIN_CHECKSUM_CHARS.charAt(checkCodePoint);

  if (checkDigit.length !== 1) {
    throw new Error("Unable to calculate GSTIN checksum.");
  }

  return checkDigit;
}

export function validateGstin(gstin: string, path = "gstin"): ValidationResult<string> {
  const normalized = gstin.trim().toUpperCase();
  const issues = [];

  if (normalized.length !== 15) {
    issues.push(validationIssue("GSTIN_LENGTH", "GSTIN must contain exactly 15 characters.", path));
  }

  if (normalized.length >= 2 && !isKnownGstStateCode(normalized.slice(0, 2))) {
    issues.push(validationIssue("GSTIN_STATE", "GSTIN starts with an unknown GST state code.", path));
  }

  if (!GSTIN_PATTERN.test(normalized)) {
    issues.push(
      validationIssue(
        "GSTIN_FORMAT",
        "GSTIN must match the state code, PAN, entity, Z, and checksum format.",
        path
      )
    );
  } else {
    const expectedCheckDigit = calculateGstinCheckDigit(normalized.slice(0, 14));
    const actualCheckDigit = normalized.charAt(14);

    if (actualCheckDigit !== expectedCheckDigit) {
      issues.push(
        validationIssue(
          "GSTIN_CHECKSUM",
          `GSTIN checksum is invalid; expected ${expectedCheckDigit}.`,
          path
        )
      );
    }
  }

  return {
    valid: issues.length === 0,
    value: issues.length === 0 ? normalized : undefined,
    issues
  };
}

export function isValidGstin(gstin: string): boolean {
  return validateGstin(gstin).valid;
}

