import { describe, expect, it } from "vitest";

import { agingBucket, applyScheduledFees, bookkeepingCollectionMonth, bookkeepingPeriodFee, formatDate, invoiceStatus, isOtherKey, itemEntries, itemsTotal, monthlySeries, otherEntries, otherLabel, outstanding, scheduledCustomerFees, sortByPeriod, suggestPeriod, withOtherItems } from "./receivables";

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

describe("invoices without a due date", () => {
  it("are never overdue or due soon", () => {
    const i = { amount: 1000, issue_date: "2026-01-01", due_date: null, payments: [] };
    expect(invoiceStatus(i, "2026-12-31")).toBe("unpaid");
    expect(agingBucket(i, "2026-12-31")).toBe("current");
  });
});

describe("bimonthly bookkeeping collection", () => {
  it("collects two monthly fees in every odd month", () => {
    expect([1, 3, 5, 7, 9, 11].map((month) => bookkeepingPeriodFee(3000, month))).toEqual([6000, 6000, 6000, 6000, 6000, 6000]);
  });

  it("does not prefill bookkeeping fees in even months or carried balances", () => {
    expect([0, 2, 4, 6, 8, 10, 12].map((month) => bookkeepingPeriodFee(3000, month))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("defaults to the next odd collection month", () => {
    expect([1, 2, 10, 11, 12].map(bookkeepingCollectionMonth)).toEqual([1, 3, 11, 11, 13]);
  });

  it("keeps the preceding two-month ledger period", () => {
    expect([1, 3, 5, 7, 9, 11].map(suggestPeriod)).toEqual(["11-12", "1-2", "3-4", "5-6", "7-8", "9-10"]);
  });
});

describe("scheduled customer fees", () => {
  const customer = { bookkeeping_fee: 3000, stationery_fee: 500, settlement_fee: 2000 };
  it("prefills the original annual fee only for individual creation, regardless of month", () => {
    expect([1, 2, 11].map((month) => scheduledCustomerFees({ ...customer, billing_type: "年收" }, month, "individual")["記帳費"])).toEqual([3000, 3000, 3000]);
  });
  it("never prefills bookkeeping for annual customers in any month", () => {
    expect(Array.from({ length: 12 }, (_, i) => scheduledCustomerFees({ ...customer, billing_type: "年收" }, i + 1)["記帳費"])).toEqual(Array(12).fill(0));
  });
  it("keeps bimonthly bookkeeping for period customers", () => {
    expect(scheduledCustomerFees({ ...customer, billing_type: "期收" }, 11)["記帳費"]).toBe(6000);
  });
  it("charges stationery in November only", () => {
    expect(Array.from({ length: 12 }, (_, i) => scheduledCustomerFees(customer, i + 1)["暫繳"])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 500, 0]);
  });
  it("charges settlement in January only", () => {
    expect(Array.from({ length: 12 }, (_, i) => scheduledCustomerFees(customer, i + 1)["股利2代"])).toEqual([2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("moves automatic amounts with the month but keeps manual amounts", () => {
    expect(applyScheduledFees({ 記帳費: "6000", 暫繳: "500", 股利2代: "900", 文具: "300", 結算: "400" }, scheduledCustomerFees(customer, 11), scheduledCustomerFees(customer, 1))).toEqual({ 記帳費: "6000", 暫繳: "", 股利2代: "900", 文具: "300", 結算: "400" });
  });
  it("does not automatically fill agency or seal fees", () => {
    for (const month of [1, 11]) {
      expect(scheduledCustomerFees(customer, month)).not.toHaveProperty("文具");
      expect(scheduledCustomerFees(customer, month)).not.toHaveProperty("結算");
    }
  });
});

describe("月份/期別 排序", () => {
  const p = (period_year: number | null, period_month: number | null, period_label: string | null = null, name = "") => ({ period_year, period_month, period_label, name });

  it("依年份、月份排序，前期排在該年 1 月之前", () => {
    const sorted = sortByPeriod([
      p(2026, 2, "1-2", "115/2月"),
      p(2026, 0, null, "115前期"),
      p(2025, 12, "11-12", "114/12月"),
      p(2026, 1, "11-12", "115/1月"),
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["114/12月", "115前期", "115/1月", "115/2月"]);
  });

  it("desc 由新到舊", () => {
    const sorted = sortByPeriod([p(2025, 12, "11-12", "a"), p(2026, 1, "11-12", "b"), p(2026, 3, "1-2", "c")], "desc");
    expect(sorted.map((r) => r.name)).toEqual(["c", "b", "a"]);
  });

  it("同月份依期別排序", () => {
    const sorted = sortByPeriod([p(2026, 3, "5-6", "後"), p(2026, 3, "1-2", "前")]);
    expect(sorted.map((r) => r.name)).toEqual(["前", "後"]);
  });

  it("不改變原本陣列的順序", () => {
    const rows = [p(2026, 3, null, "c"), p(2025, 1, null, "a")];
    sortByPeriod(rows);
    expect(rows.map((r) => r.name)).toEqual(["c", "a"]);
  });
});

describe("其他自訂項目", () => {
  it("以「其他：說明」存入並取回說明", () => {
    expect(otherLabel("其他：代墊規費")).toBe("代墊規費");
    expect(isOtherKey("其他：代墊規費")).toBe(true);
    expect(isOtherKey("記帳費")).toBe(false);
  });

  it("併入費用項目：空白說明或 0 金額不存", () => {
    expect(
      withOtherItems({ 記帳費: 6000 }, [
        { label: "代墊規費", amount: "300" },
        { label: "", amount: "100" },
        { label: "零元", amount: "0" },
      ]),
    ).toEqual({ 記帳費: 6000, "其他：代墊規費": 300 });
  });

  it("讀回已存的自訂項目供編輯", () => {
    expect(otherEntries({ 記帳費: 6000, "其他：代墊規費": 300 })).toEqual([{ key: "其他：代墊規費", label: "代墊規費", amount: "300" }]);
  });

  it("自訂項目計入合計與明細", () => {
    const items = withOtherItems({ 記帳費: 6000 }, [{ label: "代墊規費", amount: "300" }]);
    expect(itemsTotal(items)).toBe(6300);
    expect(itemEntries(items).map((i) => i.name)).toContain("其他：代墊規費");
  });
});

import { priorVatCredit, vatDue } from "./receivables";
describe("營業稅 銷項／進項／留抵", () => {
  it("due = output − input − prior credit", () => expect(vatDue(50000, 20000, 5000)).toEqual({ due: 25000, carry: 0 }));
  it("negative result means 0 due and carries credit", () => expect(vatDue(10000, 18000, 2000)).toEqual({ due: 0, carry: 10000 }));
  it("prior credit comes from the same customer's latest earlier period", () => {
    const rows = [
      { id: "1", customer_id: "a", period_year: 2026, period_month: 3, period_label: null, vat_output: 1000, vat_input: 4000, vat_prior_credit: 0 },
      { id: "2", customer_id: "a", period_year: 2026, period_month: 5, period_label: null, vat_output: 1000, vat_input: 2500, vat_prior_credit: 0 },
      { id: "3", customer_id: "b", period_year: 2026, period_month: 5, period_label: null, vat_output: 0, vat_input: 9000, vat_prior_credit: 0 },
    ];
    expect(priorVatCredit({ customer_id: "a", period_year: 2026, period_month: 7, period_label: null }, rows)).toBe(1500);
  });
});
