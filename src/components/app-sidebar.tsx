"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Film,
  Layers,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
const links = [
  { href: "/chat", label: "Conversa", icon: MessageSquare },
  { href: "/criativos", label: "Criativos", icon: Film },
  { href: "/levas", label: "Levas", icon: Layers },
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
export function AppSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <aside className="border-b bg-sidebar md:sticky md:top-0 md:flex md:h-svh md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="px-5 py-5">
        <Link className="text-lg font-semibold" href="/chat">
          Criativos Virais
        </Link>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {userName}
        </p>
      </div>
      <Separator />
      <nav
        aria-label="Navegação principal"
        className="flex flex-wrap gap-1 p-3 md:flex-col"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent",
              pathname.startsWith(href) && "bg-sidebar-accent font-medium",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-3 md:mt-auto">
        <Button
          variant="ghost"
          onClick={logout}
          disabled={pending}
          className="w-full justify-start"
        >
          <LogOut className="size-4" />
          {pending ? "Saindo…" : "Sair"}
        </Button>
      </div>
    </aside>
  );
}
