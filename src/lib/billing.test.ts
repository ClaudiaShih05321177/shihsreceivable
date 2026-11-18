import { describe, expect, it } from "vitest";
import { batchInvoiceDrafts, priorBalance } from "./billing";

const c = (id: string, fee: number) => ({ id, bookkeeping_fee: fee, stationery_fee: 2500, settlement_fee: 6000 });
const inv = (id: string, customer_id: string, m: number, amount: number, paid = 0) => ({ id, customer_id, period_year: 2026, period_month: m, period_label: null, amount, payments: paid ? [{ amount: paid }] : [] });

describe("batchInvoiceDrafts", () => {
  it("一鍵立帳完全排除年收與半年收客戶（含 11 月文具、1 月結算）", () => {
    const annual = { ...c("annual", 30000), billing_type: "年收" };
    const half = { ...c("half", 30000), billing_type: "半年收" };
    for (const m of [1, 3, 11]) expect(batchInvoiceDrafts([annual, half], [], 2026, m)).toEqual([]);
  });
  it("creates 記帳費×2 + 文具 in November and skips customers already billed or with no fee", () => {
    const d = batchInvoiceDrafts([c("a", 2500), c("b", 3000), { id: "z", bookkeeping_fee: 0, stationery_fee: 0, settlement_fee: 0 }], [inv("x", "b", 11, 1)], 2026, 11);
    expect(d).toEqual([{ customer_id: "a", period_year: 2026, period_month: 11, period_label: "9-10", items: { 記帳費: 5000, 文具: 2500 }, item_years: { 文具: 116 }, amount: 7500 }]);
  });
  it("places January settlement in the settlement fee field", () => {
    expect(batchInvoiceDrafts([c("a", 2500)], [], 2026, 1)).toEqual([{ customer_id: "a", period_year: 2026, period_month: 1, period_label: "11-12", items: { 記帳費: 5000, 結算: 6000 }, item_years: { 結算: 114 }, amount: 11000 }]);
  });
  it("creates nothing in an even month", () => {
    expect(batchInvoiceDrafts([c("a", 2500)], [], 2026, 4)).toEqual([]);
  });
});

describe("priorBalance", () => {
  it("does not bill carried credit again as prior unpaid balance", () => {
    const older = { ...inv("old", "a", 3, 5000), credit_applied: 1000 };
    const current = inv("current", "a", 5, 5000);
    expect(priorBalance(current, [older, current])).toBe(4000);
  });
  it("sums unpaid amounts of earlier periods for the same customer only", () => {
    const all = [inv("1", "a", 7, 5000, 2000), inv("2", "a", 9, 5000), inv("3", "a", 11, 7500), inv("4", "b", 7, 9999)];
    expect(priorBalance(all[2]!, all)).toBe(8000);
  });
});
