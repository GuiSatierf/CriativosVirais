"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Laptops (lg, 1024 to 1279 px) get up to 64rem, always leaving 4rem of the chat visible;
// the 768 px tablet width squeezed two-column views such as a batch.
export const panelWidth =
  "data-[side=right]:w-full data-[side=right]:sm:max-w-3xl data-[side=right]:lg:max-w-[min(64rem,calc(100vw-4rem))] data-[side=right]:xl:max-w-6xl";

/**
 * Overlay used by intercepted routes: the page opens over the conversation
 * and closing it goes back. A direct visit renders the full page instead.
 */
export function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Focus lands on the panel itself, not on its first field, so nothing
  // looks selected before the person acts; Tab then enters the content.
  const body = useRef<HTMLDivElement>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        router.back();
      }}
    >
      <SheetContent
        side="right"
        initialFocus={body}
        className={`gap-0 ${panelWidth}`}
      >
        <SheetTitle className="sr-only">{label}</SheetTitle>
        <div
          ref={body}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 outline-none pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
