import { describe, expect, it } from "vitest";
import { taxLines, taxSummary } from "./receivables";

describe("tax lines", () => {
  it("groups withholding and 二代健保 items and skips non-tax fees", () => {
    const lines = taxLines({ 記帳費: 3000, 營業稅: 500, 薪資扣繳: 200, 勞務扣繳: 100, 個人2代: 50 });
    expect(lines.map((l) => l.item)).toEqual(["營業稅", "薪資扣繳", "勞務扣繳", "個人2代"]);
  });
  it("sums totals and paid amounts per group", () => {
    const s = taxSummary([
      { group: "扣繳稅額", item: "薪資扣繳", amount: 200, paid: true },
      { group: "扣繳稅額", item: "勞務扣繳", amount: 100, paid: false },
    ]);
    expect(s.find((g) => g.label === "扣繳稅額")).toMatchObject({ total: 300, paid: 200, unpaid: 100 });
  });
});
