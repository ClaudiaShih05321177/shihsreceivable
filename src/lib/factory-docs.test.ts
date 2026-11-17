import { describe, expect, it } from "vitest";
import { buildQuoteTerms, invoiceSummary, quoteSummary, readQuoteTerms } from "./factory-docs";

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
  it("訂金請款＝未稅訂金 34,125 ＋ 5% 稅 1,706 = 35,831", () => {
    expect(invoiceSummary(base, "訂金").total).toBe(35831);
  });
  it("尾款＝含稅 68,250 − 含稅簽約金 35,831 ＋ 規費 5,000 = 37,419", () => {
    expect(invoiceSummary(base, "尾款").total).toBe(37419);
  });
  it("全額＝73,250", () => {
    expect(invoiceSummary(base, "全額").total).toBe(73250);
  });
});

describe("折扣", () => {
  it("報價 65,000 折 5,000：小計 60,000、稅 3,000、加規費 5,000 = 68,000", () => {
    const s = quoteSummary({ ...base, discount: 5000 });
    expect(s.discount).toBe(5000);
    expect(s.subtotal).toBe(60000);
    expect(s.lines[0]!.amount).toBe(3000);
    expect(s.total).toBe(68000);
  });
  it("全額請款也用折扣後金額：63,000 + 5,000 = 68,000", () => {
    expect(invoiceSummary({ ...base, discount: 5000 }, "全額").total).toBe(68000);
  });
});

describe("報價條款", () => {
  it("預設含環判 2 條、不含園區，共 4 條", () => {
    const t = buildQuoteTerms(readQuoteTerms({}));
    expect(t).toHaveLength(4);
    expect(t.some((x) => x.includes("產業園區"))).toBe(false);
  });
  it("免跑環保且在園區：無環判條款、有園區條款", () => {
    const t = buildQuoteTerms(readQuoteTerms({ env: "免跑環保", park: true }));
    expect(t.some((x) => x.includes("環保判定"))).toBe(false);
    expect(t.some((x) => x.includes("產業園區"))).toBe(true);
  });
  it("案件為客戶自辦環保時預設帶自辦條款", () => {
    expect(readQuoteTerms({}, "客戶自辦環保").env).toBe("客戶自辦環保");
  });
});
