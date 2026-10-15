"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Grows with its content; Safari lacks `field-sizing`, so it is done in JS there. */
function Textarea({
  className,
  ref,
  onInput,
  ...props
}: React.ComponentProps<"textarea">) {
  const local = React.useRef<HTMLTextAreaElement>(null);

  const fit = React.useCallback(() => {
    const element = local.current;
    if (!element || CSS.supports("field-sizing", "content")) return;
    element.style.height = "auto";
    const border = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + border}px`;
  }, []);

  // Also refits when the value changes from code (suggestions, transcripts).
  React.useLayoutEffect(fit, [fit, props.value]);

  return (
    <textarea
      data-slot="textarea"
      ref={(element) => {
        local.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      }}
      onInput={(event) => {
        fit();
        onInput?.(event);
      }}
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-base md:text-sm transition-[border-color,box-shadow] duration-(--duration-fast) outline-none placeholder:text-muted-foreground hover:border-foreground/35 user-invalid:border-destructive focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
