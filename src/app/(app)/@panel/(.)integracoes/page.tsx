import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { IntegrationsView } from "@/components/views/integrations";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return (
    <Panel label="Integrações">
      <IntegrationsView />
    </Panel>
  );
}
