import { describe, expect, it } from "vitest";
import { itemEntries, itemsTotal, taxItemNotes, taxLines, taxSummary } from "./receivables";

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

import { MONTHLY_TAX_ITEMS, splitTaxLines, taxItemMonths, taxDueMonth, withTaxItemMonths } from "./receivables";

const ALL_MONTHLY_TAX_ITEMS = ["租金扣繳", "薪資扣繳", "勞務扣繳", "其他扣繳", "2代A-B", "2代-4X獎金", "租金2代", "個人2代", "股利2代"] as const;

describe("稅款月份獨立於記帳期別", () => {
  it("9-10月期別的A-B可收11-12月並拆成兩筆各422元", () => {
    const items = { "2代A-B": 844 };
    const saved = withTaxItemMonths({ 文具: 116 }, { "2代A-B": "11-12" }, items);
    expect(taxItemMonths(JSON.parse(JSON.stringify(saved)))).toEqual({ "2代A-B": "11-12" });
    expect(saved["文具"]).toBe(116);
    const lines = splitTaxLines(items, "9-10", 11, saved);
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([["2代A-B#1", 422, [11]], ["2代A-B#2", 422, [12]]]);
    expect(lines.map((l) => taxDueMonth({ period_year: 2026, period_month: 11 }, l))).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
  it("同樣9-10月期別的A-B只收11月時整筆844元歸12月繳", () => {
    const l = splitTaxLines({ "2代A-B": 844 }, "9-10", 11, { __tax_months: { "2代A-B": "11" } });
    expect(l.map((x) => [x.key, x.amount, x.months])).toEqual([["2代A-B", 844, [11]]]);
    expect(taxDueMonth({ period_year: 2026, period_month: 11 }, l[0]!)).toEqual({ year: 2026, month: 12 });
  });
  it("各項扣繳與二代可填不同月份，單月不拆、雙月拆半", () => {
    const l = splitTaxLines({ 租金扣繳: 500, 租金2代: 100 }, "9-10", 11, { __tax_months: { 租金扣繳: "11", 租金2代: "11-12" } });
    expect(l.map((x) => [x.key, x.amount, x.months])).toEqual([["租金扣繳", 500, [11]], ["租金2代#1", 50, [11]], ["租金2代#2", 50, [12]]]);
  });
  it("明確稅款月份不被上方單月期別覆蓋", () => {
    expect(splitTaxLines({ 租金扣繳: 500 }, "9", 9, { __tax_months: { 租金扣繳: "11-12" } }).map((x) => x.months)).toEqual([[11], [12]]);
  });
  it("拒絕無效月份，不儲存已移除項目的月份", () => {
    expect(() => withTaxItemMonths({}, { 租金扣繳: "13" }, { 租金扣繳: 500 })).toThrow();
    expect(() => withTaxItemMonths({}, { 租金扣繳: "11-9" }, { 租金扣繳: 500 })).toThrow();
    expect(withTaxItemMonths({}, { 租金扣繳: "11" }, {})).toEqual({});
  });
});
describe("所有扣繳與二代依月份拆兩個月勾選", () => {
  it("拆月清單完整包含四類扣繳、公司A-B、4X獎金、租金、個人及股利二代", () => {
    expect(new Set(MONTHLY_TAX_ITEMS)).toEqual(new Set(ALL_MONTHLY_TAX_ITEMS));
  });
  it.each(ALL_MONTHLY_TAX_ITEMS)("%s 在11-12月期別各半拆成兩個獨立勾選鍵", (item) => {
    const lines = splitTaxLines({ [item]: 101 }, "11-12", 11);
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([[`${item}#1`, 51, [11]], [`${item}#2`, 50, [12]]]);
  });
  it.each(ALL_MONTHLY_TAX_ITEMS)("%s 只填11月時整筆不拆", (item) => {
    const lines = splitTaxLines({ [item]: 101 }, "11", 11);
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([[item, 101, [11]]]);
  });
  it("9月開立的扣繳與租金二代歸9、10月，與記帳費期別無關", () => {
    const l = splitTaxLines({ 租金扣繳: 4001, 租金2代: 100 }, "7-8", 9);
    expect(l.map((x) => [x.key, x.amount, x.months])).toEqual([["租金扣繳#1", 2001, [9]], ["租金扣繳#2", 2000, [10]], ["租金2代#1", 50, [9]], ["租金2代#2", 50, [10]]]);
  });
  it("11月開立的扣繳與二代歸11、12月", () => {
    const l = splitTaxLines({ 租金扣繳: 500 }, "9-10", 11);
    expect(l.map((x) => [x.key, x.months])).toEqual([["租金扣繳#1", [11]], ["租金扣繳#2", [12]]]);
  });
});

describe("AD15、AD41 與同類多筆稅款", () => {
  it("AD41 公司A-B 844元期別11-12月，12月與次年1月各422元", () => {
    const lines = splitTaxLines({ "2代A-B": 844 }, "11-12", 11);
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([["2代A-B#1", 422, [11]], ["2代A-B#2", 422, [12]]]);
    expect(lines.map((l) => taxDueMonth({ period_year: 2026, period_month: 11 }, l))).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
  it.each([{ total: 24780, half: 12390 }, { total: 247800, half: 123900 }])("AD15 薪資扣繳$total元填11-12月，12月與次年1月各$half元", ({ total, half }) => {
    const lines = splitTaxLines({ 薪資扣繳: total }, "9-10", 11, { __tax_months: { 薪資扣繳: "11-12" } });
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([["薪資扣繳#1", half, [11]], ["薪資扣繳#2", half, [12]]]);
    expect(lines.map((l) => taxDueMonth({ period_year: 2026, period_month: 11 }, l))).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
  it("薪資扣繳247800元只填11月，整筆247800元歸12月繳", () => {
    const lines = splitTaxLines({ 薪資扣繳: 247800 }, "9-10", 11, { __tax_months: { 薪資扣繳: "11" } });
    expect(lines.map((l) => [l.key, l.amount, l.months])).toEqual([["薪資扣繳", 247800, [11]]]);
    expect(taxDueMonth({ period_year: 2026, period_month: 11 }, lines[0]!)).toEqual({ year: 2026, month: 12 });
  });
  it("兩位房東的租金扣繳各自保存備註、月份、金額與獨立勾選鍵", () => {
    const items = { 租金扣繳: 1000, "租金扣繳::2": 4001 };
    const metadata = withTaxItemMonths({}, { 租金扣繳: "11", "租金扣繳::2": "11-12" }, items, { 租金扣繳: "房東甲", "租金扣繳::2": "房東乙" });
    expect(taxItemNotes(metadata)).toEqual({ 租金扣繳: "房東甲", "租金扣繳::2": "房東乙" });
    expect(itemsTotal(items)).toBe(5001);
    expect(itemEntries(items).map((l) => l.name)).toEqual(["租金扣繳", "租金扣繳::2"]);
    expect(taxLines(items).map((l) => [l.group, l.item])).toEqual([["扣繳稅額", "租金扣繳"], ["扣繳稅額", "租金扣繳::2"]]);
    expect(splitTaxLines(items, "9-10", 11, metadata).map((l) => [l.key, l.amount, l.months])).toEqual([
      ["租金扣繳", 1000, [11]],
      ["租金扣繳::2#1", 2001, [11]],
      ["租金扣繳::2#2", 2000, [12]],
    ]);
  });
});

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
  it("9月開立的扣繳：9月歸10月繳、10月歸11月繳", () => {
    const sep = { period_year: 2026, period_month: 9 };
    expect(taxDueMonth(sep, { group: "扣繳稅額", months: [9] })).toEqual({ year: 2026, month: 10 });
    expect(taxDueMonth(sep, { group: "扣繳稅額", months: [10] })).toEqual({ year: 2026, month: 11 });
  });
  it("11月開立的二代：11月歸12月繳、12月歸次年1月繳", () => {
    const nov = { period_year: 2026, period_month: 11 };
    expect(taxDueMonth(nov, { group: "二代健保", months: [11] })).toEqual({ year: 2026, month: 12 });
    expect(taxDueMonth(nov, { group: "二代健保", months: [12] })).toEqual({ year: 2027, month: 1 });
  });
});
