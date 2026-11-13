import { describe, expect, it } from "vitest";

import { FEE_ITEMS } from "@/lib/receivables";
import { feeItemCount, feeLabel, isFeeHidden, visibleFeeItems } from "./fee-labels";

describe("feeLabel", () => {
  it("uses the saved display name", () => {
    expect(feeLabel("文具")).toBe("工商代辦費");
    expect(feeLabel("印章")).toBe("扣繳-租金");
    expect(feeLabel("暫繳")).toBe("文具費");
  });

  it("falls back to the fee code when there is no saved name", () => {
    expect(feeLabel("記帳費")).toBe("記帳費");
    expect(feeLabel("年度加收")).toBe("年度加收");
  });

  it("leaves no fee field without a name", () => {
    expect(FEE_ITEMS.filter((k) => feeLabel(k).trim() === "")).toEqual([]);
  });

  it("has removed the 其他 fee field", () => {
    expect(FEE_ITEMS).not.toContain("其他");
    expect(FEE_ITEMS).toHaveLength(25);
  });

  it("hides only the retired fields", () => {
    expect(isFeeHidden("前期餘額")).toBe(true);
    expect(isFeeHidden("未加徵")).toBe(true);
    expect(isFeeHidden("記帳費")).toBe(false);
    expect(feeItemCount()).toBe(23);
  });

  it("shows a hidden fee field when it already holds money", () => {
    const shown = visibleFeeItems({
      showAll: false,
      common: ["記帳費"],
      hasValue: (k) => k === "前期餘額",
    });
    expect(shown).toContain("記帳費");
    expect(shown).toContain("前期餘額");
    expect(shown).not.toContain("營所稅");
  });
});
