import { describe, expect, it } from "vitest";
import { permissionsFor } from "./permissions";

describe("帳號權限", () => {
  it("使用者可以查看與立帳", () => {
    const p = permissionsFor(["member"]);
    expect([p.canView, p.canCreate]).toEqual([true, true]);
  });
  it("只有管理員可以銷帳", () => {
    expect(permissionsFor(["member"]).canRecordPayment).toBe(false);
    expect(permissionsFor(["admin"]).canRecordPayment).toBe(true);
  });
  it("一般使用者只能立帳，不能修改既有資料", () => {
    expect(permissionsFor(["member"]).canEdit).toBe(false);
    expect(permissionsFor(["admin"]).canEdit).toBe(true);
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