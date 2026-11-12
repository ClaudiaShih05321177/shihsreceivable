import type { FeeItems } from "./receivables";

export type BonusRow = { id: string; customer_name: string; customer_code: string | null; staff_code: string | null; period_year: number | null; period_month: number | null; items: FeeItems; amount: number; paid_amount: number };
export type BonusData = { staff: string[]; rows: BonusRow[] };
export const BONUS_THRESHOLD = 200000;
export const BONUS_RATE = 0.3;
export function bookkeeperBonus(total: number): number {
  return Math.round(Math.max(0, total - BONUS_THRESHOLD) * BONUS_RATE);
}
export function bonusGroups(data: BonusData, year: number, month: number) {
  const rows = data.rows.filter((r) => r.period_year === year && r.period_month === month);
  const codes = [...new Set([...data.staff, ...rows.map((r) => r.staff_code?.trim() || "未指定")])].sort();
  return codes.map((code) => {
    const detail = rows.filter((r) => (r.staff_code?.trim() || "未指定") === code);
    const total = detail.reduce((sum, r) => sum + (Number(r.items?.["記帳費"]) || 0), 0);
    return { code, rows: detail, total, bonus: code === "未指定" ? 0 : bookkeeperBonus(total) };
  });
}