import { BookOpen, ChevronDown } from "@/components/icons";
import { metricNames } from "@/lib/connectors/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { metricText } from "./metric-labels";

/** Accessible, tooltip-free glossary for the metric names. */
export function MetricGlossary({ className }: { className?: string }) {
  return (
    <Collapsible className={cn("space-y-4", className)}>
      <CollapsibleTrigger className="group/glossary inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors duration-(--duration-fast) outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 pointer-coarse:min-h-11">
        <BookOpen className="size-4" aria-hidden />
        O que significa cada métrica?
        <ChevronDown
          className="size-4 transition-transform duration-(--duration-fast) group-data-panel-open/glossary:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {metricNames.map((name) => (
            <div key={name}>
              <dt className="font-medium">{metricText[name].label}</dt>
              <dd className="mt-0.5 text-muted-foreground">
                {metricText[name].description}
              </dd>
            </div>
          ))}
          <div>
            <dt className="font-medium">
              <span aria-hidden>— </span>Não disponível
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              A fonte não informou esse dado. Não é o mesmo que zero.
            </dd>
          </div>
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}
