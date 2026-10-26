import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { termsMarkdown } from "@/content/legal";
import { legalPaths } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalDocument
      title="Termos de uso"
      description="Regras para usar o Criativos Virais."
      text={termsMarkdown}
      other={{ label: "Política de privacidade", href: legalPaths.privacy }}
    />
  );
}
