import { describe, expect, it } from "vitest";
import { filingReceiptAmount } from "./filing-receipt";

describe("filing service receipt", () => {
  it("includes only service fees, excluding stamps and advances", () => {
    expect(filingReceiptAmount({ service_fee: 8000, advance_fee: 1500, stamp_fee: 600 })).toBe(8000);
  });
  it("can calculate before billing or receipt of payment", () => {
    expect(filingReceiptAmount({ service_fee: 3000 })).toBe(3000);
  });
  it("does not invent an amount when no service fee was entered", () => {
    expect(filingReceiptAmount({})).toBe(0);
  });
});