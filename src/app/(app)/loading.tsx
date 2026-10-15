import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Carregando a página…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-22 rounded-xl" />
        ))}
      </div>
      <div className="divide-y rounded-xl border bg-card shadow-(--shadow-panel)">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-4 p-4">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
