import { otherKey, type FeeItems } from "./receivables";

/** 工商案件進度階段，依序推進。 */
export const FILING_STAGES = ["預查", "送件", "核准", "結案"] as const;
export type FilingStage = (typeof FILING_STAGES)[number];

/** 案件類型。 */
export const CASE_TYPES = ["設立登記", "變更登記", "遷址登記", "增資登記", "解散登記", "註銷登記", "其他"] as const;

/** 下一個階段；已結案維持結案。 */
export function nextStage(stage: string): FilingStage {
  const i = FILING_STAGES.indexOf(stage as FilingStage);
  return FILING_STAGES[Math.min(i + 1, FILING_STAGES.length - 1)] ?? FILING_STAGES[0];
}

export type FilingFeeLike = { service_fee: number | string; advance_fee: number | string };

/** 代墊規費在帳款費用項目裡的說明文字。 */
export const ADVANCE_FEE_LABEL = "代墊規費";

/** 結案立帳的費用項目：代辦費存入顯示為「工商代辦費」的欄位（鍵「文具」），代墊規費存自訂項目。 */
export function filingInvoiceItems(filing: FilingFeeLike): FeeItems {
  const items: FeeItems = {};
  const service = Math.round(Number(filing.service_fee) || 0);
  const advance = Math.round(Number(filing.advance_fee) || 0);
  if (service > 0) items["文具"] = service;
  if (advance > 0) items[otherKey(ADVANCE_FEE_LABEL)] = advance;
  return items;
}

/** 案件費用合計（代辦費＋代墊規費）。 */
export function filingTotal(filing: FilingFeeLike): number {
  return (Math.round(Number(filing.service_fee) || 0)) + (Math.round(Number(filing.advance_fee) || 0));
}
