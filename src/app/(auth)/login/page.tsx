import { AuthForm } from "@/components/auth-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { senha } = await searchParams;
  if (senha !== "alterada") return <AuthForm mode="login" />;
  return (
    <div className="space-y-6">
      <Alert role="status">
        <AlertDescription>Senha alterada. Entre com a nova senha.</AlertDescription>
      </Alert>
      <AuthForm mode="login" />
    </div>
  );
}
