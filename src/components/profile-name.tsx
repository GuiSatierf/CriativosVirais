"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, LoaderCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const maxName = 100;

export function ProfileName({
  name: initial,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  const value = name.trim();
  const changed = value !== saved;
  const empty = value === "";

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || empty || pending) return;
    setPending(true);
    try {
      const result = await authClient.updateUser({ name: value });
      if (result.error) throw new Error();
      setSaved(value);
      setName(value);
      toast.success("Nome atualizado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o nome. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="profile-name"
            name="name"
            value={name}
            maxLength={maxName}
            autoComplete="name"
            enterKeyHint="done"
            aria-invalid={empty || undefined}
            aria-describedby={empty ? "profile-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {changed && (
            <div className="flex gap-2">
              <Button type="submit" disabled={empty || pending}>
                {pending ? (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <Check aria-hidden />
                )}
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setName(saved)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
        {empty && (
          <p id="profile-name-error" className="text-sm text-destructive">
            Escreva seu nome.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input
          id="profile-email"
          type="email"
          autoComplete="email"
          value={email}
          readOnly
          className="text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          Usado para entrar na sua conta.
        </p>
      </div>
    </form>
  );
}
