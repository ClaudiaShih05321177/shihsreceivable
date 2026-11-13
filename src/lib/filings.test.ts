import { describe, expect, it } from "vitest";

import { filingInvoiceItems, filingTotal, nextStage } from "./filings";
import { feeLabel } from "./fee-labels";

describe("nextStage", () => {
  it("依序推進 預查→送件→核准→結案", () => {
    expect(nextStage("預查")).toBe("送件");
    expect(nextStage("送件")).toBe("核准");
    expect(nextStage("核准")).toBe("結案");
  });

  it("結案後維持結案", () => {
    expect(nextStage("結案")).toBe("結案");
  });
});

describe("filingInvoiceItems", () => {
  it("代辦費存入顯示為工商代辦費的欄位，代墊規費存自訂項目", () => {
    const items = filingInvoiceItems({ service_fee: 5000, advance_fee: 1200 });
    expect(items["文具"]).toBe(5000);
    expect(feeLabel("文具")).toBe("工商代辦費");
    expect(items["其他：代墊規費"]).toBe(1200);
  });

  it("金額為 0 的項目不產生", () => {
    expect(filingInvoiceItems({ service_fee: 3000, advance_fee: 0 })).toEqual({ 文具: 3000 });
    expect(filingInvoiceItems({ service_fee: 0, advance_fee: 0 })).toEqual({});
  });
});

describe("filingTotal", () => {
  it("代辦費加代墊規費", () => {
    expect(filingTotal({ service_fee: 5000, advance_fee: 1200 })).toBe(6200);
    expect(filingTotal({ service_fee: "5000", advance_fee: "" })).toBe(5000);
  });
});
