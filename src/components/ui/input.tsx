import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "min-h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1.5 text-base pointer-coarse:min-h-11 md:text-sm transition-[border-color,box-shadow] duration-(--duration-fast) outline-none file:inline-flex file:min-h-8 file:border-0 file:mr-3 file:rounded-md file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-foreground/35 user-invalid:border-destructive focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
