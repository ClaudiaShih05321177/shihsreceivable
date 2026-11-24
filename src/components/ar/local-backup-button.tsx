import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";
import { runLocalBackup } from "@/lib/backup.functions";

function isLocalHost(h: string) {
  return h === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

function useLocalBackup() {
  const run = useServerFn(runLocalBackup);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setShow(isLocalHost(window.location.hostname)), []);
  async function click() {
    setBusy(true);
    try {
      const { file } = await run();
      toast.success(`備份完成：${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "備份失敗");
    } finally {
      setBusy(false);
    }
  }
  return { show, busy, click };
}

/** 側邊選單的一鍵備份（外觀與選單項目一致，只在本機主機顯示）。 */
export function LocalBackupNavItem() {
  const { show, busy, click } = useLocalBackup();
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground disabled:opacity-60"
    >
      <DatabaseBackup className="size-4" />
      {busy ? "備份中…" : "一鍵備份"}
    </button>
  );
}
