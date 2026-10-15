import { Panel } from "@/components/panel";
import { BatchesView } from "@/components/views/batches";

export default function Page(props: { searchParams: Promise<{ arquivadas?: string }> }) {
  return (
    <Panel label="Levas">
      <BatchesView {...props} />
    </Panel>
  );
}
