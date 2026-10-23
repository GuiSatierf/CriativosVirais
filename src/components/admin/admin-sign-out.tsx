"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AdminSignOut() {
  const router = useRouter();
  async function signOut() {
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("sign-out refused");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={signOut}>
      <LogOut aria-hidden />
      Sair
    </Button>
  );
}
