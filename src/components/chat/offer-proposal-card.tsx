"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { ArrowRight, Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { offerProposalSchema } from "@/lib/ai/schemas";
import { api, formatCents, savedSchema, toastError } from "@/lib/client";
import { proposalInOffer, savedOfferSchema } from "@/lib/offer-proposal";
import { cn } from "@/lib/utils";

type OfferProposal = z.infer<typeof offerProposalSchema>;
type CardState = "checking" | "pending" | "saving" | "confirmed" | "dismissed";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

function StatusBadge({ state, confirmedOn }: { state: CardState; confirmedOn: string | null }) {
  if (state === "checking")
    return <span aria-hidden className="block h-6 w-32 animate-pulse rounded-full bg-muted" />;
  if (state === "confirmed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-background">
        <Check className="size-3" aria-hidden />
        {confirmedOn == null ? "Confirmado" : `Confirmado em ${confirmedOn}`}
      </span>
    );
  if (state === "dismissed")
    return (
      <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
        Não usado
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-background">
      Falta você conferir
    </span>
  );
}

/** Shows the price and proofs the assistant heard and saves them only when the client confirms. */
export function OfferProposalCard({ proposal }: { proposal: OfferProposal }) {
  const titleId = useId();
  const [state, setState] = useState<CardState>("checking");
  const [confirmedOn, setConfirmedOn] = useState<string | null>(null);
  // Parts are re-created while the reply streams; the text keeps the check to one request.
  const signature = JSON.stringify(proposal);

  useEffect(() => {
    let active = true;
    const expected = offerProposalSchema.parse(JSON.parse(signature));
    api("/api/context", savedOfferSchema)
      .then((offer) => {
        if (active) setState(proposalInOffer(expected, offer) ? "confirmed" : "pending");
      })
      // Without the saved offer the card cannot tell it was confirmed, so it asks again.
      .catch(() => {
        if (active) setState("pending");
      });
    return () => {
      active = false;
    };
  }, [signature]);

  async function confirm() {
    setState("saving");
    try {
      await api("/api/context", savedSchema, proposal, "PATCH");
      setConfirmedOn(dayFormat.format(new Date()));
      setState("confirmed");
    } catch (error) {
      toastError(error, "Não foi possível salvar. Tente de novo.");
      setState("pending");
    }
  }

  const proofs = proposal.provasAutorizadas;
  const waiting = state === "pending" || state === "saving";
  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div className="space-y-2">
        <p aria-live="polite">
          <StatusBadge state={state} confirmedOn={confirmedOn} />
        </p>
        <h4 id={titleId} className="text-sm font-semibold">
          {state === "confirmed"
            ? "Preço e provas salvos na sua oferta"
            : "Confira antes de eu usar nos roteiros"}
        </h4>
        {state === "confirmed" ? null : (
          <p className="text-sm text-muted-foreground">
            Prova e preço aparecem no anúncio. Só uso o que você confirmar.
          </p>
        )}
      </div>
      {proposal.ticketCents === undefined ? null : (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Preço</p>
          <p className="text-lg font-semibold">
            {proposal.ticketCents == null ? "Sem preço" : formatCents(proposal.ticketCents)}
          </p>
        </div>
      )}
      {proofs === undefined ? null : (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Provas ({proofs.length})
          </p>
          {proofs.length === 0 ? (
            <p className="text-sm">Nenhuma prova</p>
          ) : (
            <ul className="space-y-1.5">
              {proofs.map((proof, index) => (
                <li key={index} className="rounded-lg bg-background px-3 py-2 text-sm">
                  {proof}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {waiting ? (
        <>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              size="lg"
              disabled={state === "saving"}
              onClick={() => void confirm()}
            >
              {state === "saving" ? "Salvando..." : "Confirmar e salvar"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={state === "saving"}
              onClick={() => setState("dismissed")}
            >
              Não usar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Algo errado? Toque em &quot;Não usar&quot; e me diga o certo na conversa.
          </p>
        </>
      ) : null}
      {state === "dismissed" ? (
        <p className="text-sm text-muted-foreground">
          Não salvei. Me diga o preço e as provas certas na conversa.
        </p>
      ) : null}
      {state === "confirmed" ? (
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none",
            "hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Mudar depois em Minha oferta
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
