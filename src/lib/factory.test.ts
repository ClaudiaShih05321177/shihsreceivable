import { describe, expect, it } from "vitest";
import { factoryInitialStage, finalDue, nextFactoryStage, projectArStatus, projectOutstanding } from "./factory";

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
