import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CustomerOption = { id: string; name: string; customer_code: string | null };
export function CustomerPicker({ customers, value, onSelect }: { customers: CustomerOption[]; value: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  const label = (c: CustomerOption) => `${c.customer_code ? `${c.customer_code} · ` : ""}${c.name}`;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="客戶名稱" aria-expanded={open} className="h-auto min-h-9 w-full justify-between text-left font-normal"><span className="min-w-0 whitespace-normal">{selected ? label(selected) : "選擇客戶"}</span><ChevronsUpDown className="size-4 shrink-0" /></Button></PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
      <Command><CommandInput placeholder="搜尋客戶名稱或代碼" /><CommandList><CommandEmpty>查無客戶</CommandEmpty>{customers.map((c) => <CommandItem key={c.id} value={`${c.id} ${label(c)}`} onSelect={() => { onSelect(c.id); setOpen(false); }}>{label(c)}</CommandItem>)}</CommandList></Command>
    </PopoverContent>
  </Popover>;
}