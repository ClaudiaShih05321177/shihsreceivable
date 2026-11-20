import type { DocSummary } from "./factory-docs";
import { describe, expect, it } from "vitest";
import { buildQuoteTerms, hasDeposit, invoiceSummary, quoteSummary, readQuoteTerms, subtotalLabel } from "./factory-docs";

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
  it("尾款顧問費＝發票未稅 65,000 − 訂金 34,125 = 30,875，稅 1,544", () => {
    const s = invoiceSummary(base, "尾款");
    expect(s.consulting).toBe(30875);
    expect(s.subtotal).toBe(30875);
    expect(s.lines[0]!.amount).toBe(1544);
    expect(s.lines.some((l) => l.label === "簽約金")).toBe(false);
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

describe("訂金判斷", () => {
  it("開發票看訂金發票金額，不開發票看訂金實收", () => {
    expect(hasDeposit(base)).toBe(true);
    expect(hasDeposit({ ...base, deposit_invoice_amount: 0 })).toBe(false);
    expect(hasDeposit({ ...base, invoice_type: "不開發票", deposit_received_amount: 30000 })).toBe(true);
    expect(hasDeposit({ ...base, invoice_type: "不開發票" })).toBe(false);
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
  it("科學園區勾選時帶入不含納管、用水、用電及污染總量預估", () => {
    expect(buildQuoteTerms(readQuoteTerms({})).some((x) => x.includes("科學園區"))).toBe(false);
    expect(buildQuoteTerms(readQuoteTerms({ sciencePark: true }))).toContain("若貴廠位於科學園區內，本報價不含污水納管、用水計畫書、用電計畫書及污染總量預估。");
  });
  it("案件為客戶自辦環保時預設帶自辦條款", () => {
    expect(readQuoteTerms({}, "客戶自辦環保").env).toBe("客戶自辦環保");
  });
  it("只跑環保：帶僅含環判條款", () => {
    const t = buildQuoteTerms(readQuoteTerms({ env: "只跑環保" }));
    expect(t).toContain("以上報價僅包含環保判定申請，不含工廠登記送件及其他主管機關審查。");
    expect(t.some((x) => x.includes("即可申請工廠登記"))).toBe(false);
  });
  it("只跑環保：規費實報實銷、結案後付款", () => {
    const t = buildQuoteTerms(readQuoteTerms({ env: "只跑環保", payment: "預付50%＋尾款" }));
    expect(t).toContain("上述報價不包含各項規費，如產生其他規費將實報實銷。");
    expect(t).toContain("付款條件:結案後付款。請於請款後30日內付款。");
    expect(t.some((x) => x.includes("工商科規費") || x.includes("預付"))).toBe(false);
  });
});

const noInv = { ...base, invoice_type: "不開發票", deposit_invoice_amount: 0, deposit_received_amount: 30000 };
describe("不開發票不秀營業稅", () => {
  const hasTax = (s: DocSummary) => s.lines.some((l) => l.label.startsWith("營業稅"));
  it("報價單不列營業稅，總計 70,000", () => {
    const s = quoteSummary(noInv);
    expect(hasTax(s)).toBe(false);
    expect(s.total).toBe(70000);
  });
  it("訂金請款不列營業稅，總計 30,000", () => {
    const s = invoiceSummary(noInv, "訂金");
    expect(hasTax(s)).toBe(false);
    expect(s.lines).toEqual([]);
    expect(s.total).toBe(30000);
  });
  it("尾款請款不列營業稅，顧問費 35,000 加規費 5,000 = 40,000", () => {
    const s = invoiceSummary(noInv, "尾款");
    expect(hasTax(s)).toBe(false);
    expect(s.consulting).toBe(35000);
    expect(s.total).toBe(40000);
  });
  it("全額請款不列營業稅，總計 70,000", () => {
    const s = invoiceSummary(noInv, "全額");
    expect(hasTax(s)).toBe(false);
    expect(s.total).toBe(70000);
  });
  it("開發票仍列營業稅", () => {
    expect(hasTax(quoteSummary(base))).toBe(true);
    expect(hasTax(invoiceSummary(base, "訂金"))).toBe(true);
    expect(hasTax(invoiceSummary(base, "尾款"))).toBe(true);
    expect(hasTax(invoiceSummary(base, "全額"))).toBe(true);
  });
});

describe("小計標題", () => {
  const noInv = { ...base, invoice_type: "不開發票" };
  it("開發票：報價單與請款單都寫「小計(發票金額)」", () => {
    expect(subtotalLabel(quoteSummary(base))).toBe("小計(發票金額)");
    expect(subtotalLabel(invoiceSummary(base, "訂金"))).toBe("小計(發票金額)");
    expect(subtotalLabel(invoiceSummary(base, "尾款"))).toBe("小計(發票金額)");
    expect(subtotalLabel(invoiceSummary(base, "全額"))).toBe("小計(發票金額)");
  });
  it("不開發票：報價單與請款單只寫「小計」", () => {
    expect(subtotalLabel(quoteSummary(noInv))).toBe("小計");
    expect(subtotalLabel(invoiceSummary(noInv, "訂金"))).toBe("小計");
    expect(subtotalLabel(invoiceSummary(noInv, "尾款"))).toBe("小計");
    expect(subtotalLabel(invoiceSummary(noInv, "全額"))).toBe("小計");
  });
});
