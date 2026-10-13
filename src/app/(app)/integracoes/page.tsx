import { StagePlaceholder } from "@/components/stage-placeholder";
export default function Page() {
  return (
    <StagePlaceholder
      title="Integrações"
      description="Conecte as métricas e vendas da sua operação. Importação CSV na etapa 4; webhook e UTMify na etapa 5."
      stage={4}
    />
  );
}
