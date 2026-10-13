import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export function StagePlaceholder({
  title,
  description,
  stage,
}: {
  title: string;
  description: string;
  stage: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <Badge variant="secondary">Disponível na etapa {stage}</Badge>
        </div>
        <CardTitle className="mt-3 text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          A estrutura da sua conta está pronta. Esta funcionalidade será
          habilitada na próxima fase de implementação.
        </p>
      </CardContent>
    </Card>
  );
}
