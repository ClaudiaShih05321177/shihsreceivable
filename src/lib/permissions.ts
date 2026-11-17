type Role = "admin" | "member";

export function permissionsFor(roles: readonly Role[]) {
  const isAdmin = roles.includes("admin");
  const isMember = isAdmin || roles.includes("member");
  return { isAdmin, isMember, canView: isMember, canCreate: isMember, canEdit: isMember, canRecordPayment: isAdmin, canDelete: isAdmin, canManageTeam: isAdmin, canManageBonusRates: isAdmin };
}

/** 已有收款紀錄的帳款只有管理員能修改（使用者不能刪除收款，改了會對不上）。 */
export function canEditInvoice(me: { isAdmin: boolean }, invoice: { payments: unknown[] }) {
  return me.isAdmin || invoice.payments.length === 0;
}
/** 一般使用者只能看應收帳款、工商進度、客戶資料（含明細頁）。 */
export const MEMBER_PAGES = ["/invoices", "/filings", "/customers"] as const;
export function canManageFactoryProgress(me: { isAdmin: boolean; staffCode?: string | null }) {
  return me.isAdmin || me.staffCode?.trim().toUpperCase() === "MN";
}
export function canSeePage(isAdmin: boolean, pathname: string, staffCode?: string | null) {
  return isAdmin || ((pathname === "/factory" || pathname === "/factory-customers") && canManageFactoryProgress({ isAdmin, staffCode: staffCode ?? null })) || MEMBER_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
