import { describe, expect, it } from "vitest";
import { depositTaxSplit, factoryInitialStage, finalDue, nextFactoryStage, projectArStatus, projectOutstanding } from "./factory";

describe("訂金稅金拆分", () => {
  it("訂金未稅 30,000 外加稅 1,500＝含稅 31,500", () => {
    expect(depositTaxSplit(30000)).toEqual({ base: 30000, tax: 1500, total: 31500 });
  });
  it("空白或 0 回傳 0", () => {
    expect(depositTaxSplit(null)).toEqual({ base: 0, tax: 0, total: 0 });
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
  it("未收餘額與狀態（訂金含稅 31,500）", () => {
    expect(projectOutstanding(ar)).toBe(106500);
    expect(projectArStatus(ar)).toBe("簽約金待收");
    expect(projectArStatus({ ...ar, deposit_received_amount: 30000 })).toBe("簽約金待收");
    expect(projectArStatus({ ...ar, deposit_received_amount: 31500 })).toBe("尾款待收");
    expect(projectArStatus({ ...ar, deposit_received_amount: 31500, final_received_amount: 75000 })).toBe("已收清");
  });
});

import { autoFinalInvoice as afi, contractTotal as ct, finalDue as fd, projectOutstanding as po } from "./factory";
describe("發票類型", () => {
  const base = { quote_amount: 100000, deposit_invoice_amount: 0, deposit_received_amount: 0, final_invoice_amount: 0, government_fee: 3000, other_fee: 2000, final_received_amount: 0 };
  it("開發票報價外加5%", () => expect(ct(100000, "開發票")).toBe(105000));
  it("尾款發票＝含稅總額−含稅訂金", () => expect(afi(100000, 30000, "開發票")).toBe(73500));
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

import { invoiceSummary } from "./factory-docs";
describe("訂金請款單", () => {
  const r = { quote_amount: 60000, deposit_invoice_amount: 30000, deposit_received_amount: 0, final_invoice_amount: 31500, government_fee: 0, other_fee: 0, final_received_amount: 0, invoice_type: "開發票" };
  it("訂金未稅 30,000＋稅 1,500＝31,500", () => {
    const s = invoiceSummary(r, "訂金");
    expect(s.consulting).toBe(30000);
    expect(s.total).toBe(31500);
  });
  it("尾款扣含稅簽約金", () => expect(invoiceSummary(r, "尾款").total).toBe(31500));
});

import { stageFromDates } from "./factory";
describe("stageFromDates", () => {
  it("環保核准日期填入後進到環保核准", () => expect(stageFromDates("送件環保", { env_approved_date: "2026-11-01" })).toBe("環保核准"));
  it("不倒退", () => expect(stageFromDates("送件工商科", { env_approved_date: "2026-11-01" })).toBe("送件工商科"));
  it("核准結案日期優先", () => expect(stageFromDates("送件環保", { env_filed_date: "x", approved_date: "y" })).toBe("核准結案"));
});

import { envOnly, needsEnv as ne, factoryInitialStage as fis, nextFactoryStage as nfs } from "./factory";
describe("只跑環保", () => {
  it("從送件環保開始", () => expect(fis("只跑環保")).toBe("送件環保"));
  it("需填環保日期", () => expect(ne("只跑環保")).toBe(true));
  it("環保核准後直接核准結案", () => expect(nfs("環保核准", false, "只跑環保")).toBe("核准結案"));
  it("一般需跑環保仍送工商科", () => expect(nfs("環保核准", false, "需跑環保")).toBe("送件工商科"));
  it("envOnly 判斷", () => expect(envOnly("免跑環保")).toBe(false));
});
