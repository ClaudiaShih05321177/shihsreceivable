import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="animate-rise">
        {eyebrow && <p className="text-xs tracking-[0.25em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular ${className}`}>{new Intl.NumberFormat("zh-TW").format(value)}</span>;
}
