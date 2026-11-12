import { describe, expect, it } from "vitest";
import { auditSummary } from "./auditors";

describe("auditSummary", () => {
  it("groups 財稅簽證 fees by auditor and skips invoices without the fee", () => {
    const g = auditSummary([
      { auditor: "秉誠", items: { 財稅簽證: 20000 }, amount: 20000 },
      { auditor: "秉誠", items: { 財稅簽證: 5000, 記帳費: 1 }, amount: 5001 },
      { auditor: "眾智", items: { 財稅簽證: 8000 }, amount: 8000 },
      { auditor: null, items: { 財稅簽證: 3000 }, amount: 3000 },
      { auditor: "詮益", items: { 記帳費: 1000 }, amount: 1000 },
    ]);
    expect(g.map((x) => [x.name, x.rows.length, x.total])).toEqual([
      ["秉誠", 2, 25000], ["詮益", 0, 0], ["眾智", 1, 8000], ["未指定", 1, 3000],
    ]);
  });
});
