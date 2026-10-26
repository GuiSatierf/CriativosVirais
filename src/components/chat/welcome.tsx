"use client";
import Link from "next/link";
import {
  ArrowRight,
  ChartColumn,
  FileSpreadsheet,
  Layers,
  Plug,
  Sparkle,
  Storefront,
  Video,
  type AppIcon,
} from "@/components/icons";
import { opening } from "@/lib/ai/schemas";
import type { HomeIcon, HomeStatus, HomeSuggestion } from "@/lib/home";
import { cn } from "@/lib/utils";
import { StrategistAvatar, strategistName } from "./strategist";

const icons: Record<HomeIcon, AppIcon> = {
  offer: Storefront,
  csv: FileSpreadsheet,
  scripts: Sparkle,
  video: Video,
  results: ChartColumn,
  batches: Layers,
  integrations: Plug,
};

/** News worth acting on; each item opens the matching panel. */
function StatusLine({ status }: { status: HomeStatus[] }) {
  if (!status.length) return null;
  return (
    <ul
      aria-label="Novidades"
      className="mt-1 flex flex-wrap justify-center gap-2"
    >
      {status.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group inline-flex min-h-8 items-center gap-2 rounded-full border bg-card px-3 text-sm outline-none transition-[background-color,transform] duration-(--duration-fast) hover:bg-accent active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-10"
          >
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                item.tone === "warning" ? "bg-warning" : "bg-success",
              )}
            />
            {item.label}
            <ArrowRight
              aria-hidden
              className="size-3.5 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function WelcomeIntro({
  firstName,
  status = [],
  firstContact = true,
}: {
  firstName?: string;
  status?: HomeStatus[];
  firstContact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-1 text-center sm:gap-3">
      <StrategistAvatar className="mb-3 size-14 rounded-2xl sm:mb-4" />
      <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {firstName ? `Oi, ${firstName}!` : "Oi!"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Aqui é o {strategistName}.
      </p>
      <StatusLine status={status} />
      {/* Mandated opening sentence for the first contact: keep it verbatim. */}
      <p className="mt-2 max-w-xl rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-left text-base text-pretty sm:text-center">
        {firstContact
          ? opening
          : "O que vamos fazer hoje? Escolha uma sugestão abaixo ou me conta o que precisa."}
      </p>
    </div>
  );
}

/** Next best actions under the hero composer, chosen by the server. */
export function ActionCards({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: HomeSuggestion[];
  disabled?: boolean;
  onPick: (suggestion: HomeSuggestion) => void;
}) {
  return (
    <ul
      aria-label="Sugestões"
      className={cn(
        "grid gap-2 sm:gap-3",
        suggestions.length >= 4 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      )}
    >
      {suggestions.map((suggestion) => {
        const Icon = icons[suggestion.icon];
        // Links stay available even when the model is not configured.
        const off = disabled && suggestion.action.type === "prompt";
        return (
          <li key={suggestion.id} className="flex">
            <button
              type="button"
              disabled={off}
              onClick={() => onPick(suggestion)}
              className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left outline-none transition-[background-color,transform] duration-(--duration-fast) hover:bg-accent/60 active:scale-[0.99] active:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-semibold">
                  {suggestion.title}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {suggestion.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
