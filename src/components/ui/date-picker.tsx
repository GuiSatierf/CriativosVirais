"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Days are plain "YYYY-MM-DD" strings, the same format the API uses. */
type Day = string;

const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];
const weekdayNames = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const longFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(day: Day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}
function addDays(day: Day, amount: number) {
  const date = toDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDay(date);
}
function addMonths(day: Day, amount: number) {
  const date = toDate(day);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
  // Keeps the day of month when it exists in the target month.
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return toDay(target);
}
function today(): Day {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}
/** dd/mm/aaaa, as people write dates in Brazil. */
function display(day: Day) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}
function clamp(day: Day, min?: Day, max?: Day) {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
}

/** Six weeks starting on the Sunday on or before the 1st of the month. */
function monthGrid(month: Day) {
  const first = toDate(month.slice(0, 8) + "01");
  const start = addDays(toDay(first), -first.getUTCDay());
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => addDays(start, week * 7 + weekday)),
  );
}

/**
 * Themed date field: a trigger showing dd/mm/aaaa and a calendar popover.
 * Keyboard: arrows move by day/week, PageUp/PageDown by month (with Shift by
 * year), Home/End to the week edges, Enter or Space picks, Esc closes.
 */
function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  variant = "field",
  placeholder = "dd/mm/aaaa",
  className,
  ...aria
}: {
  id?: string;
  value: Day;
  onChange: (day: Day) => void;
  min?: Day;
  max?: Day;
  invalid?: boolean;
  /** "inline" drops the border, for fields grouped in a shared box. */
  variant?: "field" | "inline";
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState<Day>(() =>
    clamp(value || today(), min, max),
  );
  const grid = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const current = today();

  // Moves keyboard focus to the focused day after it changes.
  React.useEffect(() => {
    if (!open) return;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)
      ?.focus({ preventScroll: true });
  }, [focused, open]);

  function move(day: Day) {
    setFocused(clamp(day, min, max));
  }

  function pick(day: Day) {
    if ((min && day < min) || (max && day > max)) return;
    onChange(day);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const keys: Record<string, () => Day> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -toDate(focused).getUTCDay()),
      End: () => addDays(focused, 6 - toDate(focused).getUTCDay()),
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    move(next());
  }

  const weeks = monthGrid(focused);
  const month = focused.slice(0, 7);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setFocused(clamp(value || today(), min, max));
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger
        id={id}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        className={cn(
          "group flex min-w-0 items-center gap-2 text-left text-base tabular-nums outline-none select-none md:text-sm",
          variant === "field"
            ? "min-h-9 w-full rounded-lg border border-input bg-card px-3 py-1.5 transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-foreground/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/70 data-popup-open:border-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 pointer-coarse:min-h-11"
            : "min-h-8 rounded-md px-2 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/70 data-popup-open:bg-accent",
          className,
        )}
      >
        {variant === "field" && (
          <CalendarDays
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
          {value ? display(value) : placeholder}
        </span>
        {variant === "field" && (
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-popup-open:rotate-180"
          />
        )}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} align="start" className="z-50">
          <PopoverPrimitive.Popup
            aria-labelledby={titleId}
            // Lands on the selected (or today's) day so arrows work at once.
            initialFocus={() =>
              grid.current?.querySelector<HTMLElement>("[tabindex='0']") ?? true
            }
            className="w-[19rem] origin-(--transform-origin) rounded-xl bg-popover p-3 text-popover-foreground shadow-(--shadow-floating) ring-1 ring-foreground/10 outline-none transition-[scale,opacity] duration-(--duration-fast) data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => move(addMonths(focused, -1))}
                disabled={Boolean(min && addMonths(month + "-01", 0) <= min.slice(0, 7) + "-01")}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-40 pointer-coarse:size-10"
              >
                <ChevronDown aria-hidden className="size-4 rotate-90" />
              </button>
              <p
                id={titleId}
                aria-live="polite"
                className="text-sm font-semibold first-letter:uppercase"
              >
                {monthFormat.format(toDate(month + "-01"))}
              </p>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => move(addMonths(focused, 1))}
                disabled={Boolean(max && month >= max.slice(0, 7))}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-40 pointer-coarse:size-10"
              >
                <ChevronDown aria-hidden className="size-4 -rotate-90" />
              </button>
            </div>
            <div
              ref={grid}
              role="grid"
              aria-labelledby={titleId}
              onKeyDown={onKeyDown}
              className="grid gap-y-0.5"
            >
              <div role="row" className="grid grid-cols-7">
                {weekdays.map((label, index) => (
                  <span
                    key={index}
                    role="columnheader"
                    aria-label={weekdayNames[index]}
                    className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
              {weeks.map((week) => (
                <div key={week[0]} role="row" className="grid grid-cols-7">
                  {week.map((day) => {
                    const outside = !day.startsWith(month);
                    const selected = day === value;
                    const disabled =
                      Boolean(min && day < min) || Boolean(max && day > max);
                    return (
                      <span key={day} role="gridcell" aria-selected={selected}>
                        <button
                          type="button"
                          data-day={day}
                          tabIndex={day === focused ? 0 : -1}
                          disabled={disabled}
                          aria-label={longFormat.format(toDate(day))}
                          aria-current={day === current ? "date" : undefined}
                          onClick={() => pick(day)}
                          onFocus={() => setFocused(day)}
                          className={cn(
                            "relative flex size-9 w-full items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors duration-(--duration-fast) focus-visible:ring-3 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-10",
                            selected
                              ? "bg-primary font-semibold text-primary-foreground"
                              : outside
                                ? "text-muted-foreground/70 hover:bg-accent"
                                : "hover:bg-accent",
                            day === current &&
                              !selected &&
                              "font-semibold after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-brand",
                          )}
                        >
                          {Number(day.slice(8))}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t pt-2">
              <button
                type="button"
                onClick={() => pick(clamp(current, min, max))}
                className="rounded-md px-2 py-1 text-sm font-medium outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/70 pointer-coarse:min-h-10"
              >
                Hoje
              </button>
              <PopoverPrimitive.Close className="rounded-md px-2 py-1 text-sm text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 pointer-coarse:min-h-10">
                Fechar
              </PopoverPrimitive.Close>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { DatePicker };
