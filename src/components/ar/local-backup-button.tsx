import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runLocalBackup } from "@/lib/backup.functions";

function isLocalHost(h: string) {
  return h === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

export function LocalBackupButton() {
  const run = useServerFn(runLocalBackup);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setShow(isLocalHost(window.location.hostname)), []);
  if (!show) return null;
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
  return <Button variant="outline" onClick={click} disabled={busy}>{busy ? "備份中…" : "一鍵備份"}</Button>;
}
