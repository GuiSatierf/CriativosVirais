"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { LoaderCircle, LogOut } from "@/components/icons";
import { api, toastError } from "@/lib/client";

const leftSchema = z.object({ left: z.boolean() });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Reminds a team member whose account they are in, until when, and takes them back to the panel. */
export function SupportBanner({ clientName, endsAt }: { clientName: string; endsAt: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const until = timeFormat.format(new Date(endsAt));

  async function leave() {
    setPending(true);
    try {
      await api("/api/support-visit", leftSchema, {}, "DELETE");
      router.replace("/admin?aba=contas");
      router.refresh();
    } catch (error) {
      toastError(error);
      setPending(false);
    }
  }

  return (
    <div role="status" className="flex shrink-0 items-center justify-center gap-x-3 gap-y-1 bg-foreground px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm text-background">
      <p className="min-w-0">
        <span className="hidden sm:inline">Você está na conta de </span>
        <span className="sm:hidden">Na conta de </span>
        <b className="font-semibold">{clientName}</b>
        <span className="hidden sm:inline"> · acesso de suporte até {until}</span>
        <span className="sm:hidden"> até {until}</span>
      </p>
      <button
        type="button"
        onClick={leave}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-background/30 px-2.5 py-1 font-medium pointer-coarse:min-h-11 hover:bg-background/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        <span className="hidden sm:inline">Sair da conta</span>
        <span className="sm:hidden">Sair</span>
      </button>
    </div>
  );
}
