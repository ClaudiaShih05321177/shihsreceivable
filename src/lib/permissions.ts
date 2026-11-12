type Role = "admin" | "member";

export function permissionsFor(roles: readonly Role[]) {
  const isAdmin = roles.includes("admin");
  const isMember = isAdmin || roles.includes("member");
  return { isAdmin, isMember, canView: isMember, canCreate: isMember, canEdit: isAdmin, canRecordPayment: isAdmin, canDelete: isAdmin, canManageTeam: isAdmin, canManageBonusRates: isAdmin };
}