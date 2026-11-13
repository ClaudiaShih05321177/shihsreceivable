import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMember, resetMemberPassword } from "@/lib/team.functions";

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="init-pw">初始密碼（至少 8 字元）</Label>
      <div className="flex gap-2">
        <Input id="init-pw" required minLength={8} value={value} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="outline" onClick={() => onChange(randomPassword())}>隨機產生</Button>
      </div>
      <p className="text-xs text-muted-foreground">請把 Email 和這組密碼交給同仁，第一次登入時系統會要求改密碼。</p>
    </div>
  );
}

export function AddMemberDialog() {
  const qc = useQueryClient();
  const create = useServerFn(createMember);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { name, email, password, role } });
      toast.success(`已建立 ${email} 的帳號`);
      qc.invalidateQueries({ queryKey: ["team"] });
      setOpen(false);
      setName(""); setEmail(""); setPassword(randomPassword()); setRole("member");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>＋ 新增成員</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>新增團隊成員</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">同仁姓名</Label>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="王小明" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-email">登入 Email</Label>
            <Input id="m-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <PasswordField value={password} onChange={setPassword} />
          <div className="space-y-1.5">
            <Label>系統身分</Label>
            <div className="flex gap-2">
              <Button type="button" variant={role === "member" ? "default" : "outline"} onClick={() => setRole("member")}>一般使用者</Button>
              <Button type="button" variant={role === "admin" ? "default" : "outline"} onClick={() => setRole("admin")}>管理員</Button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "建立中…" : "建立帳號"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({ userId, name }: { userId: string; name: string }) {
  const reset = useServerFn(resetMemberPassword);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await reset({ data: { userId, password } });
      toast.success(`已重設 ${name} 的密碼`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重設失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setPassword(randomPassword()); }}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">重設密碼</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>重設 {name} 的密碼</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <PasswordField value={password} onChange={setPassword} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "處理中…" : "重設密碼"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
