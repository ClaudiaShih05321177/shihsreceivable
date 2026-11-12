import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from "date-fns";

/** Invoices due within this many days (and not yet paid) count as "due soon". */
export const DUE_SOON_DAYS = 7;

export type PaymentLike = { amount: number | string; paid_date: string };
export type InvoiceLike = {
  amount: number | string;
  issue_date: string;
  due_date: string | null;
  payments?: PaymentLike[] | null;
};

export type InvoiceStatus = "paid" | "overdue" | "due_soon" | "partial" | "unpaid";

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "已收清",
  overdue: "已逾期",
  due_soon: "即將到期",
  partial: "部分收款",
  unpaid: "未收款",
};

export function todayISO(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function addDaysISO(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function paidTotal(invoice: InvoiceLike): number {
  return (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export function outstanding(invoice: InvoiceLike): number {
  return Math.max(0, Number(invoice.amount) - paidTotal(invoice));
}

/** Days past the due date (negative = days until due). */
export function daysOverdue(invoice: InvoiceLike, today: string = todayISO()): number | null {
  if (!invoice.due_date) return null;
  return differenceInCalendarDays(parseISO(today), parseISO(invoice.due_date));
}

export function invoiceStatus(invoice: InvoiceLike, today: string = todayISO()): InvoiceStatus {
  if (outstanding(invoice) <= 0) return "paid";
  const late = daysOverdue(invoice, today);
  if (late !== null && late > 0) return "overdue";
  if (late !== null && -late <= DUE_SOON_DAYS) return "due_soon";
  if (paidTotal(invoice) > 0) return "partial";
  return "unpaid";
}

export function lastPaidDate(invoice: InvoiceLike): string | null {
  const dates = (invoice.payments ?? []).map((p) => p.paid_date).sort();
  return dates.at(-1) ?? null;
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export const AGING_LABEL: Record<AgingBucket, string> = {
  current: "未到期",
  "1-30": "逾期 1–30 天",
  "31-60": "逾期 31–60 天",
  "61-90": "逾期 61–90 天",
  "90+": "逾期 90 天以上",
};

export function agingBucket(invoice: InvoiceLike, today: string = todayISO()): AgingBucket {
  const late = daysOverdue(invoice, today);
  if (late === null || late <= 0) return "current";
  if (late <= 30) return "1-30";
  if (late <= 60) return "31-60";
  if (late <= 90) return "61-90";
  return "90+";
}

export function agingSummary(invoices: InvoiceLike[], today: string = todayISO()) {
  const totals: Record<AgingBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const inv of invoices) {
    const due = outstanding(inv);
    if (due > 0) totals[agingBucket(inv, today)] += due;
  }
  return (Object.keys(totals) as AgingBucket[]).map((bucket) => ({
    bucket,
    label: AGING_LABEL[bucket],
    amount: totals[bucket],
  }));
}

/** Billed (by issue date) and collected (by payment date) per month, oldest first. */
export function monthlySeries(invoices: InvoiceLike[], months = 6, today: string = todayISO()) {
  const base = startOfMonth(parseISO(today));
  const keys = Array.from({ length: months }, (_, i) => format(subMonths(base, months - 1 - i), "yyyy-MM"));
  const rows = new Map(keys.map((k) => [k, { month: k, label: `${Number(k.slice(5))}月`, billed: 0, collected: 0 }]));
  for (const inv of invoices) {
    const b = rows.get(inv.issue_date.slice(0, 7));
    if (b) b.billed += Number(inv.amount);
    for (const p of inv.payments ?? []) {
      const c = rows.get(p.paid_date.slice(0, 7));
      if (c) c.collected += Number(p.amount);
    }
  }
  return keys.map((k) => rows.get(k)!);
}

const twd = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

export function formatTWD(value: number | string): string {
  return `NT$ ${twd.format(Number(value))}`;
}

/** Show a YYYY-MM-DD date in ROC (民國) form, e.g. 2026-01-15 → 115/1/15. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y = 0, m = 0, d = 0] = value.slice(0, 10).split("-").map(Number);
  return `${y - 1911}/${m}/${d}`;
}

export function rocYear(year: number): number {
  return year - 1911;
}

/** Default collection month is this month if odd, otherwise the next odd month. */
export function bookkeepingCollectionMonth(month: number): number {
  return month % 2 === 1 ? month : month + 1;
}

/** Two monthly fees collected in each odd month; no automatic fee for other rows. */
export function bookkeepingPeriodFee(monthlyFee: number | string, month: number): number {
  if (month < 1 || month > 12 || month % 2 === 0) return 0;
  return Math.round(Number(monthlyFee) * 2) || 0;
}

/** Ledger periods precede collection: January collects November–December. */
export function suggestPeriod(month: number): string {
  if (month === 0 || month === 1) return "11-12";
  if (month >= 3 && month <= 11 && month % 2 === 1) return `${month - 2}-${month - 1}`;
  return "";
}

export function scheduledCustomerFees(customer: { billing_type?: string | null; bookkeeping_fee: number | string; stationery_fee: number | string; settlement_fee: number | string }, month: number, mode: "batch" | "individual" = "batch"): FeeItems {
  return {
    記帳費: customer.billing_type === "年收" ? (mode === "individual" ? Math.round(Number(customer.bookkeeping_fee)) || 0 : 0)
      : customer.billing_type === "半年收" ? (mode === "individual" ? Math.round((Number(customer.bookkeeping_fee) || 0) * 6) : 0)
      : bookkeepingPeriodFee(customer.bookkeeping_fee, month),
    暫繳: month === 11 ? Number(customer.stationery_fee) || 0 : 0,
    股利2代: month === 1 ? Number(customer.settlement_fee) || 0 : 0,
  };
}

/** Refresh automatic defaults while preserving manually changed amounts. */
export function applyScheduledFees(items: Record<string, string>, previous: FeeItems, next: FeeItems): Record<string, string> {
  const result = { ...items };
  for (const key of Object.keys(next)) {
    if (!items[key] || Number(items[key]) === Number(previous[key] ?? 0)) {
      result[key] = next[key] ? String(next[key]) : "";
    }
  }
  return result;
}

/** Fee line items, in the order of the user's ledger (總帳). */
export const FEE_ITEMS = [
  "記帳費",
  "營業稅",
  "發票",
  "文具",
  "結算",
  "工商",
  "22-1申報",
  "印章",
  "印花稅",
  "2代A-B",
  "2代-4X獎金",
  "租金2代",
  "個人2代",
  "員工酬勞2代",
  "租金扣繳",
  "薪資扣繳",
  "勞務扣繳",
  "其他扣繳",
  "財稅簽證",
  "營所稅",
  "未加徵",
  "暫繳",
  "股利2代",
  "年度加收",
  "前期餘額",
] as const;
export type FeeItem = (typeof FEE_ITEMS)[number];
export type FeeItems = Partial<Record<string, number>>;

export const PAYMENT_METHODS = ["匯款", "現金", "支票", "代墊"] as const;
export const BILLING_TYPES = ["期收", "半年收", "年收"] as const;

/** 應收帳款 for a billing row = sum of its fee items. */
export function itemsTotal(items: FeeItems | null | undefined): number {
  return Object.values(items ?? {}).reduce<number>((sum, v) => sum + (Number(v) || 0), 0);
}

/** Non-zero fee items in ledger order. */
export function itemEntries(items: FeeItems | null | undefined): { name: string; amount: number }[] {
  const src = items ?? {};
  const known = FEE_ITEMS.filter((k) => Number(src[k]) ? true : false).map((k) => ({ name: k, amount: Number(src[k]) }));
  const extra = Object.keys(src)
    .filter((k) => !(FEE_ITEMS as readonly string[]).includes(k) && Number(src[k]))
    .map((k) => ({ name: k, amount: Number(src[k]) }));
  return [...known, ...extra];
}

/** 自訂「其他」項目的鍵值前綴：items 裡存成「其他：說明」。 */
export const OTHER_PREFIX = "其他：";

export function isOtherKey(key: string): boolean {
  return key.startsWith(OTHER_PREFIX);
}

/** 自訂項目的說明文字（去掉「其他：」前綴）。 */
export function otherLabel(key: string): string {
  return isOtherKey(key) ? key.slice(OTHER_PREFIX.length) : key;
}

export function otherKey(label: string): string {
  return `${OTHER_PREFIX}${label.trim()}`;
}

/** 已存的自訂「其他」項目（說明 + 金額字串，供表單編輯）。 */
export function otherEntries(items: FeeItems | null | undefined): { key: string; label: string; amount: string }[] {
  return Object.entries(items ?? {})
    .filter(([k, v]) => isOtherKey(k) && Number(v))
    .map(([k, v]) => ({ key: k, label: otherLabel(k), amount: String(v) }));
}

/** 把表單的自訂「其他」列併入費用項目：說明空白或金額為 0 的列不存。 */
export function withOtherItems(items: FeeItems, others: { label: string; amount: string }[]): FeeItems {
  const base = Object.fromEntries(Object.entries(items).filter(([k]) => !isOtherKey(k)));
  for (const o of others) {
    const label = o.label.trim();
    const amount = Math.round(Number(o.amount) || 0);
    if (label && amount !== 0) base[otherKey(label)] = amount;
  }
  return base;
}

/** Label for 月份: 0 or null means 前期 (carried from last year). */
export function periodMonthLabel(month: number | null | undefined): string {
  return !month ? "前期" : `${month}月`;
}

const periodCollator = new Intl.Collator("zh-Hant", { numeric: true, sensitivity: "base" });

export type PeriodSortable = {
  period_year: number | null;
  period_month: number | null;
  period_label: string | null;
};

/** 期間先后：年 → 月（前期排在該年 1 月之前）→ 期別。 */
export function comparePeriod(a: PeriodSortable, b: PeriodSortable): number {
  const byYear = (a.period_year ?? 0) - (b.period_year ?? 0);
  if (byYear !== 0) return byYear;
  const byMonth = (a.period_month ?? 0) - (b.period_month ?? 0);
  if (byMonth !== 0) return byMonth;
  return periodCollator.compare(a.period_label ?? "", b.period_label ?? "");
}

export type SortDirection = "asc" | "desc";

/** 依月份/期別排序（回傳新陣列，不影響原本順序）。 */
export function sortByPeriod<T extends PeriodSortable>(rows: readonly T[], direction: SortDirection = "asc"): T[] {
  const dir = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => dir * comparePeriod(a, b));
}

/** Tax categories shown on the 稅額明細 page, each grouping fee items. */
export const TAX_GROUPS = [
  { key: "vat", label: "營業稅", items: ["營業稅"] },
  { key: "income", label: "營所稅", items: ["營所稅", "未加徵"] },
  { key: "provisional", label: "暫繳稅額", items: ["暫繳"] },
  { key: "withholding", label: "扣繳稅額", items: ["租金扣繳", "薪資扣繳", "勞務扣繳", "其他扣繳"] },
  { key: "nhi", label: "二代健保", items: ["2代A-B", "2代-4X獎金", "租金2代", "個人2代", "員工酬勞2代"] },
  { key: "dividend", label: "股利二代", items: ["股利2代"] },
] as const;

export type TaxLine = { group: string; item: string; amount: number };

/** Non-zero tax lines of one billing row, in TAX_GROUPS order. */
export function taxLines(items: FeeItems | null | undefined): TaxLine[] {
  const src = items ?? {};
  return TAX_GROUPS.flatMap((g) =>
    g.items.filter((i) => Number(src[i])).map((i) => ({ group: g.label, item: i, amount: Number(src[i]) })),
  );
}

/** Per-group totals with the paid portion. */
export function taxSummary(lines: (TaxLine & { paid: boolean })[]) {
  return TAX_GROUPS.map((g) => {
    const rows = lines.filter((l) => l.group === g.label);
    const total = rows.reduce((s, l) => s + l.amount, 0);
    const paid = rows.filter((l) => l.paid).reduce((s, l) => s + l.amount, 0);
    return { label: g.label, total, paid, unpaid: total - paid };
  });
}

/** 營業稅計算：應納 = 銷項 − 進項 − 上期留抵；不足時應納為 0，差額為本期留抵。 */
export function vatDue(output: number, input: number, priorCredit: number): { due: number; carry: number } {
  const net = Math.round((output || 0) - (input || 0) - (priorCredit || 0));
  return net >= 0 ? { due: net, carry: 0 } : { due: 0, carry: -net };
}

type VatLike = PeriodSortable & { id: string; customer_id: string; vat_output?: number | string | null; vat_input?: number | string | null; vat_prior_credit?: number | string | null };

/** 上期留抵：同客戶、期別早於本期的最近一筆有營業稅資料帳款之本期留抵。 */
export function priorVatCredit(current: PeriodSortable & { customer_id: string; id?: string }, invoices: VatLike[]): number {
  const prev = invoices
    .filter((i) => i.customer_id === current.customer_id && i.id !== current.id && i.vat_output != null && comparePeriod(i, current) < 0)
    .sort((a, b) => comparePeriod(b, a))[0];
  if (!prev) return 0;
  return vatDue(Number(prev.vat_output), Number(prev.vat_input ?? 0), Number(prev.vat_prior_credit ?? 0)).carry;
}
