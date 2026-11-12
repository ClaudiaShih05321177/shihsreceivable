import { describe, expect, it } from "vitest";
import { feeItemCount, feeLabel, feeLabelMap, isFeeHidden, visibleFeeItems } from "./fee-labels";

describe("feeLabel", () => {
  const map = feeLabelMap([
    { key: "文具", label: "工商代辦費", hidden: false },
    { key: "暫繳", label: "", hidden: true },
  ]);

  it("uses the database name first, then the default name, then the fee code", () => {
    expect(feeLabel("文具", map)).toBe("工商代辦費");
    expect(feeLabel("印章", map)).toBe("租金扣繳");
    expect(feeLabel("記帳費", map)).toBe("記帳費");
  });

  it("keeps a blank database name blank instead of falling back", () => {
    expect(feeLabel("暫繳", map)).toBe("");
  });

  it("hides only when the database says so", () => {
    expect(isFeeHidden("暫繳", map)).toBe(true);
    expect(isFeeHidden("文具", map)).toBe(false);
    expect(isFeeHidden("暫繳", null)).toBe(false);
    expect(feeItemCount(map)).toBe(26);
  });

  it("shows a hidden fee field when it already holds money", () => {
    const shown = visibleFeeItems(map, {
      showAll: false,
      common: ["記帳費"],
      hasValue: (k) => k === "暫繳",
    });
    expect(shown).toContain("記帳費");
    expect(shown).toContain("暫繳");
    expect(shown).not.toContain("營所稅");
  });
});
