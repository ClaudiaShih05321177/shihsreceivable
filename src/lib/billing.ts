import { comparePeriod, itemsTotal, scheduledCustomerFees, suggestPeriod, type FeeItems } from "./receivables";

/** 事務所資料（請款單抬頭與匯款帳號），取自使用者提供的請款單樣本。 */
export const OFFICE = {
  name: "施慶豐記帳及報稅代理人事務所",
  address: "新竹市民生路193號6樓之2",
  phone: "TEL：(03)5321177-9 、 FAX：(03)5325488",
  bank: "新竹市第一信用合作社三民分社",
  accountName: "施慶豐記帳及報稅代理人事務所施慶豐",
  bankCode: "130-0068",
  account: "003-001-00008209",
  note: "PS：自即日起因銀行交換票據需3天兌現，如用票據支付，票據日期請開繳費日三天前的日期，以免耽誤到您繳稅的時間，或用現金支付或匯款，謝謝！",
};

type CustomerLike = { id: string; billing_type?: string | null; bookkeeping_fee: number | string; stationery_fee: number | string; settlement_fee: number | string };
type InvoiceLike = { id: string; customer_id: string; period_year: number | null; period_month: number | null; period_label: string | null; amount: number | string; credit_applied?: number; payments?: { amount: number | string }[] | null };

/** 一鍵立帳：為該收款月份尚無帳款、且排定費用大於 0 的客戶產生帳款草稿。 */
export function batchInvoiceDrafts(customers: CustomerLike[], invoices: InvoiceLike[], year: number, month: number) {
  const taken = new Set(invoices.filter((i) => i.period_year === year && i.period_month === month).map((i) => i.customer_id));
  return customers
    .filter((c) => !taken.has(c.id))
    .map((c) => {
      const items = Object.fromEntries(Object.entries(scheduledCustomerFees(c, month)).filter(([, v]) => Number(v) > 0)) as FeeItems;
      return { customer_id: c.id, period_year: year, period_month: month, period_label: suggestPeriod(month) || null, items, amount: itemsTotal(items) };
    })
    .filter((d) => d.amount > 0);
}

/** 前期未收餘額：同客戶、期別早於本筆的帳款尚未收清的金額合計。 */
export function priorBalance(invoice: InvoiceLike, invoices: InvoiceLike[]): number {
  return invoices
    .filter((i) => i.customer_id === invoice.customer_id && i.id !== invoice.id && comparePeriod(i, invoice) < 0)
    .reduce((s, i) => s + Math.max(0, Number(i.amount) - (i.payments ?? []).reduce((p, x) => p + Number(x.amount), 0) - (i.credit_applied ?? 0)), 0);
}
