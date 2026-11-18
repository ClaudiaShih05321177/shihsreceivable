/** 工商代辦費年度統計：帳款收清的那天（最後一筆收款日）所在的日曆年度，認列該案代辦費為已收。 */
type Pay = { amount: number | string; bank_fee?: number | string | null; paid_date: string };
type Inv = { id: string; amount: number | string; payments: Pay[] };
type F = { id: string; invoice_id: string | null; stage: string };

export function invoiceSettledDate(inv: Inv | undefined): string | null {
  if (!inv || !inv.payments.length) return null;
  const paid = inv.payments.reduce((s, p) => s + (Number(p.amount) || 0) + (Number(p.bank_fee) || 0), 0);
  if (paid < (Number(inv.amount) || 0)) return null;
  return inv.payments.map((p) => p.paid_date).sort().at(-1) ?? null;
}

export function filingYearStats(filings: F[], invoices: Inv[], fees: Record<string, number>, year: number) {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  let received = 0, receivedCount = 0, pending = 0, pendingCount = 0;
  for (const f of filings) {
    const fee = Math.round(Number(fees[f.id]) || 0);
    if (!f.invoice_id) continue;
    const settled = invoiceSettledDate(byId.get(f.invoice_id));
    if (settled) {
      if (Number(settled.slice(0, 4)) === year) { received += fee; receivedCount++; }
    } else { pending += fee; pendingCount++; }
  }
  return { received, receivedCount, pending, pendingCount };
}
