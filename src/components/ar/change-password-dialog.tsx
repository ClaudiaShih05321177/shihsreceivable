import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function ChangePasswordDialog({ email, compact = false }: { email: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("新密碼至少 8 個字元");
    if (pw !== pw2) return toast.error("兩次輸入的新密碼不一致");
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (authErr) throw new Error("目前密碼不正確");
      const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as { password: string });
      if (error) throw error;
      toast.success("密碼已更新");
      setOpen(false);
      setCurrent(""); setPw(""); setPw2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "變更密碼失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label="修改密碼" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <KeyRound />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="mt-3 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary">
            <KeyRound className="size-3.5" /> 修改密碼
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>修改密碼</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="cur-pw">目前密碼</Label>
            <Input id="cur-pw" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="new-pw">新密碼（至少 8 字元）</Label>
            <Input id="new-pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="new-pw2">再次輸入新密碼</Label>
            <Input id="new-pw2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "更新中…" : "確認修改"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
