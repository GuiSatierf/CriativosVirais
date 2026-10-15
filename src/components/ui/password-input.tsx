"use client";

import * as React from "react";
import { Eye, EyeOff } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with its own show/hide control, so browsers' built-in
 * reveal buttons (hidden in globals.css) never stack with it.
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:pointer-events-none pointer-coarse:w-11"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-[1.125rem]" />
        ) : (
          <Eye aria-hidden className="size-[1.125rem]" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
