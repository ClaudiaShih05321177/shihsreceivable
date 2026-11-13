import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/receivables";
import { parseRocDate } from "@/lib/roc-date";

/** 民國年日期輸入框：顯示與輸入 115/1/15，onChange 傳出 ISO yyyy-MM-dd（清空傳 ""）。 */
export function RocDateInput({
  id,
  value,
  onChange,
  required,
  className,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ""));
  useEffect(() => {
    setText(value ? formatDate(value) : "");
  }, [value]);
  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      className={className}
      required={required}
      inputMode="numeric"
      placeholder="115/1/15"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (!t.trim()) {
          onChange("");
          return;
        }
        const iso = parseRocDate(t);
        if (iso) onChange(iso);
      }}
      onBlur={() => setText(value ? formatDate(value) : "")}
    />
  );
}
