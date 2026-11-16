import { describe, expect, it } from "vitest";

import { allocatePayment, nameMatches, openInvoicesOf, suggestMatch, type OpenInvoice } from "@/lib/reconcile";

function inv(id: string, customerId: string, customerName: string, outstanding: number, month = 1): OpenInvoice {
  return { id, customerId, customerName, outstanding, period_year: 115, period_month: month, period_label: null, created_at: `2026-0${month}-01` };
}

const open: OpenInvoice[] = [
  inv("a1", "c1", "睿森菓屋有限公司", 5000, 1),
  inv("a2", "c1", "睿森菓屋有限公司", 5000, 3),
  inv("b1", "c2", "大山企業股份有限公司", 8000, 1),
  inv("c1x", "c3", "小明工作室", 5000, 1),
];

describe("nameMatches", () => {
  it("匯款人省略公司後綴也能比對", () => {
    expect(nameMatches("睿森菓屋", "睿森菓屋有限公司")).toBe(true);
    expect(nameMatches("大山企業", "大山企業股份有限公司")).toBe(true);
  });
  it("不同名稱不比對", () => {
    expect(nameMatches("睿森菓屋", "大山企業股份有限公司")).toBe(false);
    expect(nameMatches("王", "王小明")).toBe(false); // 太短不比對
  });
});

describe("suggestMatch", () => {
  it("匯款人與金額都相符：配對單筆", () => {
    const s = suggestMatch({ amount: 5000, memo: "睿森菓屋" }, open);
    expect(s.kind).toBe("single");
    expect(s.customerId).toBe("c1");
    expect(s.invoiceIds).toEqual(["a1"]);
  });
  it("同一客戶多筆合併付款", () => {
    const s = suggestMatch({ amount: 10000, memo: "睿森菓屋有限公司" }, open);
    expect(s.kind).toBe("combined");
    expect(s.invoiceIds).toEqual(["a1", "a2"]);
  });
  it("多付：溢收", () => {
    const s = suggestMatch({ amount: 12000, memo: "睿森菓屋" }, open);
    expect(s.kind).toBe("overpay");
  });
  it("匯款人相符但金額較少：部分收款", () => {
    const s = suggestMatch({ amount: 3000, memo: "睿森菓屋" }, open);
    expect(s.kind).toBe("partial");
    expect(s.customerId).toBe("c1");
  });
  it("匯款人未識別但金額唯一：提示確認", () => {
    const s = suggestMatch({ amount: 8000, memo: "匯款" }, open);
    expect(s.kind).toBe("single");
    expect(s.customerId).toBe("c2");
    expect(s.reason).toContain("請確認");
  });
  it("同額多筆且匯款人未識別：需手動選擇", () => {
    const s = suggestMatch({ amount: 5000, memo: "轉帳" }, open);
    expect(s.kind).toBe("ambiguous");
  });
  it("完全對不上：none", () => {
    expect(suggestMatch({ amount: 999, memo: "陌生人" }, open).kind).toBe("none");
  });
});

describe("allocatePayment", () => {
  it("由舊到新逐筆填滿", () => {
    expect(allocatePayment(7000, openInvoicesOf(open, "c1"))).toEqual([
      { invoiceId: "a1", amount: 5000 },
      { invoiceId: "a2", amount: 2000 },
    ]);
  });
  it("多付的部分記在最後一筆（溢收）", () => {
    expect(allocatePayment(12000, openInvoicesOf(open, "c1"))).toEqual([
      { invoiceId: "a1", amount: 5000 },
      { invoiceId: "a2", amount: 7000 },
    ]);
  });
  it("剛好付清不多記", () => {
    expect(allocatePayment(10000, openInvoicesOf(open, "c1"))).toEqual([
      { invoiceId: "a1", amount: 5000 },
      { invoiceId: "a2", amount: 5000 },
    ]);
  });
});
