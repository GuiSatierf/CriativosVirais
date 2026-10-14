"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleTheme}
      className={className}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <Icon aria-hidden className="size-4" />
      {theme === "dark" ? "Modo claro" : "Modo escuro"}
    </Button>
  );
}
