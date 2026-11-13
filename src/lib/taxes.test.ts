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
describe("扣繳與二代健保拆兩個月勾選", () => {
  it("扣繳與二代拆成兩列，營業稅不拆", () => {
    const l = splitTaxLines({ 營業稅: 500, 薪資扣繳: 4001, 個人2代: 100 });
    expect(l.map((x) => [x.key, x.amount])).toEqual([["營業稅", 500], ["薪資扣繳#1", 2001], ["薪資扣繳#2", 2000], ["個人2代#1", 50], ["個人2代#2", 50]]);
  });
});
