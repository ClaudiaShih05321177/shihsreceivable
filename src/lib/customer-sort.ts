export type StaffSortable = {
  staff_code: string | null;
  customer_code: string | null;
  name: string;
};

const collator = new Intl.Collator("zh-Hant", { numeric: true, sensitivity: "base" });

/** 會計專員排前面，未指派會計專員的排最後；同會計專員再依客戶ID、客戶名稱排序。 */
export function byStaffCode(a: StaffSortable, b: StaffSortable): number {
  const sa = a.staff_code?.trim() ?? "";
  const sb = b.staff_code?.trim() ?? "";
  if (!sa !== !sb) return sa ? -1 : 1;
  if (sa && sb) {
    const byStaff = collator.compare(sa, sb);
    if (byStaff !== 0) return byStaff;
  }
  const ca = a.customer_code?.trim() ?? "";
  const cb = b.customer_code?.trim() ?? "";
  if (!ca !== !cb) return ca ? -1 : 1;
  if (ca && cb) {
    const byCode = collator.compare(ca, cb);
    if (byCode !== 0) return byCode;
  }
  return collator.compare(a.name, b.name);
}

/** 依會計專員排序（回傳新陣列，不影響原本順序）。 */
export function sortByStaff<T extends StaffSortable>(rows: readonly T[]): T[] {
  return [...rows].sort(byStaffCode);
}

/** 依客戶代號排序；沒有代號的排最後，再依名稱。 */
export function compareCustomerCode(ca: string | null | undefined, cb: string | null | undefined, na = "", nb = ""): number {
  const a = ca?.trim() ?? "";
  const b = cb?.trim() ?? "";
  if (!a !== !b) return a ? -1 : 1;
  return (a && b ? collator.compare(a, b) : 0) || collator.compare(na, nb);
}
