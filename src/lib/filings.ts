import { bookkeepingCollectionMonth, otherKey, type FeeItems } from "./receivables";

/** 工商案件進度階段，依序推進（主管機關→國稅局→結案）。 */
export const FILING_STAGES = ["預查", "送件", "核准", "國稅局送件", "國稅局核准", "結案"] as const;
export type FilingStage = (typeof FILING_STAGES)[number];

/** 送件流程：主管機關（經濟部、縣市政府、教育局等）送完接國稅局、只送主管機關，或只送國稅局。 */
export const FILING_ROUTES = ["主管機關+國稅局", "只送主管機關", "只送國稅局"] as const;
export const TAX_ONLY_ROUTE = "只送國稅局";
export const AUTHORITY_ONLY_ROUTE = "只送主管機關";
const TAX_ONLY_STAGES: readonly FilingStage[] = ["國稅局送件", "國稅局核准", "結案"];
const AUTHORITY_ONLY_STAGES: readonly FilingStage[] = ["預查", "送件", "核准", "結案"];

/** 該流程適用的階段。 */
export function stagesFor(route: string | null | undefined): readonly FilingStage[] {
  if (route === TAX_ONLY_ROUTE) return TAX_ONLY_STAGES;
  if (route === AUTHORITY_ONLY_ROUTE) return AUTHORITY_ONLY_STAGES;
  return FILING_STAGES;
}

/** 流程是否經過主管機關／國稅局。 */
export const routeHasAuthority = (route: string | null | undefined) => route !== TAX_ONLY_ROUTE;
export const routeHasTaxBureau = (route: string | null | undefined) => route !== AUTHORITY_ONLY_ROUTE;

/** 新案件的起始階段。 */
export function initialStage(route: string | null | undefined): FilingStage {
  return stagesFor(route)[0]!;
}

/** 案件類型。 */
export const CASE_TYPES = ["設立登記", "變更登記", "法院報備", "註銷登記", "停業登記", "展延停業", "復業登記", "其他"] as const;

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
export const STAMP_FEE_LABEL = "代刻印章";

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

/** 結案立帳的費用項目：代辦費存入顯示為「工商代辦費」的欄位（鍵「工商」），代墊規費存自訂項目。 */
export function filingInvoiceItems(filing: FilingFeeLike): FeeItems {
  const items: FeeItems = {};
  const service = Math.round(Number(filing.service_fee) || 0);
  const advance = Math.round(Number(filing.advance_fee) || 0);
  if (service > 0) items["工商"] = service;
  const stamp = Math.round(Number(filing.stamp_fee) || 0);
  if (advance > 0) items[otherKey(ADVANCE_FEE_LABEL)] = advance;
  if (stamp > 0) items["印章"] = stamp; // 存入顯示為「代刻印章」的欄位，與工商代辦費分列
  return items;
}

/** 案件費用合計（代辦費＋代墊規費＋印章）。 */
export function filingTotal(filing: FilingFeeLike): number {
  return feeItemsTotal(filingInvoiceItems(filing));
}

/** 停業登記結案 → 客戶改「停業」（記帳費歸零）；復業登記結案 → 改回「期收」，沿用原記帳費。 */
export function billingTypeOnClose(caseType: string | null | undefined): "停業" | "期收" | null {
  if (caseType && SUSPEND_CASE_TYPES.includes(caseType)) return "停業";
  if (caseType === "復業登記") return "期收";
  return null;
}

/** 可以按「結案」的會計專員代號（管理員也可以）。 */
export const CLOSER_STAFF_CODES = ["CA", "MN", "CL"] as const;
export function canCloseFiling(isAdmin: boolean, staffCode: string | null | undefined): boolean {
  return isAdmin || (CLOSER_STAFF_CODES as readonly string[]).includes((staffCode ?? "").trim().toUpperCase());
}

/** 需要填停業期間的案件類型。 */
export const SUSPEND_CASE_TYPES: readonly string[] = ["停業登記", "展延停業", "停復業登記"];

/** 展延停業預設期間：接續原停業期間往後一年。有日期就連日推算（115/1/1-115/12/31 → 116/1/1-116/12/31），只有年月則按月（114/7-115/6 → 115/7-116/6）。無法解析回傳 ""。 */
export function extendSuspendedPeriod(period: string | null | undefined): string {
  const m = (period ?? "").trim().match(/(\d{2,3})\/(\d{1,2})(?:\/(\d{1,2}))?\s*[-~～－至]\s*(\d{2,3})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (!m) return "";
  if (m[6]) {
    const start = new Date(Date.UTC(Number(m[4]) + 1911, Number(m[5]) - 1, Number(m[6]) + 1));
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1));
    const f = (d: Date) => `${d.getUTCFullYear() - 1911}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    return `${f(start)}-${f(end)}`;
  }
  let y = Number(m[4]), mo = Number(m[5]) + 1;
  if (mo > 12) { mo = 1; y += 1; }
  let ey = y + 1, em = mo - 1;
  if (em < 1) { em = 12; ey -= 1; }
  return `${y}/${mo}-${ey}/${em}`;
}
