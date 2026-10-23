import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { ProfileView } from "@/components/views/profile";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return (
    <Panel label="Perfil">
      <ProfileView />
    </Panel>
  );
}
