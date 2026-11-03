"use client";
import { useEffect, useRef } from "react";
import { ChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readLoudness, type Microphone } from "./use-voice-recorder";

/** Each bar reacts to a slightly different share of the loudness, so speech looks alive. */
const barWeights = [0.55, 0.85, 1, 0.75, 0.5];
/** Loudness is small (speech is around 0.05–0.3), so it is scaled up for the bars. */
const loudnessGain = 8;
/** Smallest bar height, as a share of the full height, so the meter never disappears. */
const restingScale = 0.15;

/**
 * Bars that rise and fall with the microphone's loudness while recording. It draws straight
 * into the DOM on each animation frame instead of through React state, so the chat does not
 * re-render sixty times a second.
 */
export function LevelMeter({ analyser }: { analyser: AnalyserNode | null }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (analyser == null) return;
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    const draw = () => {
      const level = Math.min(1, readLoudness(analyser, samples) * loudnessGain);
      bars.current.forEach((bar, index) => {
        if (bar == null) return;
        const scale = Math.max(restingScale, level * (barWeights[index] ?? 1));
        bar.style.transform = `scaleY(${scale})`;
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden>
      {barWeights.map((weight, index) => (
        <span
          key={weight}
          ref={(element) => {
            bars.current[index] = element;
          }}
          style={{ transform: `scaleY(${restingScale})` }}
          className="h-full w-[3px] origin-bottom rounded-full bg-foreground/70 transition-transform duration-75"
        />
      ))}
    </span>
  );
}

/** Picks the microphone for the next recording; the choice is remembered in this browser. */
export function MicrophonePicker({
  microphones,
  value,
  disabled,
  onOpen,
  onChange,
}: {
  microphones: Microphone[];
  value: string;
  disabled?: boolean;
  onOpen: () => void;
  onChange: (id: string) => void;
}) {
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onOpen();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-ml-1 text-muted-foreground"
            aria-label="Escolher microfone"
            disabled={disabled}
          />
        }
      >
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Microfone</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(id) => onChange(String(id))}>
            <DropdownMenuRadioItem value="">Padrão do sistema</DropdownMenuRadioItem>
            {microphones.map((microphone) => (
              <DropdownMenuRadioItem key={microphone.id} value={microphone.id}>
                {microphone.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
