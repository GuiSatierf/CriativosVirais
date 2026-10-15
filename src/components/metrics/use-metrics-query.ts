"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { api } from "@/lib/client";
import { metricsQuery, type MetricsFilters } from "./metrics-filter";

/**
 * Loads a metrics endpoint for the current filters. Earlier data stays on
 * screen while a new request runs; only the latest request wins.
 */
export function useMetricsQuery<T>({
  endpoint,
  schema,
  initialFilters,
  initialData,
}: {
  endpoint: string;
  schema: z.ZodType<T>;
  initialFilters: MetricsFilters;
  initialData?: T;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(initialData === undefined);
  const [error, setError] = useState<string>();
  const request = useRef(0);

  const fetchData = useCallback(
    (next: MetricsFilters) => {
      const id = ++request.current;
      return api(`${endpoint}?${metricsQuery(next)}`, schema).then(
        (result) => {
          if (id !== request.current) return;
          setData(result);
          setError(undefined);
          setLoading(false);
        },
        (reason: unknown) => {
          if (id !== request.current) return;
          setError(
            reason instanceof Error && reason.message
              ? reason.message
              : "Verifique sua conexão e tente novamente.",
          );
          setLoading(false);
        },
      );
    },
    [endpoint, schema],
  );

  const [initial] = useState({ filters: initialFilters, data: initialData });
  useEffect(() => {
    if (initial.data === undefined) void fetchData(initial.filters);
  }, [initial, fetchData]);

  const load = useCallback(
    (next: MetricsFilters) => {
      setFilters(next);
      setLoading(true);
      void fetchData(next);
    },
    [fetchData],
  );

  return {
    filters,
    data,
    loading,
    error,
    load,
    refresh: () => load(filters),
    /** Refetches without showing the loading state (e.g. after an upload). */
    revalidate: () => void fetchData(filters),
  };
}
