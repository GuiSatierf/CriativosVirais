import { Panel } from "@/components/panel";
import { CreativesView } from "@/components/views/creatives";

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Panel label="Resultados">
      <CreativesView {...props} />
    </Panel>
  );
}
