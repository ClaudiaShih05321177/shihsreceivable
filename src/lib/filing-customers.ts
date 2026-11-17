export type FilingCustomer = { id: string; name: string; customer_code: string | null; tax_id?: string | null };

/** Normalise company names so 「國產電器股份有限公司」 matches 「國產電器股份」. */
export function normalizeCompanyName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/股份有限公司$/, "股份")
    .replace(/有限公司$/, "有限")
    .replace(/公司$/, "");
}

/** Several rows may share a tax ID or name; prefer the single one that has a customer code, never choose arbitrarily. */
function pickOne(matches: FilingCustomer[]): FilingCustomer | undefined {
  if (matches.length === 1) return matches[0];
  const coded = matches.filter((c) => c.customer_code?.trim());
  return coded.length === 1 ? coded[0] : undefined;
}

export function findFilingCustomer(customers: FilingCustomer[], name: string, taxId: string): FilingCustomer | undefined {
  const id = taxId.trim();
  if (id) return pickOne(customers.filter((c) => c.tax_id?.trim() === id));
  const exact = customers.filter((c) => c.name.trim() === name.trim());
  if (exact.length) return pickOne(exact);
  const n = normalizeCompanyName(name);
  if (!n) return undefined;
  return pickOne(customers.filter((c) => normalizeCompanyName(c.name) === n));
}
export function filingCustomerLink(customer: FilingCustomer) {
  return { customer_id: customer.id, customer_code: customer.customer_code ?? "", company_name: "" };
}

/** Prefer the current directory code; blank values must not hide the saved case code. */
export function filingCustomerCode(customerCode?: string | null, caseCode?: string | null) {
  return customerCode?.trim() || caseCode?.trim() || "";
}