// Team roles, from most to least power. Clients have no role.
export const staffRoles = ["owner", "admin", "support"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const staffRoleLabel: Record<StaffRole, string> = {
  owner: "Dono",
  admin: "Admin",
  support: "Suporte",
};

/** What each part of the panel needs. */
// grant-access frees emails to sign up; manage-access also blocks and unblocks accounts.
export type StaffPermission = "manage-team" | "manage-access" | "grant-access" | "enter-accounts";

const permissions: Record<StaffRole, readonly StaffPermission[]> = {
  owner: ["manage-team", "manage-access", "grant-access", "enter-accounts"],
  admin: ["manage-access", "grant-access", "enter-accounts"],
  support: ["grant-access", "enter-accounts"],
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role != null && (staffRoles as readonly string[]).includes(role);
}

export function can(role: string | null | undefined, permission: StaffPermission) {
  if (!isStaffRole(role)) return false;
  return permissions[role].includes(permission);
}

// Auth paths a staff member may not use while inside a client's account: only the client
// changes the password, the email or two-factor, or deletes the account.
const clientOnlyPaths = [
  "/change-password",
  "/change-email",
  "/delete-user",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
];

export function isClientOnlyPath(path: string) {
  return clientOnlyPaths.includes(path) || path.startsWith("/two-factor/");
}

/** Panel tabs in display order, each shown only to roles with its permission. */
export type AdminTab = "acessos" | "contas" | "equipe";
const tabPermission: Record<AdminTab, StaffPermission> = {
  acessos: "grant-access",
  contas: "enter-accounts",
  equipe: "manage-team",
};

export function adminTabsFor(role: string | null | undefined) {
  return (Object.keys(tabPermission) as AdminTab[]).filter((tab) => can(role, tabPermission[tab]));
}
