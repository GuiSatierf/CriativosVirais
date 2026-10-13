import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Vamos criar seus próximos anúncios
        </h1>
        <p className="mt-2 text-muted-foreground">
          Um espaço para entender sua oferta e preparar roteiros para gravar.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seu copywriter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>
            Me conta o que você vende, como funciona sua operação e o que você
            quer melhorar nos seus anúncios. Pode escrever ou mandar um áudio.
          </p>
          <Badge variant="secondary">
            Chat disponível na etapa 2 · áudio na etapa 3
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
