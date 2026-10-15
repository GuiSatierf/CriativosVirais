"use client";

import { Monitor, Moon, Sun } from "@/components/icons";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { themeSchema, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

const tones = {
  default: {
    group: "bg-muted",
    item: "text-muted-foreground hover:bg-card hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-(--shadow-panel)",
  },
  sidebar: {
    group: "bg-sidebar-hover",
    item: "text-sidebar-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring aria-pressed:bg-sidebar-accent aria-pressed:text-sidebar-accent-foreground aria-pressed:shadow-(--shadow-panel)",
  },
};

/** Compact three-way segmented control: light, dark or follow the system. */
export function ThemeToggle({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: keyof typeof tones;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <ToggleGroup
      aria-label="Tema"
      value={[theme]}
      onValueChange={(value) => {
        // Single selection: ignore attempts to unpress the active option.
        const next = themeSchema.safeParse(value[0]);
        if (next.success) setTheme(next.data);
      }}
      spacing={0.5}
      className={cn(
        "grid w-full grid-cols-3 rounded-lg p-0.5",
        tones[tone].group,
        className,
      )}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          className={cn(
            "h-7 gap-1.5 rounded-md px-2 text-xs pointer-coarse:h-10",
            tones[tone].item,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * The same segmented control inside a dropdown menu, built from menu radio
 * items so arrow keys, Enter and Esc behave like the rest of the menu.
 */
export function ThemeMenuGroup() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Aparência</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => {
          const next = themeSchema.safeParse(value);
          if (next.success) setTheme(next.data);
        }}
        className="mx-1.5 mt-0.5 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {options.map(({ value, label, icon: Icon }) => (
          <MenuPrimitive.RadioItem
            key={value}
            value={value}
            className="flex h-7 cursor-default items-center justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-hidden transition-colors duration-(--duration-fast) select-none pointer-coarse:h-10 data-checked:bg-card data-checked:text-foreground data-checked:shadow-(--shadow-panel) dark:data-checked:bg-input/40 data-highlighted:text-foreground data-highlighted:ring-2 data-highlighted:ring-ring/50"
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </MenuPrimitive.RadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
