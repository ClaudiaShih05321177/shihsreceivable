import { bookkeepingCollectionMonth, otherKey, type FeeItems } from "./receivables";

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
export const CASE_TYPES = ["設立登記", "變更登記", "遷址登記", "增資登記", "解散登記", "註銷登記", "其他"] as const;

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

export type FilingFeeLike = { service_fee?: number | string | null; advance_fee: number | string; stamp_fee?: number | string | null };

/** 印章費在帳款費用項目裡的說明文字。 */
export const STAMP_FEE_LABEL = "印章";

/** 客戶代碼前兩位英文字母即會計專員代號（例 AC15 → AC）；不符合則為 null。 */
export function staffFromCode(code: string | null | undefined): string | null {
  const m = /^\s*([A-Za-z]{2})/.exec(code ?? "");
  return m ? m[1]!.toUpperCase() : null;
}

/** 工商帳款併入的雙月記帳期別：核准月若為雙月，併入下一個單月（12 月併入隔年 1 月）。 */
export function filingBillingPeriod(dateISO: string): { year: number; month: number } {
  const [y = 0, m = 1] = dateISO.slice(0, 7).split("-").map(Number);
  const month = bookkeepingCollectionMonth(m);
  return month > 12 ? { year: y + 1, month: 1 } : { year: y, month };
}

/** 合併費用項目（同名金額相加）。 */
export function mergeFeeItems(base: FeeItems | null | undefined, add: FeeItems): FeeItems {
  const out: FeeItems = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(add)) out[k] = (Number(out[k]) || 0) + (Number(v) || 0);
  return out;
}

/** 費用項目合計。 */
export function feeItemsTotal(items: FeeItems): number {
  return Object.values(items).reduce<number>((s, v) => s + (Number(v) || 0), 0);
}

/** 代墊規費在帳款費用項目裡的說明文字。 */
export const ADVANCE_FEE_LABEL = "代墊規費";

/** 結案立帳的費用項目：代辦費存入顯示為「工商代辦費」的欄位（鍵「文具」），代墊規費存自訂項目。 */
export function filingInvoiceItems(filing: FilingFeeLike): FeeItems {
  const items: FeeItems = {};
  const service = Math.round(Number(filing.service_fee) || 0);
  const advance = Math.round(Number(filing.advance_fee) || 0);
  if (service > 0) items["文具"] = service;
  const stamp = Math.round(Number(filing.stamp_fee) || 0);
  if (advance > 0) items[otherKey(ADVANCE_FEE_LABEL)] = advance;
  if (stamp > 0) items[otherKey(STAMP_FEE_LABEL)] = stamp;
  return items;
}

/** 案件費用合計（代辦費＋代墊規費＋印章）。 */
export function filingTotal(filing: FilingFeeLike): number {
  return feeItemsTotal(filingInvoiceItems(filing));
}
