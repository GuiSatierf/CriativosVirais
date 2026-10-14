"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});
const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (signup ? signupSchema : loginSchema).safeParse(fields);
    if (!parsed.success) {
      setError(
        signup
          ? "Confira seu nome, email e senha de pelo menos 12 caracteres."
          : "Informe um email válido e sua senha.",
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = signup
        ? await authClient.signUp.email(signupSchema.parse(fields))
        : await authClient.signIn.email(parsed.data);
      if (result.error) {
        setError(
          signup
            ? "Não foi possível criar a conta. Confira os dados ou tente entrar."
            : "Não foi possível entrar. Confira seu email e senha.",
        );
        return;
      }
      router.replace("/chat");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
      toast.error("Falha ao conectar ao serviço.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Criativos Virais
        </p>
        <CardTitle className="text-2xl">
          {signup ? "Crie sua conta" : "Entre na sua conta"}
        </CardTitle>
        <CardDescription>
          {signup
            ? "Prepare o espaço da sua operação."
            : "Acesse seus criativos e roteiros."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {signup && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                disabled={pending}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={signup ? 12 : 1}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
              disabled={pending}
            />
            {signup && (
              <p className="text-xs text-muted-foreground">
                Use pelo menos 12 caracteres.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {signup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href={signup ? "/login" : "/signup"}
            >
              {signup ? "Entrar" : "Criar conta"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
