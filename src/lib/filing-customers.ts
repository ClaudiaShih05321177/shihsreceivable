export type FilingCustomer = { id: string; name: string; customer_code: string | null; tax_id?: string | null };

/** A tax ID may identify multiple billing accounts; never choose one arbitrarily. */
export function findFilingCustomer(customers: FilingCustomer[], name: string, taxId: string): FilingCustomer | undefined {
  const id = taxId.trim();
  const matches = id
    ? customers.filter((c) => c.tax_id?.trim() === id)
    : customers.filter((c) => c.name.trim() === name.trim());
  return matches.length === 1 ? matches[0] : undefined;
}

export function filingCustomerLink(customer: FilingCustomer) {
  return { customer_id: customer.id, customer_code: customer.customer_code ?? "", company_name: "" };
}

/** Prefer the current directory code; blank values must not hide the saved case code. */
export function filingCustomerCode(customerCode?: string | null, caseCode?: string | null) {
  return customerCode?.trim() || caseCode?.trim() || "";
}