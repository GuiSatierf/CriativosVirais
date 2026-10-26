import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AcceptTermsForm } from "@/components/accept-terms-form";
import { getAuth } from "@/lib/auth";
import { hasAcceptedCurrentTerms } from "@/lib/legal-records";

export const metadata: Metadata = { title: "Termos de uso" };

/** Shown once to accounts created before the current terms; the app sends them here. */
export default async function AcceptTermsPage() {
  const current = await getAuth().api.getSession({ headers: await headers() });
  if (current == null) redirect("/login");
  if (current.session.impersonatedBy != null || (await hasAcceptedCurrentTerms(current.user.id))) redirect("/chat");
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh flex-col items-center justify-center px-5 py-10 outline-none">
      <Brand className="mb-8 h-6" />
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-(--shadow-panel) sm:p-8">
        <header className="space-y-1.5">
          <h1 className="page-title">Termos de uso e privacidade</h1>
          <p className="text-sm text-muted-foreground">
            Publicamos os Termos de uso e a Política de privacidade do Criativos Virais. Para continuar usando, leia e aceite uma vez.
          </p>
        </header>
        <AcceptTermsForm />
      </div>
    </main>
  );
}
