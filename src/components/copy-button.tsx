"use client";
import { useEffect, useState } from "react";
import { Check, Copy } from "@/components/icons";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const iconSizes = { default: "icon", sm: "icon-sm", xs: "icon-xs" } as const;

/**
 * Copies `text` and confirms in place. `label` is the accessible name
 * (e.g. "Copiar token"); with `iconOnly` it is not shown visually.
 */
export function CopyButton({
  text,
  label,
  iconOnly = false,
  variant = "outline",
  size = "default",
  className,
}: {
  text: string;
  label: string;
  iconOnly?: boolean;
  variant?: "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "xs";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <>
      <Hint label={copied ? "Copiado" : label} disabled={!iconOnly}>
        <Button
          type="button"
          variant={variant}
          size={iconOnly ? iconSizes[size] : size}
          aria-label={iconOnly ? label : undefined}
          className={cn("shrink-0", copied && "text-success", className)}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              toast.error(
                "O navegador não permitiu copiar. Copie manualmente.",
              );
            }
          }}
        >
          <Icon aria-hidden />
          {!iconOnly && (copied ? "Copiado" : label)}
        </Button>
      </Hint>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copiado" : ""}
      </span>
    </>
  );
}
