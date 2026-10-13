import { requireTenant } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default async function Page() {
  const { user } = await requireTenant();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Minha conta</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-muted-foreground">Nome</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
