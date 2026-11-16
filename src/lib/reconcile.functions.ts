import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("只有管理員可以核對入帳");
}

type ConfirmEntry = {
  fingerprint: string;
  txnDate: string | null;
  amount: number;
  memo: string;
  payments: { invoiceId: string; amount: number }[];
};

/** 管理員上傳網銀截圖，AI 辨識存入交易。 */
export const parseBankStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { images: string[] }) => {
    if (!Array.isArray(input?.images) || input.images.length === 0) throw new Error("請上傳截圖");
    if (input.images.length > 4) throw new Error("一次最多 4 張截圖");
    for (const img of input.images) {
      if (typeof img !== "string" || !img.startsWith("data:image/")) throw new Error("圖片格式不正確");
      if (img.length > 7_000_000) throw new Error("圖片太大，請縮小後再上傳");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { parseStatementImages } = await import("@/lib/ai/parse-statement");
    return parseStatementImages(data.images);
  });

/** 管理員確認配對結果後登錄收款；以防重複指紋擋下重複入帳。 */
export const recordBankPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entries: ConfirmEntry[] }) => {
    if (!Array.isArray(input?.entries) || input.entries.length === 0) throw new Error("沒有要入帳的交易");
    for (const e of input.entries) {
      if (!e.fingerprint || !Array.isArray(e.payments) || e.payments.length === 0) throw new Error("入帳資料不完整");
      if (e.payments.some((p) => !p.invoiceId || !Number.isFinite(p.amount) || p.amount <= 0)) throw new Error("入帳金額不正確");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const today = new Date().toISOString().slice(0, 10);
    const results: { fingerprint: string; skipped: boolean }[] = [];
    for (const entry of data.entries) {
      // 先佔住指紋：同一筆銀行交易只會入帳一次。
      const { data: txn, error: txnError } = await context.supabase
        .from("bank_transactions")
        .insert({ txn_date: entry.txnDate, amount: entry.amount, memo: entry.memo.slice(0, 200), fingerprint: entry.fingerprint, created_by: context.userId })
        .select("id")
        .single();
      if (txnError) {
        if (txnError.code === "23505") {
          results.push({ fingerprint: entry.fingerprint, skipped: true });
          continue;
        }
        throw txnError;
      }
      try {
        for (const p of entry.payments) {
          const { error } = await context.supabase.from("payments").insert({
            invoice_id: p.invoiceId,
            amount: p.amount,
            bank_fee: 0,
            paid_date: entry.txnDate ?? today,
            method: "匯款",
            notes: entry.memo.trim() ? `銀行核對：${entry.memo.trim()}` : "銀行核對",
          });
          if (error) throw error;
        }
      } catch (error) {
        // 收款失敗時把指紋紀錄刪掉，讓管理員可以重試。
        await context.supabase.from("bank_transactions").delete().eq("id", txn.id);
        throw error;
      }
      results.push({ fingerprint: entry.fingerprint, skipped: false });
    }
    return results;
  });
