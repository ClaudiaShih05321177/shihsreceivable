export function matchCustomer<T extends { name: string; tax_id: string | null }>(customers: T[], name: string, taxId: string): T | undefined {
  const matches = customers.filter((c) => c.name.trim() === name.trim());
  return matches.length === 1 ? matches[0] : matches.find((c) => c.tax_id && c.tax_id === taxId);
}

const norm = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "");
/** 勤豐工廠：以工廠名稱（廠名）精確比對，忽略空白；不使用統編（同公司多廠）。 */
export function matchFactoryByName<T extends { name: string }>(customers: T[], factoryName: string): T | undefined {
  const key = norm(factoryName);
  if (!key) return undefined;
  const hits = customers.filter((c) => norm(c.name) === key);
  return hits.length === 1 ? hits[0] : undefined;
}

/** 勤豐下一個客戶代碼：取 CF 後主號最大值 +1（忽略 CF344-1 這類子號）。 */
export function nextFactoryCode(codes: (string | null | undefined)[]): string {
  let max = 0;
  for (const c of codes) { const m = /^CF(\d+)/i.exec((c ?? "").trim()); if (m) max = Math.max(max, Number(m[1])); }
  return `CF${max + 1}`;
}
