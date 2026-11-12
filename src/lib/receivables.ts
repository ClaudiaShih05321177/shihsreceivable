import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from "date-fns";

/** Invoices due within this many days (and not yet paid) count as "due soon". */
export const DUE_SOON_DAYS = 7;

export type PaymentLike = { amount: number | string; paid_date: string };
export type InvoiceLike = {
  amount: number | string;
  issue_date: string;
  due_date: string;
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
export function daysOverdue(invoice: InvoiceLike, today: string = todayISO()): number {
  return differenceInCalendarDays(parseISO(today), parseISO(invoice.due_date));
}

export function invoiceStatus(invoice: InvoiceLike, today: string = todayISO()): InvoiceStatus {
  if (outstanding(invoice) <= 0) return "paid";
  const late = daysOverdue(invoice, today);
  if (late > 0) return "overdue";
  if (-late <= DUE_SOON_DAYS) return "due_soon";
  if (paidTotal(invoice) > 0) return "partial";
  return "unpaid";
}

export function lastPaidDate(invoice: InvoiceLike): string | null {
  const dates = (invoice.payments ?? []).map((p) => p.paid_date).sort();
  return dates.length ? dates[dates.length - 1] : null;
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
  if (late <= 0) return "current";
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
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${y - 1911}/${m}/${d}`;
}

export function rocYear(year: number): number {
  return year - 1911;
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
  "匯費",
  "前期餘額",
  "其他",
] as const;
export type FeeItem = (typeof FEE_ITEMS)[number];
export type FeeItems = Partial<Record<string, number>>;

export const PAYMENT_METHODS = ["匯款", "現金", "支票", "代墊"] as const;
export const BILLING_TYPES = ["期收", "年收"] as const;

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

/** Label for 月份: 0 or null means 前期 (carried from last year). */
export function periodMonthLabel(month: number | null | undefined): string {
  return !month ? "前期" : `${month}月`;
}
