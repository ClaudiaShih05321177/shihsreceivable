/** 財稅簽證的三位簽證會計師。 */
export const AUDITORS = ["秉誠", "詮益", "眾智"] as const;
export type Auditor = (typeof AUDITORS)[number];

type AuditLike = { auditor: string | null; items: unknown; amount: number | string; payments?: { amount: number | string }[] | null };

/** 財稅簽證金額（items 中的「財稅簽證」）。 */
export const auditFee = (inv: AuditLike) => Number((inv.items as Record<string, unknown> | null)?.["財稅簽證"] ?? 0) || 0;

/** 依會計師彙總有財稅簽證費用的帳款；未指定會計師者另列。 */
export function auditSummary<T extends AuditLike>(invoices: T[]) {
  const groups = [...AUDITORS, "未指定"].map((name) => ({ name, rows: [] as T[], total: 0 }));
  for (const inv of invoices) {
    const fee = auditFee(inv);
    if (fee <= 0) continue;
    const g = groups.find((x) => x.name === inv.auditor) ?? groups[groups.length - 1]!;
    g.rows.push(inv);
    g.total += fee;
  }
  return groups;
}
