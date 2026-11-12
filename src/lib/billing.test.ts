import { describe, expect, it } from "vitest";
import { batchInvoiceDrafts, priorBalance } from "./billing";

const c = (id: string, fee: number) => ({ id, bookkeeping_fee: fee, stationery_fee: 2500, settlement_fee: 6000 });
const inv = (id: string, customer_id: string, m: number, amount: number, paid = 0) => ({ id, customer_id, period_year: 2026, period_month: m, period_label: null, amount, payments: paid ? [{ amount: paid }] : [] });

describe("batchInvoiceDrafts", () => {
  it("creates 記帳費×2 + 文具 in November and skips customers already billed or with no fee", () => {
    const d = batchInvoiceDrafts([c("a", 2500), c("b", 3000), { id: "z", bookkeeping_fee: 0, stationery_fee: 0, settlement_fee: 0 }], [inv("x", "b", 11, 1)], 2026, 11);
    expect(d).toEqual([{ customer_id: "a", period_year: 2026, period_month: 11, period_label: "9-10", items: { 記帳費: 5000, 暫繳: 2500 }, amount: 7500 }]);
  });
  it("places January settlement in the settlement fee field", () => {
    expect(batchInvoiceDrafts([c("a", 2500)], [], 2026, 1)).toEqual([{ customer_id: "a", period_year: 2026, period_month: 1, period_label: "11-12", items: { 記帳費: 5000, 股利2代: 6000 }, amount: 11000 }]);
  });
  it("creates nothing in an even month", () => {
    expect(batchInvoiceDrafts([c("a", 2500)], [], 2026, 4)).toEqual([]);
  });
});

describe("priorBalance", () => {
  it("sums unpaid amounts of earlier periods for the same customer only", () => {
    const all = [inv("1", "a", 7, 5000, 2000), inv("2", "a", 9, 5000), inv("3", "a", 11, 7500), inv("4", "b", 7, 9999)];
    expect(priorBalance(all[2]!, all)).toBe(8000);
  });
});
