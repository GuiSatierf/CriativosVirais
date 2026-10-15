import Image from "next/image";
import { cn } from "@/lib/utils";

const logoSize = { width: 909, height: 103 };

/** Official wordmark: the dark version on light theme and vice versa. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center", className)}>
      <Image
        src="/brand/logo-dark.svg"
        alt="Criativos Virais"
        {...logoSize}
        unoptimized
        draggable={false}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src="/brand/logo-light.svg"
        alt="Criativos Virais"
        {...logoSize}
        unoptimized
        draggable={false}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
