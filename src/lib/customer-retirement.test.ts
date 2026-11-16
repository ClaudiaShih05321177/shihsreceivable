import { describe, expect, it } from "vitest";
import { canRetireCustomer } from "./customer-retirement";
const invoice = { id: "bill", customer_id: "a", amount: 5000, issue_date: "2026-01-01", due_date: null, payments: [{ amount: 5000, paid_date: "2026-01-01" }] };
const filing = { customer_id: "a", case_type: "註銷登記", stage: "結案", invoice_id: "bill" };
describe("cancelled customer removal eligibility", () => {
  it("allows administrators after cancellation and all bills are settled", () => expect(canRetireCustomer(true, "a", [invoice], [filing])).toBe(true));
  it("never allows ordinary staff", () => expect(canRetireCustomer(false, "a", [invoice], [filing])).toBe(false));
  it("waits until every invoice is settled", () => expect(canRetireCustomer(true, "a", [invoice, { ...invoice, id: "unpaid", payments: [] }], [filing])).toBe(false));
  it("requires a closed cancellation linked to its invoice", () => {
    expect(canRetireCustomer(true, "a", [invoice], [{ ...filing, stage: "核准" }])).toBe(false);
    expect(canRetireCustomer(true, "a", [invoice], [{ ...filing, invoice_id: null }])).toBe(false);
    expect(canRetireCustomer(true, "a", [invoice], [{ ...filing, case_type: "法院報備" }])).toBe(false);
  });
  it("retains customers with overpaid money", () => expect(canRetireCustomer(true, "a", [{ ...invoice, payments: [{ amount: 6000, paid_date: "2026-01-01" }] }], [filing])).toBe(false));
  it("does not ignore another unfinished case", () => expect(canRetireCustomer(true, "a", [invoice], [filing, { ...filing, case_type: "變更登記", stage: "送件" }])).toBe(false));
});