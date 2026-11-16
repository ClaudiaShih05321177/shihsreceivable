import { normalizeName } from "@/lib/bank-parse";
import { comparePeriod, type PeriodSortable } from "@/lib/receivables";

/** 尚未收清的帳款（供銀行核對配對用）。 */
export type OpenInvoice = PeriodSortable & {
  id: string;
  customerId: string;
  customerName: string;
  outstanding: number;
  created_at: string;
};

export type SuggestionKind = "single" | "combined" | "overpay" | "partial" | "ambiguous" | "none";

export type Suggestion = {
  kind: SuggestionKind;
  /** 建議入帳的客戶（ambiguous / none 為 null）。 */
  customerId: string | null;
  /** 建議入帳的帳款（single 為指定單筆；其餘為該客戶全部未收，由舊到新）。 */
  invoiceIds: string[];
  reason: string;
};

/** 匯款人摘要與客戶名稱是否相符（互相包含、至少兩個字）。 */
export function nameMatches(memo: string, customerName: string): boolean {
  const m = normalizeName(memo);
  const c = normalizeName(customerName);
  if (m.length < 2 || c.length < 2) return false;
  return m.includes(c) || c.includes(m);
}

/** 同一客戶的未收帳款，由舊到新排列。 */
export function openInvoicesOf(open: readonly OpenInvoice[], customerId: string): OpenInvoice[] {
  return open
    .filter((i) => i.customerId === customerId)
    .sort((a, b) => comparePeriod(a, b) || a.created_at.localeCompare(b.created_at));
}

/** 依匯款人與金額，為一筆銀行交易建議配對的帳款。 */
export function suggestMatch(txn: { amount: number; memo: string }, open: readonly OpenInvoice[]): Suggestion {
  const nameHitIds = [...new Set(open.filter((i) => nameMatches(txn.memo, i.customerName)).map((i) => i.customerId))];

  if (nameHitIds.length === 1) {
    const customerId = nameHitIds[0]!;
    const invs = openInvoicesOf(open, customerId);
    const exact = invs.find((i) => i.outstanding === txn.amount);
    if (exact) return { kind: "single", customerId, invoiceIds: [exact.id], reason: "匯款人與金額相符" };
    const total = invs.reduce((sum, i) => sum + i.outstanding, 0);
    if (txn.amount === total) return { kind: "combined", customerId, invoiceIds: invs.map((i) => i.id), reason: "同一客戶多筆合併付款" };
    if (txn.amount > total) return { kind: "overpay", customerId, invoiceIds: invs.map((i) => i.id), reason: "金額超過未收總額（溢收）" };
    return { kind: "partial", customerId, invoiceIds: invs.map((i) => i.id), reason: "匯款人相符，金額為部分收款" };
  }

  if (nameHitIds.length > 1) {
    return { kind: "ambiguous", customerId: null, invoiceIds: [], reason: "名稱符合多個客戶，請手動選擇" };
  }

  const amountHits = open.filter((i) => i.outstanding === txn.amount);
  if (amountHits.length === 1) {
    const hit = amountHits[0]!;
    return { kind: "single", customerId: hit.customerId, invoiceIds: [hit.id], reason: "金額相符（匯款人未識別，請確認）" };
  }
  if (amountHits.length > 1) {
    return { kind: "ambiguous", customerId: null, invoiceIds: [], reason: "相同金額的未收帳款有多筆，請手動選擇" };
  }
  return { kind: "none", customerId: null, invoiceIds: [], reason: "找不到符合的帳款" };
}

/**
 * 把一筆入帳金額分配給同一客戶的未收帳款（由舊到新逐筆填滿）；
 * 多付的部分記在最後一筆（成為溢收，之後自動折抵後期帳款）。
 */
export function allocatePayment(amount: number, invs: readonly OpenInvoice[]): { invoiceId: string; amount: number }[] {
  const sorted = [...invs].sort((a, b) => comparePeriod(a, b) || a.created_at.localeCompare(b.created_at));
  let left = amount;
  const out: { invoiceId: string; amount: number }[] = [];
  for (const inv of sorted) {
    if (left <= 0) break;
    const pay = Math.min(left, inv.outstanding);
    out.push({ invoiceId: inv.id, amount: pay });
    left -= pay;
  }
  if (left > 0 && out.length > 0) out[out.length - 1]!.amount += left;
  return out;
}
