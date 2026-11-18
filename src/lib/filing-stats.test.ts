import { describe, expect, it } from "vitest";
import { filingYearStats } from "./filing-stats";

const inv = (id: string, amount: number, pays: [number, string][]) => ({ id, amount, payments: pays.map(([a, d]) => ({ amount: a, bank_fee: 0, paid_date: d })) });
describe("filingYearStats", () => {
  const filings = [{ id: "f1", invoice_id: "i1", stage: "結案" }, { id: "f2", invoice_id: "i2", stage: "結案" }, { id: "f3", invoice_id: "i3", stage: "結案" }];
  const fees = { f1: 5000, f2: 3000, f3: 8000 };
  it("依收清日期的日曆年度認列已收代辦費", () => {
    const invoices = [inv("i1", 9000, [[9000, "2026-03-01"]]), inv("i2", 3000, [[1000, "2025-12-20"], [2000, "2026-01-05"]]), inv("i3", 8000, [[8000, "2025-06-01"]])];
    expect(filingYearStats(filings, invoices, fees, 2026)).toMatchObject({ received: 8000, receivedCount: 2 });
    expect(filingYearStats(filings, invoices, fees, 2025)).toMatchObject({ received: 8000, receivedCount: 1 });
  });
  it("未收清列為待收", () => {
    const invoices = [inv("i1", 9000, [[4000, "2026-03-01"]]), inv("i2", 3000, []), inv("i3", 8000, [[8000, "2026-02-01"]])];
    expect(filingYearStats(filings, invoices, fees, 2026)).toEqual({ received: 8000, receivedCount: 1, pending: 8000, pendingCount: 2 });
  });
});
