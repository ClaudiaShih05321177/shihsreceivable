import { describe, expect, it } from "vitest";

import { filingInvoiceItems, filingTotal, nextStage } from "./filings";
import { feeLabel } from "./fee-labels";

describe("nextStage", () => {
  it("依序推進 預查→送件→核准→國稅局送件", () => {
    expect(nextStage("預查")).toBe("送件");
    expect(nextStage("送件")).toBe("核准");
    expect(nextStage("核准")).toBe("國稅局送件");
  });

  it("結案後維持結案", () => {
    expect(nextStage("結案")).toBe("結案");
  });
});

describe("filingInvoiceItems", () => {
  it("代辦費存入顯示為工商代辦費的欄位，代墊規費存自訂項目", () => {
    const items = filingInvoiceItems({ service_fee: 5000, advance_fee: 1200 });
    expect(items["工商"]).toBe(5000);
    expect(feeLabel("工商")).toBe("工商代辦費");
    expect(items["其他：代墊規費"]).toBe(1200);
  });

  it("金額為 0 的項目不產生", () => {
    expect(filingInvoiceItems({ service_fee: 3000, advance_fee: 0 })).toEqual({ 工商: 3000 });
    expect(filingInvoiceItems({ service_fee: 0, advance_fee: 0 })).toEqual({});
  });
});

describe("filingTotal", () => {
  it("代辦費加代墊規費", () => {
    expect(filingTotal({ service_fee: 5000, advance_fee: 1200 })).toBe(6200);
    expect(filingTotal({ service_fee: "5000", advance_fee: "" })).toBe(5000);
  });
});

import { nextStage as ns2, initialStage, filingName } from "./filings";
describe("國稅局進度", () => {
  it("經濟部核准後接國稅局送件、國稅局核准、結案", () => {
    expect(ns2("核准", "經濟部+國稅局")).toBe("國稅局送件");
    expect(ns2("國稅局送件")).toBe("國稅局核准");
    expect(ns2("國稅局核准")).toBe("結案");
  });
  it("只送國稅局的案件從國稅局送件開始", () => {
    expect(initialStage("只送國稅局")).toBe("國稅局送件");
    expect(ns2("國稅局送件", "只送國稅局")).toBe("國稅局核准");
  });
  it("新設立無客戶時顯示暫定名稱", () => {
    expect(filingName({ customer: null, company_name: "新光公司" })).toBe("新光公司（新設立）");
  });
});

import { filingBillingPeriod, mergeFeeItems, staffFromCode } from "./filings";

describe("工商費用與派案", () => {
  it("代刻印章存入印章欄位並計入合計", () => {
    expect(filingInvoiceItems({ service_fee: 0, advance_fee: 1000, stamp_fee: 800 })).toEqual({ "其他：代墊規費": 1000, 印章: 800 });
    expect(filingTotal({ service_fee: 5000, advance_fee: 1000, stamp_fee: 800 })).toBe(6800);
  });
  it("客戶代碼前兩位英文字母為會計專員代號", () => {
    expect(staffFromCode("ac15")).toBe("AC");
    expect(staffFromCode("BF09")).toBe("BF");
    expect(staffFromCode("1234")).toBeNull();
  });
  it("工商帳款併入雙月記帳期別（單數月）", () => {
    expect(filingBillingPeriod("2026-11-20")).toEqual({ year: 2026, month: 11 });
    expect(filingBillingPeriod("2026-10-05")).toEqual({ year: 2026, month: 11 });
    expect(filingBillingPeriod("2026-12-05")).toEqual({ year: 2027, month: 1 });
  });
  it("併入既有帳單時同名費用相加", () => {
    expect(mergeFeeItems({ 記帳費: 6000, "其他：印章": 200 }, { "其他：印章": 800, 文具: 5000 })).toEqual({ 記帳費: 6000, "其他：印章": 1000, 文具: 5000 });
  });
});

import { billingTypeOnClose, canCloseFiling, CASE_TYPES } from "./filings";
describe("案件類型", () => {
  it("解散登記已改名為法院報備，註銷登記保留", () => {
    expect(CASE_TYPES).toContain("法院報備");
    expect(CASE_TYPES).not.toContain("解散登記");
    expect(CASE_TYPES).toContain("註銷登記");
  });
  it("遷址、增資併入變更登記", () => {
    expect(CASE_TYPES).toContain("變更登記");
    expect(CASE_TYPES).not.toContain("遷址登記");
    expect(CASE_TYPES).not.toContain("增資登記");
  });
});
describe("停業／復業登記連動收費狀態", () => {
  it("停業登記結案改停業，復業登記結案改回期收", () => {
    expect(billingTypeOnClose("停業登記")).toBe("停業");
    expect(billingTypeOnClose("復業登記")).toBe("期收");
    expect(billingTypeOnClose("變更登記")).toBe(null);
  });
});
describe("結案權限", () => {
  it("只有 CA、MN 與管理員可以結案", () => {
    expect(canCloseFiling(false, "CA")).toBe(true);
    expect(canCloseFiling(false, "MN")).toBe(true);
    expect(canCloseFiling(false, "AD")).toBe(false);
    expect(canCloseFiling(false, null)).toBe(false);
    expect(canCloseFiling(true, null)).toBe(true);
  });
});

import { extendSuspendedPeriod } from "./filings";
describe("展延停業", () => {
  it("展延停業結案也改停業", () => { expect(billingTypeOnClose("展延停業")).toBe("停業"); });
  it("接續原期間往後一年", () => {
    expect(extendSuspendedPeriod("114/7-115/6")).toBe("115/7-116/6");
    expect(extendSuspendedPeriod("115/1-115/12")).toBe("116/1-116/12");
    expect(extendSuspendedPeriod("114/7/1-115/6/30")).toBe("115/7/1-116/6/30");
    expect(extendSuspendedPeriod("")).toBe("");
  });
});

describe("展延停業連日推算", () => {
  it("115/1/1-115/12/31 延成 116/1/1-116/12/31", () => { expect(extendSuspendedPeriod("115/1/1-115/12/31")).toBe("116/1/1-116/12/31"); });
  it("114/7/15-115/7/14 延成 115/7/15-116/7/14", () => { expect(extendSuspendedPeriod("114/7/15-115/7/14")).toBe("115/7/15-116/7/14"); });
});
