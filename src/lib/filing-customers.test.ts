import { describe, expect, it } from "vitest";
import { filingCustomerCode, filingCustomerLink, findFilingCustomer } from "./filing-customers";

const customers = [
  { id: "office-1", name: "公司甲", tax_id: "12345678", customer_code: "AC15" },
  { id: "office-2", name: "同名公司", tax_id: "11111111", customer_code: "BF01" },
  { id: "office-3", name: "同名公司", tax_id: "22222222", customer_code: "BF02" },
];
describe("工商客戶與帳款連結", () => {
  it("目前名冊的 CF185 優先帶入且保留原帳款客戶識別", () => {
    const customer = { id: "office-existing", name: "弘致科技有限公司", customer_code: "CF185" };
    expect(filingCustomerLink(customer)).toEqual({ customer_id: "office-existing", customer_code: "CF185", company_name: "" });
    expect(filingCustomerCode("CF185", "CF100")).toBe("CF185");
  });
  it("空白名冊代碼不遮住案件既有代碼", () => {
    expect(filingCustomerCode("  ", "CL05")).toBe("CL05");
  });
  it("名稱唯一時帶入該客戶的帳款識別與代碼", () => {
    const customer = findFilingCustomer(customers, " 公司甲 ", "");
    expect(customer && filingCustomerLink(customer)).toEqual({ customer_id: "office-1", customer_code: "AC15", company_name: "" });
  });
  it("依統編而不是舊公司名稱帶入正確帳款客戶", () => {
    const customer = findFilingCustomer(customers, "公司甲", "22222222");
    expect(customer && filingCustomerLink(customer)).toEqual({ customer_id: "office-3", customer_code: "BF02", company_name: "" });
  });
  it("同名或同統編多帳戶不自動配對", () => {
    expect(findFilingCustomer(customers, "同名公司", "")).toBeUndefined();
    expect(findFilingCustomer([...customers, { id: "office-4", name: "公司甲", tax_id: "12345678", customer_code: "AC16" }], "", "12345678")).toBeUndefined();
  });
  it("未知統編不改以名稱錯配", () => {
    expect(findFilingCustomer(customers, "公司甲", "99999999")).toBeUndefined();
  });
  it("換客戶時清除舊代碼，不沿用其他公司代碼", () => {
    expect(filingCustomerLink({ id: "office-5", name: "無碼公司", customer_code: null }).customer_code).toBe("");
  });
});