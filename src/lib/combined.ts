/** 合併收款：把一次實收＋匯費依序沖銷所選帳款；超出部分記在最後一筆（溢收）。 */
export type CombinedTarget = { id: string; balance: number };
export type CombinedPart = { invoice_id: string; amount: number; bank_fee: number };

export function allocateCombined(targets: CombinedTarget[], received: number, bankFee: number): CombinedPart[] {
  const fee = Math.max(0, Math.round(bankFee));
  let left = Math.round(Math.max(0, received)) + fee;
  const parts: CombinedPart[] = [];
  targets.forEach((t, i) => {
    const last = i === targets.length - 1;
    const take = last ? left : Math.min(left, Math.max(0, Math.round(t.balance)));
    left -= take;
    if (take > 0) parts.push({ invoice_id: t.id, amount: take, bank_fee: 0 });
  });
  const first = parts[0];
  if (first && fee) first.bank_fee = Math.min(fee, first.amount);
  return parts;
}
