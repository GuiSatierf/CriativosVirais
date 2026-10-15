import { formatMetric } from "@/lib/client";

/**
 * Metric cell content. A missing value shows a quiet dash and keeps the full
 * "Não disponível" for screen readers; it is never shown as zero.
 */
export function MetricValue({
  name,
  value,
}: {
  name: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined) return <Missing />;
  return <>{formatMetric(name, value)}</>;
}

export function Missing() {
  return (
    <>
      <span aria-hidden className="text-muted-foreground/60">
        —
      </span>
      <span className="sr-only">Não disponível</span>
    </>
  );
}
