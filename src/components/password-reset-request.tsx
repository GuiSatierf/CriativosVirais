"use client";
import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowLeft, ArrowRight, LoaderCircle } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.email({ error: "Informe um e-mail válido." });

export const tooManyAttempts = "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
export const connectionFailed = "Não foi possível conectar. Verifique sua internet e tente novamente.";

function BackToLogin() {
  return (
    <Link
      href="/login"
      className={buttonVariants({ variant: "outline", className: "w-full" })}
    >
      <ArrowLeft aria-hidden />
      Voltar para o login
    </Link>
  );
}

function SentNotice({ email, onRetry }: { email: string; onRetry: () => void }) {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Confira seu e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Se existe uma conta com <span className="font-medium text-foreground">{email}</span>, enviamos
          um link para criar uma senha nova. Ele vale por 1 hora.
        </p>
      </header>
      <p className="rounded-xl border bg-card p-4 text-sm">
        Não chegou em alguns minutos? Veja a caixa de spam ou{" "}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm font-medium underline underline-offset-4 hover:decoration-2 pointer-coarse:py-2"
        >
          peça outro link
        </button>
        .
      </p>
      <BackToLogin />
    </div>
  );
}

export function PasswordResetRequest() {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("email");
    const parsed = emailSchema.safeParse(new FormData(event.currentTarget).get("email"));
    setFormError(null);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Informe um e-mail válido.");
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: parsed.data,
        redirectTo: "/nova-senha",
      });
      if (result.error?.status === 429) return setFormError(tooManyAttempts);
      if (result.error) return setFormError("Não foi possível enviar o link agora. Tente novamente.");
      setSentTo(parsed.data);
    } catch {
      setFormError(connectionFailed);
    } finally {
      setPending(false);
    }
  }

  if (sentTo) return <SentNotice email={sentTo} onRetry={() => setSentTo(null)} />;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
        </p>
      </header>
      <form onSubmit={submit} aria-busy={pending} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="voce@exemplo.com"
            disabled={pending}
            aria-describedby={fieldError ? "email-error" : undefined}
            aria-invalid={fieldError ? true : undefined}
          />
          {fieldError && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Button className="mt-2 w-full" type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <ArrowRight aria-hidden />
          )}
          {pending ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
      <BackToLogin />
    </div>
  );
}
