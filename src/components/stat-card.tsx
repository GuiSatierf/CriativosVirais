import { cn } from "@/lib/utils";

/** Compact KPI tile: label, prominent value and an optional one-line hint. */
export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card p-4", className)}>
      <p className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold sm:text-2xl tracking-tight break-words tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
