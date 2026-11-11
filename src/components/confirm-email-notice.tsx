"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Server code for an action that waits for a confirmed email (password, account deletion, two-factor). */
export const emailNotConfirmed = "EMAIL_NOT_CONFIRMED";

/** Shown when that action is refused: sends the confirmation link that brings the person back here. */
export function ConfirmEmailNotice() {
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const email = data?.user.email;

  async function send() {
    if (email == null) return;
    setState("sending");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: pathname });
      setState(result.error ? "failed" : "sent");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="grid gap-3">
      <Alert role="status">
        <AlertDescription>
          {state === "sent"
            ? `Enviamos um link para ${email}. Abra o e-mail, toque em "Confirmar meu e-mail" e depois tente de novo aqui.`
            : "Para sua segurança, confirme seu e-mail antes. Toque no botão abaixo e enviamos um link para a sua caixa de entrada."}
        </AlertDescription>
      </Alert>
      {state !== "sent" && (
        <Button type="button" variant="outline" className="w-fit" disabled={state === "sending" || email == null} onClick={send}>
          {state === "sending" && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {state === "sending" ? "Enviando…" : "Enviar link de confirmação"}
        </Button>
      )}
      {state === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível enviar agora. Tente de novo em instantes.
        </p>
      )}
    </div>
  );
}
