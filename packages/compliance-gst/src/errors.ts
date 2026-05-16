import { GST_RULE_VERSION } from "./rule-version";

export type ValidationSeverity = "error" | "warning";

export interface ComplianceValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  path?: string;
  ruleVersion: string;
}

export interface ValidationResult<T = string> {
  valid: boolean;
  value?: T;
  issues: ComplianceValidationIssue[];
}

export class ComplianceValidationError extends Error {
  readonly issues: ComplianceValidationIssue[];

  constructor(message: string, issues: ComplianceValidationIssue[]) {
    super(message);
    this.name = "ComplianceValidationError";
    this.issues = issues;
  }
}

export function validationIssue(
  code: string,
  message: string,
  path?: string,
  severity: ValidationSeverity = "error"
): ComplianceValidationIssue {
  return {
    code,
    message,
    path,
    severity,
    ruleVersion: GST_RULE_VERSION.id
  };
}

export function hasValidationErrors(issues: ComplianceValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function throwIfInvalid(message: string, issues: ComplianceValidationIssue[]): void {
  if (hasValidationErrors(issues)) {
    throw new ComplianceValidationError(message, issues);
  }
}

