import { otherKey, type FeeItems } from "./receivables";

/** 工商案件進度階段，依序推進（經濟部→國稅局→結案）。 */
export const FILING_STAGES = ["預查", "送件", "核准", "國稅局送件", "國稅局核准", "結案"] as const;
export type FilingStage = (typeof FILING_STAGES)[number];

/** 送件流程：經濟部送完接國稅局，或只送國稅局。 */
export const FILING_ROUTES = ["經濟部+國稅局", "只送國稅局"] as const;
export const TAX_ONLY_ROUTE = "只送國稅局";
const TAX_ONLY_STAGES: readonly FilingStage[] = ["國稅局送件", "國稅局核准", "結案"];

/** 該流程適用的階段。 */
export function stagesFor(route: string | null | undefined): readonly FilingStage[] {
  return route === TAX_ONLY_ROUTE ? TAX_ONLY_STAGES : FILING_STAGES;
}

/** 新案件的起始階段。 */
export function initialStage(route: string | null | undefined): FilingStage {
  return stagesFor(route)[0]!;
}

/** 案件類型。 */
export const CASE_TYPES = ["新設立", "設立登記", "變更登記", "遷址登記", "增資登記", "解散登記", "註銷登記", "其他"] as const;

/** 下一個階段；已結案維持結案。 */
export function nextStage(stage: string, route?: string | null): FilingStage {
  const list = stagesFor(route);
  const i = list.indexOf(stage as FilingStage);
  if (i < 0) return list[0]!;
  return list[Math.min(i + 1, list.length - 1)]!;
}

/** 案件顯示名稱：已連結客戶用客戶名稱，新設立尚無客戶用暫定公司名稱。 */
export function filingName(f: { customer?: { name: string } | null; company_name?: string | null }): string {
  return f.customer?.name ?? (f.company_name ? `${f.company_name}（新設立）` : "—");
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
