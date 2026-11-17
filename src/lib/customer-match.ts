export function matchCustomer<T extends { name: string; tax_id: string | null }>(customers: T[], name: string, taxId: string): T | undefined {
  const matches = customers.filter((c) => c.name.trim() === name.trim());
  return matches.length === 1 ? matches[0] : matches.find((c) => c.tax_id && c.tax_id === taxId);
}