import type { FeeItems } from "./receivables";

export type BonusRow = { id: string; customer_id?: string; customer_name: string; customer_code: string | null; staff_code: string | null; period_year: number | null; period_month: number | null; items: FeeItems; amount: number; paid_amount: number };
export type BonusCustomer = { id: string; name: string; customer_code: string | null; staff_code: string | null; billing_type: string; bookkeeping_fee: number; annual_extra_rate: number | null };
export type BonusData = { staff: string[]; rows: BonusRow[]; customers?: BonusCustomer[] };

export const BONUS_THRESHOLD = 200000;
export const SETTLEMENT_THRESHOLD = 100000;
export const BONUS_RATE = 0.3;
/** 結算費在表單中的欄位代碼（顯示為「結算費」）。 */
export const SETTLEMENT_KEY = "股利2代";
export const ANNUAL_EXTRA_KEY = "年度加收";

/** 記帳費獎金：合計超過 20 萬元的部分 × 30%。 */
export function bookkeeperBonus(total: number): number {
  return Math.round(Math.max(0, total - BONUS_THRESHOLD) * BONUS_RATE);
}
/** 結算費獎金：1 月超過 10 萬元的部分 × 30%；其他月份（註銷等單筆）直接 × 30%。 */
export function settlementBonus(total: number, month: number): number {
  return Math.round((month === 1 ? Math.max(0, total - SETTLEMENT_THRESHOLD) : Math.max(0, total)) * BONUS_RATE);
}
/** 年度加收獎金：特殊客戶按自己的 %，其他客戶 × 30%，再加總。 */
export function annualExtraBonus(lines: { amount: number; rate: number | null }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.amount * (l.rate == null ? BONUS_RATE : l.rate / 100), 0));
}

export type BonusLine = { key: string; customer_code: string | null; customer_name: string; annual: boolean; bookkeeping: number; settlement: number; annualExtra: number; rate: number | null; balance: number; shareLabel?: string };

const num = (v: unknown) => Number(v) || 0;
const code = (s: string | null | undefined) => s?.trim() || "未指定";
const before = (r: BonusRow, year: number, month: number) => (r.period_year ?? 0) < year || ((r.period_year ?? 0) === year && (r.period_month ?? 0) <= month);

/** 每期記帳費依客戶設定計入，不因尚未立帳而漏計；其他狀態依實際立帳。 */
export function periodShare(c?: Pick<BonusCustomer, "billing_type" | "bookkeeping_fee">): number | null {
  if (!c) return null;
  if (c.billing_type === "期收") return num(c.bookkeeping_fee) * 2;
  if (c.billing_type === "年收") return num(c.bookkeeping_fee) / 6;
  if (c.billing_type === "半年收") return (num(c.bookkeeping_fee) * 6) / 3;
  return null;
}

export function bonusGroups(data: BonusData, year: number, month: number) {
  const customers = new Map((data.customers ?? []).map((c) => [c.id, c]));
  const lines = new Map<string, BonusLine & { staff: string }>();
  const lineFor = (key: string, base: Omit<BonusLine, "key" | "bookkeeping" | "settlement" | "annualExtra" | "balance"> & { staff: string }) => {
    let l = lines.get(key);
    if (!l) { l = { ...base, key, bookkeeping: 0, settlement: 0, annualExtra: 0, balance: 0 }; lines.set(key, l); }
    return l;
  };
  // 期收／年收／半年收每期依設定計入；實際立帳不重複加計。
  for (const c of customers.values()) {
    const share = periodShare(c);
    if (share == null || !share) continue;
    lineFor(c.id, { staff: code(c.staff_code), customer_code: c.customer_code, customer_name: c.name, annual: true, rate: c.annual_extra_rate, shareLabel: c.billing_type === "年收" ? "年收 1/6" : c.billing_type === "半年收" ? "半年收 1/3" : "期收 ×2" }).bookkeeping = share;
  }
  for (const r of data.rows) {
    const c = r.customer_id ? customers.get(r.customer_id) : undefined;
    const key = r.customer_id ?? r.id;
    const inPeriod = r.period_year === year && r.period_month === month;
    if (!inPeriod && !(lines.has(key) && before(r, year, month))) continue;
    const l = lineFor(key, { staff: code(c?.staff_code ?? r.staff_code), customer_code: r.customer_code, customer_name: r.customer_name, annual: periodShare(c) != null, rate: c?.annual_extra_rate ?? null });
    if (!inPeriod) continue;
    if (!l.annual) l.bookkeeping += num(r.items?.["記帳費"]);
    l.settlement += num(r.items?.[SETTLEMENT_KEY]);
    l.annualExtra += num(r.items?.[ANNUAL_EXTRA_KEY]);
  }
  // 應收餘額：該客戶截至本期為止尚未收清的金額。
  for (const r of data.rows) {
    const l = lines.get(r.customer_id ?? r.id);
    if (l && before(r, year, month)) l.balance += Math.max(0, num(r.amount) - num(r.paid_amount));
  }
  const all = [...lines.values()];
  const codes = [...new Set([...data.staff.map((s) => code(s)), ...all.map((l) => l.staff)])].sort();
  return codes.map((c) => {
    const rows = all.filter((l) => l.staff === c).sort((a, b) => (a.customer_code ?? "").localeCompare(b.customer_code ?? ""));
    const total = rows.reduce((s, l) => s + l.bookkeeping, 0);
    const settlement = rows.reduce((s, l) => s + l.settlement, 0);
    const annualExtra = rows.reduce((s, l) => s + l.annualExtra, 0);
    const balance = rows.reduce((s, l) => s + l.balance, 0);
    const none = c === "未指定";
    const bookkeepingBonus = none ? 0 : bookkeeperBonus(total);
    const settleBonus = none ? 0 : settlementBonus(settlement, month);
    const extraBonus = none ? 0 : annualExtraBonus(rows.map((l) => ({ amount: l.annualExtra, rate: l.rate })));
    return { code: c, rows, total, settlement, annualExtra, balance, bookkeepingBonus, settleBonus, extraBonus, bonus: bookkeepingBonus + settleBonus + extraBonus };
  });
}
