import { describe, expect, it } from "vitest";

import { parseRocDate } from "./roc-date";

describe("parseRocDate", () => {
  it("解析民國年日期", () => {
    expect(parseRocDate("115/1/15")).toBe("2026-01-15");
    expect(parseRocDate("115-11-5")).toBe("2026-11-05");
    expect(parseRocDate("114.12.31")).toBe("2025-12-31");
  });

  it("補零並接受空白", () => {
    expect(parseRocDate(" 115/2/3 ")).toBe("2026-02-03");
  });

  it("拒絕無效日期", () => {
    expect(parseRocDate("115/13/1")).toBeNull();
    expect(parseRocDate("115/2/30")).toBeNull();
    expect(parseRocDate("2026/1/15")).toBeNull();
    expect(parseRocDate("abc")).toBeNull();
    expect(parseRocDate("")).toBeNull();
  });
});
