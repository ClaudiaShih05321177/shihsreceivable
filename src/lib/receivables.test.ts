import { describe, expect, it } from "vitest";

import { agingBucket, formatDate, invoiceStatus, itemsTotal, monthlySeries, outstanding } from "./receivables";

const today = "2026-11-12";
const inv = (due_date: string, amount: number, paid: number[] = []) => ({
  amount,
  issue_date: "2026-10-01",
  due_date,
  payments: paid.map((a) => ({ amount: a, paid_date: "2026-11-01" })),
});

describe("receivable status", () => {
  it("is overdue when unpaid balance remains after the due date", () => {
    expect(invoiceStatus(inv("2026-11-11", 10000, [4000]), today)).toBe("overdue");
  });

  it("is paid once payments cover the full amount, even past due", () => {
    expect(invoiceStatus(inv("2026-10-01", 10000, [6000, 4000]), today)).toBe("paid");
  });

  it("is due soon within 7 days of the due date", () => {
    expect(invoiceStatus(inv("2026-11-19", 10000), today)).toBe("due_soon");
  });

  it("is not due soon 8 days out", () => {
    expect(invoiceStatus(inv("2026-11-20", 10000), today)).toBe("unpaid");
  });

  it("is due soon (not overdue) on the due date itself", () => {
    expect(invoiceStatus(inv("2026-11-12", 10000), today)).toBe("due_soon");
  });
});

describe("outstanding balance", () => {
  it("subtracts all payments from the amount", () => {
    expect(outstanding(inv("2026-12-01", 25000, [5000, 7000]))).toBe(13000);
  });

  it("never goes below zero when overpaid", () => {
    expect(outstanding(inv("2026-12-01", 1000, [1500]))).toBe(0);
  });
});

describe("aging buckets", () => {
  it("puts 45 days overdue into 31–60", () => {
    expect(agingBucket(inv("2026-09-28", 1000), today)).toBe("31-60");
  });

  it("puts 91 days overdue into 90+", () => {
    expect(agingBucket(inv("2026-08-13", 1000), today)).toBe("90+");
  });
});

describe("monthly series", () => {
  it("counts billed by issue month and collected by payment month", () => {
    const rows = monthlySeries([inv("2026-11-30", 8000, [3000])], 2, today);
    expect(rows).toEqual([
      { month: "2026-10", label: "10月", billed: 8000, collected: 0 },
      { month: "2026-11", label: "11月", billed: 0, collected: 3000 },
    ]);
  });
});

describe("ledger conventions", () => {
  it("shows dates in ROC year form", () => {
    expect(formatDate("2026-01-15")).toBe("115/1/15");
  });

  it("totals a billing row from its fee items", () => {
    expect(itemsTotal({ 記帳費: 5000, 營業稅: 83719, 發票: 140, 結算: 2500 })).toBe(91359);
  });
});
