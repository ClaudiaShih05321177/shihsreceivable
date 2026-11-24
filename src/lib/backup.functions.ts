import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** 本機 Windows 主機一鍵備份：執行 deploy-windows/backup-system.bat（只在本機主機可用）。 */
export const runLocalBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("只有管理員可以備份");
    const proc = (globalThis as { process?: { platform?: string; cwd?: () => string } }).process;
    if (!proc || proc.platform !== "win32" || !proc.cwd) throw new Error("一鍵備份只能在公司主機的本機系統使用");
    const cpName = "node:child_process";
    const { execFile } = (await import(/* @vite-ignore */ cpName)) as typeof import("node:child_process");
    const script = `${proc.cwd()}\\deploy-windows\\backup-system.bat`;
    const out = await new Promise<string>((resolve, reject) => {
      execFile("cmd.exe", ["/c", script], { timeout: 300_000, windowsHide: true }, (err, stdout) => {
        const text = String(stdout ?? "");
        const m = text.match(/Done: (.+\.backup)/);
        if (m?.[1]) resolve(m[1].trim());
        else reject(new Error(err ? "備份失敗，請確認 Docker 已啟動" : "備份失敗"));
      });
    });
    return { file: out };
  });
