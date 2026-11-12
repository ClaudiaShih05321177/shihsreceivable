import { describe, expect, it } from "vitest";
import { bookkeeperBonus, bonusGroups, type BonusRow } from "./bonuses";
describe("bookkeeper bonuses", () => {
  it("pays 30% only above 200000", () => {
    expect([0, 199999, 200000, 250000].map(bookkeeperBonus)).toEqual([0, 0, 0, 15000]);
    expect(bookkeeperBonus(247366.66666666666)).toBe(14210);
  });
  it("uses selected odd collection month and bookkeeping only, not payment or taxes", () => {
    const row: BonusRow = { id: "a", customer_name: "客戶", customer_code: null, staff_code: "AC", period_year: 2026, period_month: 9, items: { 記帳費: 250000, 營業稅: 99999 }, amount: 349999, paid_amount: 0 };
    const groups = bonusGroups({ staff: ["AC"], rows: [row, { ...row, id: "b", period_month: 11 }] }, 2026, 9);
    expect(groups[0]?.total).toBe(250000);
    expect(groups[0]?.bonus).toBe(15000);
    expect(groups[0]?.rows).toHaveLength(1);
  });
});