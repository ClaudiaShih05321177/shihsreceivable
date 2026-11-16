/**
 * 伺服器專用：用 AI 辨識網銀交易明細截圖。
 * 只從 reconcile.functions.ts 的 handler 裡動態載入，不要進入瀏覽器打包。
 */
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "@/lib/ai/run-id";

const statementSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().nullable().describe("交易日期，照截圖上的格式（可能是民國年）"),
      amount: z.number().describe("存入金額，新台幣整數，去掉逗號"),
      memo: z.string().describe("匯款人姓名或摘要"),
    }),
  ),
});

export type ParsedBankTxn = z.infer<typeof statementSchema>["transactions"][number];

export async function parseStatementImages(images: string[]): Promise<ParsedBankTxn[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI 辨識服務尚未設定");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "你是銀行交易明細辨識助手。從網路銀行截圖讀取每一筆「存入／匯入」交易（不要支出、扣款、手續費或餘額），回傳交易日期（照截圖格式，可能是民國年）、存入金額（整數，去掉逗號）與匯款人／摘要。看不清楚的欄位填 null 或空字串，不要猜測。",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "請辨識這些網路銀行交易明細截圖，列出所有存入交易。" },
          ...images.map((dataUrl) => ({ type: "image" as const, image: new URL(dataUrl) })),
        ],
      },
    ],
    output: Output.object({ schema: statementSchema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    const output = await result.output;
    return (output?.transactions ?? []).filter((t) => Number.isFinite(t.amount) && t.amount > 0);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("無法辨識截圖內容，請換更清楚的截圖再試");
    }
    throw error;
  }
}
