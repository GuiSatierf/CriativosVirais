"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, savedSchema } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { contextPatchSchema } from "@/lib/ai/schemas";
import { z } from "zod";
export function ContextForm({
  initial,
}: {
  initial: z.infer<typeof contextPatchSchema>;
}) {
  const [context, setContext] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api("/api/context", savedSchema, context, "PATCH");
          toast.success("Contexto atualizado.");
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Não foi possível salvar.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        A conversa atualiza este contexto. Você pode corrigir os dados e as
        provas autorizadas aqui.
      </p>
      {(
        [
          ["produto", "Produto / oferta"],
          ["produtoNome", "Nome do produto"],
          ["publico", "Público"],
          ["transformacao", "Transformação"],
          ["mecanismo", "Mecanismo"],
          ["tipoFunil", "Tipo de funil"],
          ["proximoPassoFunil", "Próximo passo"],
          ["especialistaHandle", "Perfil do especialista"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={`ctx-${key}`}>{label}</Label>
          <Textarea
            id={`ctx-${key}`}
            value={context[key] ?? ""}
            onChange={(e) => setContext({ ...context, [key]: e.target.value })}
            maxLength={
              key === "produtoNome"
                ? 300
                : key === "especialistaHandle"
                  ? 100
                  : 1000
            }
          />
        </div>
      ))}
      <div>
        <Label htmlFor="ctx-ticket">Ticket em centavos (ex.: 99700)</Label>
        <Input
          id="ctx-ticket"
          inputMode="numeric"
          maxLength={15}
          value={context.ticketCents ?? ""}
          onInput={(e) =>
            setContext({ ...context, ticketCents: e.currentTarget.value || null })
          }
        />
      </div>
      {(
        [
          ["provasAutorizadas", "Provas autorizadas (uma por linha)"],
          ["objecoes", "Objeções (uma por linha)"],
          ["restricoes", "Restrições (uma por linha)"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <Label htmlFor={`ctx-${key}`}>{label}</Label>
          <Textarea
            id={`ctx-${key}`}
            value={context[key]?.join("\n") ?? ""}
            onChange={(e) =>
              setContext({ ...context, [key]: e.target.value.split("\n") })
            }
          />
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar contexto"}
      </Button>
    </form>
  );
}
