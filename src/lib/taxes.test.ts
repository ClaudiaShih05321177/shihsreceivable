import { describe, expect, it } from "vitest";
import { taxLines, taxSummary } from "./receivables";

describe("tax lines", () => {
  it("groups withholding and 二代健保 items and skips non-tax fees", () => {
    const lines = taxLines({ 記帳費: 3000, 營業稅: 500, 薪資扣繳: 200, 勞務扣繳: 100, 個人2代: 50 });
    expect(lines.map((l) => l.item)).toEqual(["營業稅", "薪資扣繳", "勞務扣繳", "個人2代"]);
  });
  it("lists 股利2代 as its own group, separate from 二代健保", () => {
    const lines = taxLines({ 股利2代: 80, 個人2代: 50 });
    expect(lines).toEqual([
      { group: "二代健保", item: "個人2代", amount: 50 },
      { group: "股利二代", item: "股利2代", amount: 80 },
    ]);
    const s = taxSummary(lines.map((l) => ({ ...l, paid: false })));
    expect(s.find((g) => g.label === "股利二代")).toMatchObject({ total: 80, unpaid: 80 });
    expect(s.find((g) => g.label === "二代健保")).toMatchObject({ total: 50, unpaid: 50 });
  });
  it("sums totals and paid amounts per group", () => {
    const s = taxSummary([
      { group: "扣繳稅額", item: "薪資扣繳", amount: 200, paid: true },
      { group: "扣繳稅額", item: "勞務扣繳", amount: 100, paid: false },
    ]);
    expect(s.find((g) => g.label === "扣繳稅額")).toMatchObject({ total: 300, paid: 200, unpaid: 100 });
  });
});

import { splitTaxLines } from "./receivables";
describe("租金扣繳、租金二代、公司二代拆兩個月勾選", () => {
  it("租金扣繳、租金2代拆兩列，其他扣繳與二代不拆", () => {
    const l = splitTaxLines({ 營業稅: 500, 薪資扣繳: 4000, 租金扣繳: 4001, 租金2代: 100, 個人2代: 100 });
    expect(l.map((x) => [x.key, x.amount])).toEqual([["營業稅", 500], ["租金扣繳#1", 2001], ["租金扣繳#2", 2000], ["薪資扣繳", 4000], ["租金2代#1", 50], ["租金2代#2", 50], ["個人2代", 100]]);
  });
  it("公司二代 AD41 844 於 11-12 期拆成 11月 422、12月 422", () => {
    const l = splitTaxLines({ "2代A-B": 844 }, "11-12");
    expect(l.map((x) => [x.key, x.amount, x.months])).toEqual([["2代A-B#1", 422, [11]], ["2代A-B#2", 422, [12]]]);
  });
  it("期別只填單月時不拆，全額歸該月", () => {
    const l = splitTaxLines({ "2代A-B": 844, 租金扣繳: 500 }, "11");
    expect(l.map((x) => [x.key, x.amount, x.months])).toEqual([["租金扣繳", 500, [11]], ["2代A-B", 844, [11]]]);
  });
});

import { taxDueMonth } from "./receivables";
describe("taxDueMonth 依申報繳款月", () => {
  const jan = { period_year: 2026, period_month: 1 };
  it("前期11-12月營業稅歸1月", () => expect(taxDueMonth(jan, { group: "營業稅", months: [11, 12] })).toEqual({ year: 2026, month: 1 }));
  it("12月扣繳歸次年1月、11月扣繳歸12月", () => {
    expect(taxDueMonth(jan, { group: "扣繳稅額", months: [12] })).toEqual({ year: 2026, month: 1 });
    expect(taxDueMonth(jan, { group: "扣繳稅額", months: [11] })).toEqual({ year: 2025, month: 12 });
  });
  it("3-4月營業稅歸5月", () => expect(taxDueMonth({ period_year: 2026, period_month: 5 }, { group: "營業稅", months: [3, 4] })).toEqual({ year: 2026, month: 5 }));
  it("營所稅5月、暫繳9月", () => {
    expect(taxDueMonth(jan, { group: "營所稅", months: null }).month).toBe(5);
    expect(taxDueMonth(jan, { group: "暫繳稅額", months: null }).month).toBe(9);
  });
});
