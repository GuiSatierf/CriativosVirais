"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { LoaderCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api, toastError } from "@/lib/client";
import { legalPaths } from "@/lib/legal";

const acceptedSchema = z.object({ accepted: z.literal(true) });

/** Asks someone who signed up before the current terms to accept them once. */
export function AcceptTermsForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checked) return setMissing(true);
    setPending(true);
    try {
      await api("/api/legal/accept", acceptedSchema, {});
      router.replace("/chat");
      router.refresh();
    } catch (error) {
      toastError(error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TermsCheckbox checked={checked} onChange={(next) => { setChecked(next); setMissing(false); }} disabled={pending} error={missing} />
      <Button className="w-full" size="lg" type="submit" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />}
        Continuar
      </Button>
    </form>
  );
}

/** The consent line used by sign-up and by the acceptance page; links open in a new tab. */
export function TermsCheckbox({
  checked,
  onChange,
  disabled,
  error,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  error: boolean;
}) {
  const link = "rounded-sm font-medium text-foreground underline underline-offset-4 hover:decoration-2";
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
        <input
          type="checkbox"
          name="acceptedTerms"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "terms-error" : undefined}
          className="mt-0.5 size-4 shrink-0 accent-foreground pointer-coarse:size-5"
        />
        <span>
          Li e aceito os{" "}
          <Link href={legalPaths.terms} target="_blank" rel="noopener" className={link}>
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href={legalPaths.privacy} target="_blank" rel="noopener" className={link}>
            Política de privacidade
          </Link>
          .
        </span>
      </label>
      {error && (
        <p id="terms-error" className="text-sm text-destructive">
          Aceite os termos para continuar.
        </p>
      )}
    </div>
  );
}
