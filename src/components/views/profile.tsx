import { requireTenant } from "@/lib/tenant";
import { avatarUrl } from "@/lib/avatar";
import { PageHeader } from "@/components/page-header";
import { ProfileName } from "@/components/profile-name";
import { ProfilePhoto } from "@/components/profile-photo";
import { ChangePassword, DeleteAccount } from "@/components/account-settings";
import { Button } from "@/components/ui/button";

const supportLockNote = {
  password: "No acesso de suporte, a senha nova é definida no painel: Contas, no menu do cliente.",
  delete: "Excluir a conta só o próprio cliente pode fazer.",
};

/** In a support visit the client's credentials stay with the client; the server refuses these too. */
function SupportLocked({ label, note, destructive = false }: { label: string; note: string; destructive?: boolean }) {
  return (
    <div className="space-y-2">
      <Button variant={destructive ? "destructive" : "default"} disabled className="w-fit">
        {label}
      </Button>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export async function ProfileView() {
  const { user, session } = await requireTenant();
  const supportVisit = session.impersonatedBy != null;
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Perfil" description="Sua foto e seus dados de acesso." />
      <div className="space-y-4">
        <section
          aria-labelledby="perfil-foto"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
        >
          <h2 id="perfil-foto" className="section-title">
            Foto
          </h2>
          <ProfilePhoto name={user.name} image={avatarUrl(user.id, user.image)} />
        </section>
        <section
          aria-labelledby="perfil-dados"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
        >
          <h2 id="perfil-dados" className="section-title">
            Seus dados
          </h2>
          <ProfileName name={user.name} email={user.email} />
        </section>
        <section
          aria-labelledby="perfil-senha"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
        >
          <h2 id="perfil-senha" className="section-title">
            Senha
          </h2>
          {supportVisit ? <SupportLocked label="Trocar senha" note={supportLockNote.password} /> : <ChangePassword />}
        </section>
        <section
          aria-labelledby="perfil-excluir"
          className="space-y-4 rounded-xl border border-destructive/30 bg-card p-4 sm:p-5"
        >
          <div className="space-y-1">
            <h2 id="perfil-excluir" className="section-title">
              Excluir conta
            </h2>
            <p className="text-sm text-muted-foreground">
              Apaga sua conta e todos os dados dela de forma permanente.
            </p>
          </div>
          {supportVisit ? <SupportLocked label="Excluir conta" note={supportLockNote.delete} destructive /> : <DeleteAccount />}
        </section>
      </div>
    </div>
  );
}
