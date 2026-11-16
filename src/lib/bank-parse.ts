/** 銀行截圖辨識後的文字正規化工具（純函式，方便測試）。 */

/** 去除公司後綴與空白符號，用於比對匯款人與客戶名稱。 */
export function normalizeName(name: string): string {
  return name
    .replace(/股份有限公司|有限公司|公司/g, "")
    .replace(/[\s　・,，.。()（）\-]/g, "")
    .toUpperCase();
}

/** 防重複入帳的指紋：日期＋金額＋匯款人摘要。 */
export function txnFingerprint(date: string | null, amount: number, memo: string): string {
  return `${date ?? ""}|${amount}|${memo.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** 把截圖上看到的日期（民國或西元）轉成 ISO（yyyy-MM-dd）；認不出來回傳 null。 */
export function normalizeBankDate(text: string | null | undefined, today: string): string | null {
  if (!text) return null;
  const full = text.trim().match(/(\d{2,4})\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})/);
  if (full) {
    let year = Number(full[1]);
    if (year < 1911) year += 1911; // 民國年
    const month = Number(full[2]);
    const day = Number(full[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // 只有月/日：用今天的年份
  const short = text.trim().match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})/);
  if (short) {
    const year = Number(today.slice(0, 4));
    const month = Number(short[1]);
    const day = Number(short[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}
