import { describe, expect, it } from "vitest";
import { canEditInvoice, canManageFactoryProgress, canSeePage, permissionsFor } from "./permissions";

describe("帳號權限", () => {
  it("使用者可以查看與立帳", () => {
    const p = permissionsFor(["member"]);
    expect([p.canView, p.canCreate]).toEqual([true, true]);
  });
  it("只有管理員可以銷帳", () => {
    expect(permissionsFor(["member"]).canRecordPayment).toBe(false);
    expect(permissionsFor(["admin"]).canRecordPayment).toBe(true);
  });
  it("使用者立帳後可以修改，管理員也可以", () => {
    expect(permissionsFor(["member"]).canEdit).toBe(true);
    expect(permissionsFor(["admin"]).canEdit).toBe(true);
  });
  it("已有收款紀錄的帳款只有管理員能修改", () => {
    expect(canEditInvoice({ isAdmin: false }, { payments: [] })).toBe(true);
    expect(canEditInvoice({ isAdmin: false }, { payments: [{}] })).toBe(false);
    expect(canEditInvoice({ isAdmin: true }, { payments: [{}] })).toBe(true);
  });
  it("使用者不能刪除資料", () => {
    expect(permissionsFor(["member"]).canDelete).toBe(false);
  });
  it("只有管理員能管理團隊", () => {
    expect(permissionsFor(["member"]).canManageTeam).toBe(false);
    expect(permissionsFor(["admin"]).canManageTeam).toBe(true);
  });
  it("管理員可以刪除資料", () => {
    expect(permissionsFor(["admin"]).canDelete).toBe(true);
  });
  it("待核准帳號不能查看或操作帳務", () => {
    expect(permissionsFor([])).toEqual({ isAdmin: false, isMember: false, canView: false, canCreate: false, canEdit: false, canRecordPayment: false, canDelete: false, canManageTeam: false, canManageBonusRates: false });
  });
  it("only admins can view and edit special customer annual bonus percentages", () => {
    expect(permissionsFor(["admin"]).canManageBonusRates).toBe(true);
    expect(permissionsFor(["member"]).canManageBonusRates).toBe(false);
    expect(permissionsFor([]).canManageBonusRates).toBe(false);
  });
});
describe("一般使用者可見頁面", () => {
  it("MN 與管理員可新增工廠案件，其他同仁不可", () => {
    expect(canManageFactoryProgress({ isAdmin: false, staffCode: "MN" })).toBe(true);
    expect(canManageFactoryProgress({ isAdmin: true })).toBe(true);
    expect(canManageFactoryProgress({ isAdmin: false, staffCode: "CA" })).toBe(false);
    expect(canManageFactoryProgress({ isAdmin: false, staffCode: null })).toBe(false);
  });
  it("MN 可以查看並變更工廠進度", () => {
    expect(canSeePage(false, "/factory", "MN")).toBe(true);
    expect(canManageFactoryProgress({ isAdmin: false, staffCode: "MN" })).toBe(true);
  });
  it("其他同仁不可變更工廠進度，MN 不可看勤豐帳款或文件", () => {
    expect(canManageFactoryProgress({ isAdmin: false, staffCode: "CA" })).toBe(false);
    expect(canSeePage(false, "/factory", "CA")).toBe(false);
    expect(canSeePage(false, "/factory-customers", "CA")).toBe(false);
    expect(canSeePage(false, "/factory-customers", "AD")).toBe(false);
    expect(canSeePage(false, "/factory-receivables", "MN")).toBe(false);
    expect(canSeePage(false, "/factory-doc/abc", "MN")).toBe(false);
  });
  it("只能看應收帳款、工商進度、客戶資料", () => {
    expect(["/invoices", "/filings", "/customers", "/customers/abc"].every((p) => canSeePage(false, p))).toBe(true);
    expect(["/dashboard", "/taxes", "/audits", "/bonuses", "/team", "/factory"].some((p) => canSeePage(false, p))).toBe(false);
    expect(canSeePage(true, "/bonuses")).toBe(true);
  });
});
