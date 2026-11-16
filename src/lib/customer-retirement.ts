import { outstanding, overpaid, type InvoiceLike } from "./receivables";

type FilingLike = { customer_id: string | null; case_type: string; stage: string; invoice_id: string | null };
export function canRetireCustomer(isAdmin: boolean, customerId: string, invoices: (InvoiceLike & { id: string; customer_id: string })[], filings: FilingLike[]) {
  if (!isAdmin) return false;
  const bills = invoices.filter((i) => i.customer_id === customerId);
  const cases = filings.filter((f) => f.customer_id === customerId);
  return bills.length > 0
    && cases.some((f) => f.case_type === "註銷登記" && f.stage === "結案" && bills.some((i) => i.id === f.invoice_id))
    && cases.every((f) => f.stage === "結案" && !!f.invoice_id)
    && bills.every((i) => outstanding(i) === 0 && overpaid(i) === 0);
}