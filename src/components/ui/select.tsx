"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Themed select built on Base UI: same look in every browser and in dark
 * mode, unlike the native control whose open list the OS draws.
 */
function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card py-1.5 pr-2.5 pl-3 text-left text-base outline-none transition-[border-color,box-shadow] duration-(--duration-fast) select-none hover:border-foreground/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/70 data-popup-open:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 pointer-coarse:min-h-11 md:text-sm dark:aria-invalid:border-destructive/50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-popup-open:rotate-180">
        <ChevronDown aria-hidden className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "min-w-0 flex-1 truncate data-placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        data-slot="select-positioner"
        sideOffset={4}
        alignItemWithTrigger={false}
        className="z-50 outline-none select-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[min(var(--available-height),20rem)] min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-popover-foreground shadow-(--shadow-floating) ring-1 ring-foreground/10 outline-none transition-[scale,opacity] duration-(--duration-fast) data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grid min-h-8 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-1.5 pr-3 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground pointer-coarse:min-h-10",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1 text-foreground">
        <Check aria-hidden className="size-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 min-w-0 truncate">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
