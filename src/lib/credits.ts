import { comparePeriod } from "./receivables";

type CreditInvoice = {
  id: string;
  customer_id: string;
  period_year: number | null;
  period_month: number | null;
  period_label: string | null;
  issue_date?: string;
  created_at?: string;
  amount: number | string;
  payments?: { amount: number | string; bank_fee?: number | string | null }[] | null;
};

/** Derived allocations preserve the original fees and actual receipts; never create artificial payments. */
export function allocateCredits<T extends CreditInvoice>(invoices: T[]): (T & { credit_applied: number; credit_used: number })[] {
  const rows = invoices.map((invoice) => ({ ...invoice, credit_applied: 0, credit_used: 0 }));
  const ordered = [...rows].sort((a, b) => comparePeriod(a, b) || (a.created_at ?? a.issue_date ?? "").localeCompare(b.created_at ?? b.issue_date ?? "") || a.id.localeCompare(b.id));
  for (const source of ordered) {
    const paid = (source.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const cash = (source.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount) - Number(payment.bank_fee ?? 0), 0);
    // A waived bank fee is not cash held for the customer.
    let available = Math.max(0, Math.min(paid - Number(source.amount), cash - Number(source.amount)));
    for (const target of ordered) {
      if (available <= 0) break;
      if (source.customer_id !== target.customer_id || comparePeriod(source, target) >= 0) continue;
      const targetPaid = (target.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const applied = Math.min(available, Math.max(0, Number(target.amount) - targetPaid - target.credit_applied));
      target.credit_applied += applied;
      source.credit_used += applied;
      available -= applied;
    }
  }
  return rows;
}