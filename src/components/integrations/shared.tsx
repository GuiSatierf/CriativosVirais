"use client";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  type LucideIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type IntegrationStatus =
  "connected" | "pending" | "error" | "disconnected";

const statusBadges: Record<
  IntegrationStatus,
  { label: string; className: string }
> = {
  connected: {
    label: "Conectada",
    className: "border-success/30 text-success",
  },
  pending: { label: "Aguardando", className: "text-muted-foreground" },
  error: {
    label: "Com erro",
    className: "border-destructive/30 text-destructive",
  },
  disconnected: { label: "Desconectada", className: "text-muted-foreground" },
};

export function toStatus(status: string | undefined): IntegrationStatus {
  return status && status in statusBadges
    ? (status as IntegrationStatus)
    : "disconnected";
}

/** Badge for real states only; "disconnected" renders nothing on purpose. */
export function StatusBadge({
  status,
  label,
}: {
  status: IntegrationStatus;
  label?: string;
}) {
  if (status === "disconnected") return null;
  const badge = statusBadges[status];
  return (
    <Badge variant="outline" className={badge.className}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "pending" && "animate-pulse",
        )}
      />
      {label ?? badge.label}
    </Badge>
  );
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

/** Overview tile for one integration: name, status, meta and actions. */
export function IntegrationCard({
  title,
  tag,
  description,
  brings,
  badge,
  meta,
  children,
}: {
  title: string;
  /** Next to the title: whether this source is required or optional. */
  tag?: React.ReactNode;
  description: string;
  /** What the source brings (and what it does not). */
  brings?: string;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border bg-card p-5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {tag}
        </div>
        {badge}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {brings && <p className="mt-1 text-xs text-muted-foreground">{brings}</p>}
      {meta && <p className="mt-2 text-xs text-muted-foreground">{meta}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {children}
      </div>
    </article>
  );
}

/** Loading placeholder with the same footprint as IntegrationCard. */
export function IntegrationCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5">
      <div className="flex min-h-6 items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-4 w-48" />
      <Skeleton className="mt-6 h-9 w-28 rounded-lg" />
    </div>
  );
}

/** Right-side setup panel, full width on phones. */
export function SetupSheetContent({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
      <SheetHeader className="border-b px-6 py-5 pr-14">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {children}
      </div>
    </SheetContent>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-6">{children}</ol>;
}

/** One numbered setup step; `muted` dims steps that are not reachable yet. */
export function Step({
  number,
  title,
  done,
  muted,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
      <span
        aria-hidden
        className={cn(
          "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
          done
            ? "border-foreground bg-foreground text-background"
            : muted
              ? "text-muted-foreground"
              : "border-foreground/40",
        )}
      >
        {done ? <Check className="size-3.5" /> : number}
      </span>
      <div className="min-w-0 space-y-3">
        <h3
          className={cn(
            "pt-0.5 text-sm font-medium",
            muted && "text-muted-foreground",
          )}
        >
          <span className="sr-only">
            Passo {number}
            {done ? " (concluído)" : ""}:{" "}
          </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

/** Low-emphasis disclosure for details most clients can skip. */
export function Details({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="space-y-2">
      <CollapsibleTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "group/details -ml-3 text-muted-foreground",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-data-panel-open/details:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** Button that asks for confirmation before running its action. */
export function ConfirmButton({
  label,
  pendingLabel,
  title,
  description,
  confirmLabel,
  destructive = true,
  pending,
  disabled,
  variant = "outline",
  icon: Icon,
  onConfirm,
}: {
  label: string;
  pendingLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  icon?: LucideIcon;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        disabled={disabled || pending}
        className={
          variant === "ghost" && destructive ? "text-destructive" : undefined
        }
        onClick={() => setOpen(true)}
      >
        {pending ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          Icon && <Icon aria-hidden />
        )}
        {pending && pendingLabel ? pendingLabel : label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {Icon && <Icon aria-hidden />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
