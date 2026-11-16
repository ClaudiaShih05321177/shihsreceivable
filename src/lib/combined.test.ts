import { describe, expect, it } from "vitest";
import { allocateCombined } from "./combined";

const t = [{ id: "a", balance: 10000 }, { id: "b", balance: 8000 }];
describe("allocateCombined", () => {
  it("一次收 18,000 沖銷兩筆", () => expect(allocateCombined(t, 18000, 0)).toEqual([{ invoice_id: "a", amount: 10000, bank_fee: 0 }, { invoice_id: "b", amount: 8000, bank_fee: 0 }]));
  it("扣匯費 15 元仍全額沖銷，匯費記在第一筆", () => expect(allocateCombined(t, 17985, 15)).toEqual([{ invoice_id: "a", amount: 10000, bank_fee: 15 }, { invoice_id: "b", amount: 8000, bank_fee: 0 }]));
  it("不足時依序沖銷，後面的不建立收款", () => expect(allocateCombined(t, 6000, 0)).toEqual([{ invoice_id: "a", amount: 6000, bank_fee: 0 }]));
  it("多收記在最後一筆成溢收", () => expect(allocateCombined(t, 19000, 0)[1]?.amount).toBe(9000));
});
