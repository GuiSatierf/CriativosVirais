"use client";
import { useId, useState } from "react";
import { Columns3 } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  id: string;
  header: string;
  numeric?: boolean;
  /** Keeps the header for screen readers only (e.g. a row-actions column). */
  hideHeader?: boolean;
  className?: string;
  /**
   * Whether a row has data for this column. When given, the column is hidden
   * (and left out of the picker) if no row on screen has data.
   */
  hasValue?: (row: T) => boolean;
  render: (row: T) => React.ReactNode;
};

/**
 * Data panel: a header bar with a column picker, a sticky-header table from
 * `md` up and stacked cards below it (no horizontal scrolling on phones).
 * Columns with no data in any row are not shown nor offered.
 */
export function DataTable<T>({
  label,
  summary,
  columns,
  optional = [],
  trailing,
  rows,
  rowKey,
  renderCard,
  busy = false,
}: {
  label: string;
  summary: React.ReactNode;
  /** Always visible; the first one sticks to the left edge. */
  columns: DataColumn<T>[];
  /** Columns the person can switch on; shown after the fixed ones. */
  optional?: DataColumn<T>[];
  /** Last column, e.g. row actions. */
  trailing?: DataColumn<T>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderCard: (row: T) => React.ReactNode;
  busy?: boolean;
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const hintId = useId();
  const withData = (column: DataColumn<T>) =>
    !column.hasValue || rows.some(column.hasValue);
  const fixed = columns.filter(withData);
  const offered = optional.filter(withData);
  const shownExtra = offered.filter((c) => extra.includes(c.id));
  const visible = [...fixed, ...shownExtra, ...(trailing ? [trailing] : [])];

  return (
    <div
      aria-busy={busy}
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-opacity duration-(--duration-fast)",
        busy && "opacity-60",
      )}
    >
      <Collapsible>
        <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2">
          <p className="min-w-0 text-sm text-muted-foreground">{summary}</p>
          {offered.length > 0 && (
            <CollapsibleTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden text-muted-foreground md:inline-flex",
              )}
            >
              <Columns3 aria-hidden />
              Colunas
              {shownExtra.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">
                  +{shownExtra.length}
                </span>
              )}
            </CollapsibleTrigger>
          )}
        </div>
        {offered.length > 0 && (
          <CollapsibleContent className="hidden border-b bg-muted/30 px-4 py-3 md:block">
            <p
              id={hintId}
              className="mb-2 text-xs text-muted-foreground"
            >
              Mostrar também
            </p>
            <ToggleGroup
              multiple
              variant="outline"
              size="sm"
              aria-describedby={hintId}
              className="flex-wrap"
              value={extra}
              onValueChange={(value) => setExtra(value as string[])}
            >
              {offered.map((column) => (
                <ToggleGroupItem
                  key={column.id}
                  value={column.id}
                  className="bg-card data-pressed:border-foreground/30 data-pressed:bg-muted data-pressed:text-foreground"
                >
                  {column.header}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CollapsibleContent>
        )}
      </Collapsible>

      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="hidden max-h-[min(70svh,48rem)] overflow-auto overscroll-contain outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:block [&>[data-slot=table-container]]:overflow-visible"
      >
        <Table>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              {visible.map((column, index) => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-10 h-10 bg-card px-3 text-xs whitespace-nowrap shadow-[inset_0_-1px_0_var(--border)] first:pl-4 last:pr-4",
                    column.numeric && "text-right",
                    index === 0 && "left-0 z-20",
                    trailing && index === visible.length - 1 && "right-0 z-20",
                    column.className,
                  )}
                >
                  {column.hideHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={rowKey(row, i)}
                className="group border-border/60 hover:bg-muted/40"
              >
                {visible.map((column, index) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      "px-3 py-2.5 first:pl-4 last:pr-4",
                      column.numeric && "text-right whitespace-nowrap tabular-nums",
                      index === 0 &&
                        "sticky left-0 z-[5] bg-card bg-linear-to-r from-transparent to-transparent group-hover:from-muted/40 group-hover:to-muted/40",
                      // Row actions stay reachable when the table scrolls sideways.
                      trailing &&
                        index === visible.length - 1 &&
                        "sticky right-0 z-[5] bg-card bg-linear-to-r from-transparent to-transparent shadow-[inset_1px_0_0_var(--border)] group-hover:from-muted/40 group-hover:to-muted/40",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={label} className="divide-y md:hidden">
        {rows.map((row, i) => (
          <li key={rowKey(row, i)} className="p-4">
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}

type CardMetric = { label: string; value: React.ReactNode | null };

function MetricGrid({ items }: { items: CardMetric[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Metrics of one mobile card. Only metrics with a value are listed; a row
 * without any shows a single quiet line instead of a grid of dashes. The
 * table's column picker is desktop-only, so the other metrics (`more`) open
 * here behind "Ver mais".
 */
export function CardMetrics({
  items,
  more = [],
}: {
  items: CardMetric[];
  more?: CardMetric[];
}) {
  const [open, setOpen] = useState(false);
  const present = items.filter((item) => item.value !== null);
  const extra = more.filter((item) => item.value !== null);
  const shown = open ? [...present, ...extra] : present;
  return (
    <div>
      {shown.length > 0 ? (
        <MetricGrid items={shown} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem resultados neste período
        </p>
      )}
      {extra.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            buttonVariants({ variant: "link", size: "sm" }),
            "-ml-3 mt-1 text-muted-foreground",
          )}
        >
          {open
            ? "Ver menos"
            : `Ver mais ${extra.length} ${extra.length === 1 ? "métrica" : "métricas"}`}
        </button>
      )}
    </div>
  );
}
