"use client";
import { useId, useState } from "react";
import { Check, LoaderCircle } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError } from "@/lib/client";

const maxName = 200;

/** Dialog with one text field; closes only after `onSave` succeeds. */
export function RenameDialog({
  open,
  onOpenChange,
  title,
  label,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  value: string;
  onSave: (name: string) => Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState(value);
  const [pending, setPending] = useState(false);
  const trimmed = name.trim();

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || pending) return;
    if (trimmed === value) return onOpenChange(false);
    setPending(true);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch (error) {
      toastError(error, "Não foi possível renomear. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(value);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              value={name}
              maxLength={maxName}
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={!trimmed || pending}>
              {pending ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
