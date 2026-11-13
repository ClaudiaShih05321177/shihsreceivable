import { describe, expect, it } from "vitest";
import { invoiceSummary, quoteSummary } from "./factory-docs";

const base = { quote_amount: 65000, deposit_invoice_amount: 34125, deposit_received_amount: 0, final_invoice_amount: 0, government_fee: 5000, other_fee: 0, final_received_amount: 0, invoice_type: "開發票" };

describe("報價單", () => {
  it("開發票：65,000 外加 5% 稅 3,250 加規費 5,000 = 73,250", () => {
    const s = quoteSummary(base);
    expect(s.lines[0]!.amount).toBe(3250);
    expect(s.total).toBe(73250);
  });
  it("不開發票不加稅", () => {
    expect(quoteSummary({ ...base, invoice_type: "不開發票" }).total).toBe(70000);
  });
});

describe("請款單", () => {
  it("訂金請款＝訂金發票金額", () => {
    expect(invoiceSummary(base, "訂金").total).toBe(34125);
  });
  it("尾款＝含稅 68,250 − 簽約金 34,125 ＋ 規費 5,000 = 39,125", () => {
    expect(invoiceSummary(base, "尾款").total).toBe(39125);
  });
  it("全額＝73,250", () => {
    expect(invoiceSummary(base, "全額").total).toBe(73250);
  });
});
