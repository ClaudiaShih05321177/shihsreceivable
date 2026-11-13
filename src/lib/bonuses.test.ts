import { describe, expect, it } from "vitest";
import { annualExtraBonus, bookkeeperBonus, bonusGroups, settlementBonus, type BonusCustomer, type BonusRow } from "./bonuses";

const cust = (o: Partial<BonusCustomer>): BonusCustomer => ({ id: "c1", name: "客戶", customer_code: "AC01", staff_code: "AC", billing_type: "期收", bookkeeping_fee: 0, annual_extra_rate: null, ...o });
const row = (o: Partial<BonusRow>): BonusRow => ({ id: "i1", customer_id: "c1", customer_name: "客戶", customer_code: "AC01", staff_code: "AC", period_year: 2026, period_month: 9, items: {}, amount: 0, paid_amount: 0, ...o });

describe("bookkeeper bonuses", () => {
  it("bookkeeping pays 30% only above 200000", () => {
    expect([0, 199999, 200000, 250000].map(bookkeeperBonus)).toEqual([0, 0, 0, 15000]);
    expect(bookkeeperBonus(247366.66666666666)).toBe(14210);
  });
  it("settlement: January above 100000 × 30%, other months straight 30%", () => {
    expect(settlementBonus(100000, 1)).toBe(0);
    expect(settlementBonus(150000, 1)).toBe(15000);
    expect(settlementBonus(10000, 5)).toBe(3000);
  });
  it("annual extra: special customers use own %, others 30%, then summed", () => {
    expect(annualExtraBonus([{ amount: 10000, rate: 20 }, { amount: 10000, rate: null }])).toBe(5000);
  });
  it("annual customers count yearly fee ÷ 6 every period and invoice fee is not double counted", () => {
    const d = { staff: ["AC"], customers: [cust({ billing_type: "年收", bookkeeping_fee: 5000 })], rows: [row({ items: { 記帳費: 5000 } })] };
    expect(bonusGroups(d, 2026, 9)[0]?.total).toBeCloseTo(833.333, 2);
    expect(bonusGroups(d, 2026, 3)[0]?.total).toBeCloseTo(833.333, 2);
  });
  it("uses selected month only and ignores taxes", () => {
    const d = { staff: ["AC"], customers: [cust({ billing_type: "結算" })], rows: [row({ items: { 記帳費: 250000, 營業稅: 99999 } }), row({ id: "i2", period_month: 11, items: { 記帳費: 9 } })] };
    const g = bonusGroups(d, 2026, 9)[0];
    expect(g?.total).toBe(250000);
    expect(g?.bonus).toBe(15000);
  });
  it("AE25 half-year total 12000 is shared as 4000 per period without double counting invoices", () => {
    const d = { staff: ["AE"], customers: [cust({ customer_code: "AE25", staff_code: "AE", name: "華珍製材工廠", billing_type: "半年收", bookkeeping_fee: 12000 })], rows: [row({ items: { 記帳費: 12000 } })] };
    expect(bonusGroups(d, 2026, 9).find((g) => g.code === "AE")?.total).toBe(4000);
    expect(bonusGroups(d, 2026, 11).find((g) => g.code === "AE")?.total).toBe(4000);
  });
  it("period customers count monthly fee × 2 even without invoices", () => {
    const d = { staff: ["AC"], customers: [cust({ bookkeeping_fee: 3000 })], rows: [] };
    expect(bonusGroups(d, 2026, 11)[0]?.total).toBe(6000);
  });
  it("period invoice bookkeeping is not counted again", () => {
    const d = { staff: ["AC"], customers: [cust({ bookkeeping_fee: 3000 })], rows: [row({ items: { 記帳費: 6000 } })] };
    expect(bonusGroups(d, 2026, 9)[0]?.total).toBe(6000);
  });
  it("half-year customers count their three-period share without invoices", () => {
    const d = { staff: ["AC"], customers: [cust({ billing_type: "半年收", bookkeeping_fee: 3000 })], rows: [] };
    expect(bonusGroups(d, 2026, 11)[0]?.total).toBe(1000);
  });
  it("BF09 counts one fixed 40000 per period even with two same-code customers, invoices not double counted", () => {
    const a = cust({ id: "c1", customer_code: "BF09", staff_code: "BF", name: "誠鍚科技企業(報表)-勤豐", billing_type: "期收", bookkeeping_fee: 30000 });
    const b = cust({ id: "c2", customer_code: "BF09", staff_code: "BF", name: "誠鍚科技企業(薪資)-勤豐", billing_type: "期收", bookkeeping_fee: 25000 });
    const d = { staff: ["BF"], customers: [a, b], rows: [row({ customer_code: "BF09", staff_code: "BF", items: { 記帳費: 60000 } })] };
    for (const m of [1, 3, 9, 11]) {
      const g = bonusGroups(d, 2026, m).find((x) => x.code === "BF");
      expect(g?.total).toBe(40000);
      expect(g?.rows.filter((r) => r.bookkeeping === 40000)).toHaveLength(1);
    }
  });
  it("combines period, half-year and annual customers in the staff total", () => {
    const d = { staff: ["AC"], customers: [cust({ bookkeeping_fee: 100000 }), cust({ id: "c2", billing_type: "半年收", bookkeeping_fee: 3000 }), cust({ id: "c3", billing_type: "年收", bookkeeping_fee: 6000 })], rows: [] };
    const g = bonusGroups(d, 2026, 11)[0];
    expect(g?.total).toBe(202000);
    expect(g?.bookkeepingBonus).toBe(600);
    expect(g?.rows).toHaveLength(3);
  });
});
