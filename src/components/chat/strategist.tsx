import { cn } from "@/lib/utils";

/** Display name of the chat assistant. It never claims to be a person. */
export const strategistName = "Estrategista";

/** The brand mark stands in for the strategist's face. */
export function StrategistAvatar({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt=""
      aria-hidden
      className={cn("size-8 shrink-0 rounded-lg", className)}
    />
  );
}
