import type { Metadata } from "next";
import { ExpiredResetLink, NewPasswordForm } from "@/components/new-password-form";

export const metadata: Metadata = {
  title: "Criar nova senha · Criativos Virais",
};

// Better Auth redirects here with ?token= for a live link, or ?error=INVALID_TOKEN otherwise.
export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || token.length === 0) return <ExpiredResetLink />;
  return <NewPasswordForm token={token} />;
}
