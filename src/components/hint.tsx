import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Themed tooltip for icon-only controls, replacing the native `title`.
 * The child keeps its own accessible name (aria-label or sr-only text).
 */
export function Hint({
  label,
  side = "top",
  disabled = false,
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
  children: React.ReactElement;
}) {
  if (disabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
