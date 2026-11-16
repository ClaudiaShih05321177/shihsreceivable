import { describe, expect, it } from "vitest";
import { depositTaxSplit, factoryInitialStage, finalDue, nextFactoryStage, projectArStatus, projectOutstanding } from "./factory";

describe("訂金稅金拆分", () => {
  it("訂金發票 34,125 拆成未稅 32,500＋稅 1,625", () => {
    expect(depositTaxSplit(34125)).toEqual({ base: 32500, tax: 1625 });
  });
  it("訂金 30,000 拆成未稅 28,571＋稅 1,429", () => {
    expect(depositTaxSplit(30000)).toEqual({ base: 28571, tax: 1429 });
  });
  it("空白或 0 回傳 0", () => {
    expect(depositTaxSplit(null)).toEqual({ base: 0, tax: 0 });
    expect(depositTaxSplit("")).toEqual({ base: 0, tax: 0 });
  });
});

const ar = { quote_amount: 100000, deposit_invoice_amount: 30000, deposit_received_amount: 0, final_invoice_amount: 70000, government_fee: 3000, other_fee: 2000, final_received_amount: 0 };

describe("工廠登記流程", () => {
  it("免跑環保或客戶自辦環保直接從送件工商科開始", () => {
    expect(factoryInitialStage("需跑環保")).toBe("送件環保");
    expect(factoryInitialStage("免跑環保")).toBe("送件工商科");
    expect(factoryInitialStage("客戶自辦環保")).toBe("送件工商科");
  });
  it("現場會勘可略過直接核准結案", () => {
    expect(nextFactoryStage("送件工商科")).toBe("現場會勘");
    expect(nextFactoryStage("送件工商科", true)).toBe("核准結案");
    expect(nextFactoryStage("環保核准")).toBe("送件工商科");
  });
});

describe("專案應收帳款", () => {
  it("尾款應收＝尾款發票＋規費＋其他費用", () => {
    expect(finalDue(ar)).toBe(75000);
  });
  it("未收餘額與狀態", () => {
    expect(projectOutstanding(ar)).toBe(105000);
    expect(projectArStatus(ar)).toBe("訂金待收");
    expect(projectArStatus({ ...ar, deposit_received_amount: 30000 })).toBe("尾款待收");
    expect(projectArStatus({ ...ar, deposit_received_amount: 30000, final_received_amount: 75000 })).toBe("已收清");
  });
});

import { autoFinalInvoice as afi, contractTotal as ct, finalDue as fd, projectOutstanding as po } from "./factory";
describe("發票類型", () => {
  const base = { quote_amount: 100000, deposit_invoice_amount: 0, deposit_received_amount: 0, final_invoice_amount: 0, government_fee: 3000, other_fee: 2000, final_received_amount: 0 };
  it("開發票報價外加5%", () => expect(ct(100000, "開發票")).toBe(105000));
  it("尾款發票自動補齊", () => expect(afi(100000, 30000, "開發票")).toBe(75000));
  it("不開發票全額列入尾款應收", () => {
    const r = { ...base, invoice_type: "不開發票", deposit_received_amount: 40000 };
    expect(fd(r)).toBe(105000);
    expect(po(r)).toBe(65000);
  });
});

import { extraFeesTotal } from "./factory";
import { quoteSummary } from "./factory-docs";
describe("自訂費用項目", () => {
  const r = { quote_amount: 100000, deposit_invoice_amount: 0, deposit_received_amount: 0, final_invoice_amount: 105000, government_fee: 3000, other_fee: 0, final_received_amount: 0, invoice_type: "開發票", extra_fees: [{ label: "竣工圖燒錄費", amount: 1500 }, { label: "", amount: 99 }, { label: "代刻印章", amount: 500 }] };
  it("只計有名稱的項目", () => expect(extraFeesTotal(r.extra_fees)).toBe(2000));
  it("尾款應收含自訂費用", () => expect(finalDue(r)).toBe(105000 + 3000 + 2000));
  it("報價單逐筆列出並保留規費", () => {
    const s = quoteSummary(r);
    expect(s.lines.map((l) => l.label)).toEqual(["營業稅(5%)", "規費(收據)", "竣工圖燒錄費", "代刻印章"]);
    expect(s.total).toBe(110000);
  });
});
