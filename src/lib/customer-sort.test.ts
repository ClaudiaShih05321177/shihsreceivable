import { describe, expect, it } from "vitest";
import { sortByStaff } from "./customer-sort";

const c = (staff_code: string | null, customer_code: string | null, name: string) => ({ staff_code, customer_code, name });

describe("客戶依記帳員排序", () => {
  it("有記帳員的排在前面，未指派的排最後", () => {
    const sorted = sortByStaff([c(null, "ZZ01", "甲"), c("AC", "AA01", "乙"), c("", "MM01", "丙")]);
    expect(sorted.map((r) => r.name)).toEqual(["乙", "丙", "甲"]);
  });

  it("依記帳員代碼排序，同記帳員再依客戶ID", () => {
    const sorted = sortByStaff([
      c("B", "B32", "全通實業社"),
      c("AC", "AC13", "宇光"),
      c("AC", "AC02", "大同"),
      c("AB01", "AB01", "宇光日光燈"),
    ]);
    expect(sorted.map((r) => r.customer_code)).toEqual(["AB01", "AC02", "AC13", "B32"]);
  });

  it("數字代碼依數值大小比較（2 排在 10 前面）", () => {
    const sorted = sortByStaff([c("代10", "X", "十"), c("代2", "Y", "二")]);
    expect(sorted.map((r) => r.name)).toEqual(["二", "十"]);
  });

  it("不改變原本陣列的順序", () => {
    const rows = [c("B", "B1", "乙"), c("A", "A1", "甲")];
    sortByStaff(rows);
    expect(rows.map((r) => r.name)).toEqual(["乙", "甲"]);
  });
});
