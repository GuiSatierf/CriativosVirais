"use client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copiado.");
        } catch {
          toast.error("O navegador não permitiu copiar.");
        }
      }}
    >
      {label}
    </Button>
  );
}
