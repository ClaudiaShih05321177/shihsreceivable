import { describe, expect, it } from "vitest";

import { normalizeBankDate, normalizeName, txnFingerprint } from "@/lib/bank-parse";

describe("normalizeName", () => {
  it("去除公司後綴與空白，便於比對匯款人", () => {
    expect(normalizeName("睿森菓屋有限公司")).toBe("睿森菓屋");
    expect(normalizeName(" 睿森菓屋 股份有限公司 ")).toBe("睿森菓屋");
    expect(normalizeName("ABC (Taiwan) 有限公司")).toBe("ABC(TAIWAN)".replace(/[()]/g, ""));
  });
});

describe("txnFingerprint", () => {
  it("同日期同金額同摘要視為同一筆（忽略大小寫與多餘空白）", () => {
    expect(txnFingerprint("2026-01-05", 5000, "睿森 菓屋")).toBe(txnFingerprint("2026-01-05", 5000, "睿森  菓屋"));
  });
  it("日期或金額不同就是不同筆", () => {
    expect(txnFingerprint("2026-01-05", 5000, "甲")).not.toBe(txnFingerprint("2026-01-06", 5000, "甲"));
    expect(txnFingerprint("2026-01-05", 5000, "甲")).not.toBe(txnFingerprint("2026-01-05", 6000, "甲"));
  });
});

describe("normalizeBankDate", () => {
  const today = "2026-11-16";
  it("民國年轉西元", () => {
    expect(normalizeBankDate("115/01/05", today)).toBe("2026-01-05");
    expect(normalizeBankDate("115.1.5", today)).toBe("2026-01-05");
    expect(normalizeBankDate("115年1月5日", today)).toBe("2026-01-05");
  });
  it("西元年直接使用", () => {
    expect(normalizeBankDate("2026-01-05", today)).toBe("2026-01-05");
  });
  it("只有月日時用今天的年份", () => {
    expect(normalizeBankDate("01/05", today)).toBe("2026-01-05");
  });
  it("認不出來回傳 null", () => {
    expect(normalizeBankDate("昨天", today)).toBeNull();
    expect(normalizeBankDate(null, today)).toBeNull();
    expect(normalizeBankDate("2026/13/40", today)).toBeNull();
  });
});
