import { z } from "zod";

export const auditActionSchema = z.enum([
  "create",
  "update",
  "delete",
  "upload",
  "status_change",
  "ai_suggestion",
  "ai_feedback",
  "human_approval",
  "export",
  "period_lock",
  "period_unlock",
  "integration_credential_update",
  "external_submit_requested"
]);

export type AuditAction = z.infer<typeof auditActionSchema>;

export type AuditEventInput = {
  workspaceId: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export type AuditWriter = (event: AuditEventInput) => Promise<void>;

export function createAuditLogger(write: AuditWriter) {
  return {
    record(event: AuditEventInput): Promise<void> {
      return write(redactAuditEvent(event));
    }
  };
}

export function redactAuditEvent<T extends AuditEventInput>(event: T): T {
  return {
    ...event,
    before: redactSensitive(event.before),
    after: redactSensitive(event.after),
    metadata: redactSensitive(event.metadata) as Record<string, unknown> | undefined
  };
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => {
        if (/pan/i.test(key)) return [key, maskPan(String(nested))];
        if (/gstin/i.test(key)) return [key, maskGstin(String(nested))];
        if (/secret|token|password|credential|apiKey/i.test(key)) return [key, "[redacted]"];
        return [key, redactSensitive(nested)];
      })
    );
  }

  if (typeof value === "string") {
    return value
      .replace(/[A-Z]{5}[0-9]{4}[A-Z]/g, (match) => maskPan(match))
      .replace(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g, (match) => maskGstin(match));
  }

  return value;
}

export function maskPan(pan: string): string {
  return pan.length >= 10 ? `${pan.slice(0, 3)}******${pan.slice(-1)}` : "[masked]";
}

export function maskGstin(gstin: string): string {
  return gstin.length >= 15 ? `${gstin.slice(0, 2)}${gstin.slice(2, 5)}*******${gstin.slice(-3)}` : "[masked]";
}
