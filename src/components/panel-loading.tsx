import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/panel";

/** Shown while an intercepted panel loads, so a tap gets instant feedback. */
export function PanelLoading({ label }: { label: string }) {
  return (
    <Panel label={label}>
      <div role="status" aria-label={`Carregando ${label.toLowerCase()}`} className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </Panel>
  );
}
