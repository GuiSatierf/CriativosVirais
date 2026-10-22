"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { LoaderCircle, LogIn, UserPlus } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { newPasswordSchema } from "@/lib/password-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.email({ error: "Informe um email válido." }),
  password: z
    .string()
    .min(1, { error: "Informe sua senha." })
    .max(128, { error: "Use no máximo 128 caracteres." }),
});
const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe seu nome." })
    .max(100, { error: "Use no máximo 100 caracteres." }),
  email: loginSchema.shape.email,
  password: newPasswordSchema,
});

type Field = "name" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

function toFieldErrors(error: z.ZodError) {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "email" || field === "password")
      errors[field] ??= issue.message;
  }
  return errors;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setFormError(null);
    function invalid(error: z.ZodError) {
      const errors = toFieldErrors(error);
      setFieldErrors(errors);
      const first = (["name", "email", "password"] as const).find(
        (field) => errors[field],
      );
      const input = first && form.elements.namedItem(first);
      if (input instanceof HTMLInputElement) input.focus();
    }
    if (signup) {
      const parsed = signupSchema.safeParse(fields);
      if (!parsed.success) return invalid(parsed.error);
      await run(() => authClient.signUp.email(parsed.data));
    } else {
      const parsed = loginSchema.safeParse(fields);
      if (!parsed.success) return invalid(parsed.error);
      await run(() => authClient.signIn.email(parsed.data));
    }
  }

  async function run(call: () => Promise<{ error: unknown }>) {
    setFieldErrors({});
    setPending(true);
    try {
      const result = await call();
      if (result.error) {
        setFormError(
          signup
            ? "Não foi possível criar a conta. Se você já tem cadastro, entre com seu e-mail e senha."
            : "E-mail ou senha incorretos.",
        );
        return;
      }
      router.replace("/chat");
      router.refresh();
    } catch {
      setFormError(
        "Não foi possível conectar. Verifique sua internet e tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  function describedBy(field: Field, hint?: string) {
    return (
      [hint, fieldErrors[field] ? `${field}-error` : undefined]
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  function fieldError(field: Field) {
    return fieldErrors[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {fieldErrors[field]}
      </p>
    ) : null;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">
          {signup ? "Crie sua conta" : "Entre na sua conta"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {signup
            ? "Leva um minuto. Depois, conte sobre a sua oferta."
            : "Acesse seus criativos e roteiros."}
        </p>
      </header>
      <form
        onSubmit={submit}
        aria-busy={pending}
        noValidate
        className="space-y-4"
      >
        {signup && (
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
              disabled={pending}
              aria-describedby={describedBy("name")}
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldError("name")}
          </div>
        )}
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
            enterKeyHint="next"
            placeholder="voce@exemplo.com"
            disabled={pending}
            aria-describedby={describedBy("email")}
            aria-invalid={fieldErrors.email ? true : undefined}
          />
          {fieldError("email")}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Senha</Label>
            {!signup && (
              <Link
                href="/recuperar-senha"
                className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground pointer-coarse:py-2"
              >
                Esqueceu a senha?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
            enterKeyHint={signup ? "done" : "go"}
            disabled={pending}
            aria-describedby={describedBy(
              "password",
              signup ? "password-hint" : undefined,
            )}
            aria-invalid={fieldErrors.password ? true : undefined}
          />
          {signup && (
            <p id="password-hint" className="text-xs text-muted-foreground">
              Pelo menos 12 caracteres.
            </p>
          )}
          {fieldError("password")}
        </div>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Button className="mt-2 w-full" type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : signup ? (
            <UserPlus aria-hidden />
          ) : (
            <LogIn aria-hidden />
          )}
          {pending
            ? signup
              ? "Criando conta…"
              : "Entrando…"
            : signup
              ? "Criar conta"
              : "Entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
        <Link
          className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:decoration-2 pointer-coarse:py-2"
          href={signup ? "/login" : "/signup"}
        >
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </div>
  );
}
