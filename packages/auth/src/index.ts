export const roles = [
  "owner",
  "admin",
  "accountant",
  "reviewer",
  "staff",
  "client_readonly"
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "workspace:read",
  "workspace:update",
  "member:invite",
  "business:update",
  "document:upload",
  "document:review",
  "transaction:update",
  "invoice:create",
  "invoice:issue",
  "gst:prepare",
  "gst:lock",
  "tax:prepare",
  "report:export",
  "ai:approve",
  "settings:update"
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, Permission[]> = {
  owner: [...permissions],
  admin: permissions.filter((permission) => permission !== "settings:update"),
  accountant: [
    "workspace:read",
    "business:update",
    "document:upload",
    "document:review",
    "transaction:update",
    "invoice:create",
    "invoice:issue",
    "gst:prepare",
    "gst:lock",
    "tax:prepare",
    "report:export",
    "ai:approve"
  ],
  reviewer: [
    "workspace:read",
    "document:upload",
    "document:review",
    "transaction:update",
    "gst:prepare",
    "tax:prepare",
    "report:export",
    "ai:approve"
  ],
  staff: ["workspace:read", "document:upload", "invoice:create", "report:export"],
  client_readonly: ["workspace:read", "document:upload"]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} cannot perform ${permission}`);
  }
}
