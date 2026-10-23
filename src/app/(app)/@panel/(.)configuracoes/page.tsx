import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { OfferView } from "@/components/views/offer";

export const metadata: Metadata = { title: "Minha oferta" };

export default function Page() {
  return (
    <Panel label="Minha oferta">
      <OfferView />
    </Panel>
  );
}
