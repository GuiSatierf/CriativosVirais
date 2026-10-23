"use client";
import { CalendarDays } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/client";
import type { MetricsFilters } from "./metrics-filter";

export type ImportPeriod = { from: string; to: string };

/** Whether the filters ask the spreadsheet for dates none of the offered imports cover. */
export function isOutsideImports(filters: MetricsFilters, periods: ImportPeriod[]) {
  if (filters.source !== "csv" || periods.length === 0) return false;

  return !periods.some(
    (period) => period.from === filters.from && period.to === filters.to,
  );
}

/** A spreadsheet only answers for its exact import period: say so and offer the imported ones. */
export function ImportPeriodNotice({
  periods,
  onSelect,
}: {
  periods: ImportPeriod[];
  onSelect: (period: ImportPeriod) => void;
}) {
  return (
    <Alert>
      <CalendarDays aria-hidden />
      <AlertTitle>Não há planilha importada para este período</AlertTitle>
      <AlertDescription>
        <p>
          A planilha vale só para as datas em que foi importada. Escolha um
          período importado para ver os resultados.
        </p>
        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <Button
              key={`${period.from}|${period.to}`}
              variant="outline"
              size="sm"
              onClick={() => onSelect(period)}
            >
              Ver {formatPeriod(period.from, period.to)}
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
