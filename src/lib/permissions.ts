type Role = "admin" | "member";

export function permissionsFor(roles: readonly Role[]) {
  const isAdmin = roles.includes("admin");
  const isMember = isAdmin || roles.includes("member");
  return { isAdmin, isMember, canView: isMember, canCreate: isMember, canEdit: isAdmin, canRecordPayment: isAdmin, canDelete: isAdmin, canManageTeam: isAdmin, canManageBonusRates: isAdmin };
}
/** 一般使用者只能看應收帳款、工商進度、客戶資料（含明細頁）。 */
export const MEMBER_PAGES = ["/invoices", "/filings", "/customers"] as const;
export function canSeePage(isAdmin: boolean, pathname: string) {
  return isAdmin || MEMBER_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
