import { describe, expect, it } from "vitest";
import { allocateCredits } from "./credits";
import { outstanding, overpaid, invoiceStatus } from "./receivables";

const row = (id: string, month: number, amount: number, paid = 0, customer_id = "a") => ({ id, customer_id, period_year: 2026, period_month: month, period_label: null, issue_date: "2026-01-01", due_date: null, amount, payments: paid ? [{ amount: paid, paid_date: "2026-01-01" }] : [] });

describe("automatic overpayment carry-forward", () => {
  it("deducts a 1000 overpayment from the next 5000 bill without changing fees or receipts", () => {
    const rows = allocateCredits([row("old", 1, 5000, 6000), row("next", 3, 5000)]);
    expect(rows[1]?.credit_applied).toBe(1000);
    expect(outstanding(rows[1] ?? row("missing", 3, 5000))).toBe(4000);
    expect(rows[1]?.amount).toBe(5000);
    expect(invoiceStatus(rows[1] ?? row("missing", 3, 5000))).toBe("partial");
    expect(overpaid(rows[0] ?? row("missing", 1, 5000))).toBe(0);
  });
  it("carries excess onward once and stops at zero", () => {
    const rows = allocateCredits([row("old", 1, 1000, 8000), row("next", 3, 5000), row("third", 5, 5000)]);
    expect(rows.map((r) => r.credit_applied)).toEqual([0, 5000, 2000]);
    expect(invoiceStatus(rows[1] ?? row("missing", 3, 5000))).toBe("paid");
    expect(outstanding(rows[2] ?? row("missing", 5, 5000))).toBe(3000);
  });
  it("never crosses customers, earlier periods, or the same period", () => {
    const rows = allocateCredits([row("before", 1, 5000), row("source", 3, 1000, 2000), row("same", 3, 5000), row("other", 5, 5000, 0, "b")]);
    expect(rows.map((r) => r.credit_applied)).toEqual([0, 0, 0, 0]);
    expect(overpaid(rows[1] ?? row("missing", 3, 1000))).toBe(1000);
  });
  it("accounts for payments and releases credit when the source receipt is removed", () => {
    const input = [row("source", 1, 5000, 6000), row("next", 3, 5000, 4500), row("third", 5, 5000)];
    expect(allocateCredits(input).map((r) => r.credit_applied)).toEqual([0, 500, 500]);
    expect(allocateCredits([{ ...input[0], ...row("source", 1, 5000) }, ...input.slice(1)]).map((r) => r.credit_applied)).toEqual([0, 0, 0]);
  });
  it("does not carry waived bank fees as customer cash", () => {
    const source = { ...row("source", 1, 5000, 6050), payments: [{ amount: 6050, bank_fee: 50, paid_date: "2026-01-01" }] };
    expect(allocateCredits([source, row("next", 3, 5000)])[1]?.credit_applied).toBe(1000);
    expect(overpaid(allocateCredits([source, row("next", 3, 5000)])[0] ?? source)).toBe(0);
  });
  it("is deterministic regardless of fetch order and handles year boundaries", () => {
    const next = { ...row("next", 1, 5000), period_year: 2027 };
    const source = row("source", 11, 5000, 6000);
    expect(allocateCredits([next, source])[0]?.credit_applied).toBe(1000);
    expect(allocateCredits([source, next])[1]?.credit_applied).toBe(1000);
  });
});