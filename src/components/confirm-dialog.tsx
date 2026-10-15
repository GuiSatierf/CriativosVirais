"use client";
import { useState } from "react";
import { LoaderCircle, type LucideIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toastError } from "@/lib/client";

/** Confirmation that stays open while `onConfirm` runs and closes on success. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  icon: Icon,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toastError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              Icon && <Icon aria-hidden />
            )}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
