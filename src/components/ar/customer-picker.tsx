import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CustomerOption = { id: string; name: string; customer_code: string | null; tax_id?: string | null };
export function CustomerPicker({ customers, value, onSelect, disabled = false, searchTaxId = false }: { customers: CustomerOption[]; value: string; onSelect: (id: string) => void; disabled?: boolean; searchTaxId?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  const label = (c: CustomerOption) => `${c.customer_code ? `${c.customer_code} · ` : ""}${c.name}`;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="客戶名稱" aria-expanded={open} disabled={disabled} className="h-auto min-h-9 w-full justify-between text-left font-normal"><span className="min-w-0 whitespace-normal">{selected ? label(selected) : "選擇客戶"}</span><ChevronsUpDown className="size-4 shrink-0" /></Button></PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
      <Command filter={(v, q) => (v.toLowerCase().includes(q.trim().toLowerCase()) ? 1 : 0)}><CommandInput placeholder={searchTaxId ? "搜尋公司名稱、統編或客戶代碼" : "搜尋客戶名稱或代碼"} /><CommandList><CommandEmpty>查無客戶</CommandEmpty>{customers.map((c) => <CommandItem key={c.id} value={`${c.id} ${label(c)} ${searchTaxId ? c.tax_id ?? "" : ""}`} onSelect={() => { onSelect(c.id); setOpen(false); }}><span className="min-w-0 whitespace-normal">{label(c)}{searchTaxId && c.tax_id && <span className="ml-2 text-xs text-muted-foreground">{c.tax_id}</span>}</span></CommandItem>)}</CommandList></Command>
    </PopoverContent>
  </Popover>;
}