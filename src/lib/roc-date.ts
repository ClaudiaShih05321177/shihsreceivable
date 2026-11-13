/** 解析民國年日期文字（115/1/15、115-1-15、115.1.15）為 ISO yyyy-MM-dd；無效回傳 null。 */
export function parseRocDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,3})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]) + 1911;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
