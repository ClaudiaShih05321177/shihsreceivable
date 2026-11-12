import { cn } from "@/lib/utils";
import { STATUS_LABEL, type InvoiceStatus } from "@/lib/receivables";

const styles: Record<InvoiceStatus, string> = {
  paid: "bg-success/12 text-success border-success/30",
  overdue: "bg-overdue/12 text-overdue border-overdue/35",
  due_soon: "bg-warning/18 text-warning-foreground border-warning/40",
  partial: "bg-accent text-accent-foreground border-primary/20",
  unpaid: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
