"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LoaderCircle } from "@/components/icons";
import { connectionFailed, tooManyAttempts } from "@/components/password-reset-request";
import { authClient } from "@/lib/auth-client";
import {
  maxPasswordLength,
  minPasswordLength,
  newPasswordSchema,
  resetLinkLifetimeLabel,
} from "@/lib/password-rules";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/** Shown for a link that expired, was already used or is malformed. */
export function ExpiredResetLink() {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Link vencido</h1>
        <p className="text-sm text-muted-foreground">
          Este link para criar uma senha nova venceu ou já foi usado. Cada link vale por{" "}
          {resetLinkLifetimeLabel} e funciona uma vez só.
        </p>
      </header>
      <Link href="/recuperar-senha" className={buttonVariants({ className: "w-full" })}>
        Pedir um link novo
      </Link>
      <Link
        href="/login"
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        <ArrowLeft aria-hidden />
        Voltar para o login
      </Link>
    </div>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("password");
    const parsed = newPasswordSchema.safeParse(new FormData(event.currentTarget).get("password"));
    setFormError(null);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Informe a nova senha.");
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: parsed.data, token });
      if (result.error == null) {
        router.replace("/login?senha=alterada");
        return;
      }

      if (result.error.code === "INVALID_TOKEN") {
        setExpired(true);
        return;
      }

      setFormError(
        result.error.status === 429
          ? tooManyAttempts
          : "Não foi possível salvar a senha agora. Tente novamente.",
      );
    } catch {
      setFormError(connectionFailed);
    } finally {
      setPending(false);
    }
  }

  if (expired) return <ExpiredResetLink />;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Depois de salvar, as sessões abertas em outros aparelhos são encerradas.
        </p>
      </header>
      <form onSubmit={submit} aria-busy={pending} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordInput
            id="password"
            name="password"
            required
            maxLength={maxPasswordLength}
            autoComplete="new-password"
            enterKeyHint="done"
            disabled={pending}
            aria-describedby={["password-hint", fieldError ? "password-error" : undefined]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={fieldError ? true : undefined}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            Pelo menos {minPasswordLength} caracteres.
          </p>
          {fieldError && (
            <p id="password-error" className="text-sm text-destructive">
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
            <KeyRound aria-hidden />
          )}
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
