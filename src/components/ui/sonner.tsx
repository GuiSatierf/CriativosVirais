"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Sonner styles itself with attribute selectors that outrank utility classes,
 * so the theme tokens are passed as CSS variables on the toaster element.
 */
const tokens = {
  "--normal-bg": "var(--popover)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--popover-foreground)",
  "--success-bg": "var(--popover)",
  "--success-border": "var(--border)",
  "--success-text": "var(--success)",
  "--error-bg": "var(--popover)",
  "--error-border": "var(--border)",
  "--error-text": "var(--destructive)",
  "--warning-bg": "var(--popover)",
  "--warning-border": "var(--border)",
  "--warning-text": "var(--warning)",
  "--info-bg": "var(--popover)",
  "--info-border": "var(--border)",
  "--info-text": "var(--primary)",
  "--border-radius": "var(--radius)",
  fontFamily: "var(--font-sans)",
} as CSSProperties;

/** shadcn-style Toaster without next-themes: the caller passes the theme. */
function Toaster({ theme = "system", ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      richColors
      mobileOffset={{
        bottom: "calc(1rem + env(safe-area-inset-bottom))",
        left: "1rem",
        right: "1rem",
      }}
      style={tokens}
      toastOptions={{ style: { boxShadow: "var(--shadow-floating)" } }}
      {...props}
    />
  );
}

export { Toaster };
