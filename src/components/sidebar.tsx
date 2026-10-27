"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  Archive,
  ArrowRight,
  ChartColumn,
  ChevronDown,
  ChevronRightIcon,
  Ellipsis,
  Folder,
  FolderOpen,
  Layers,
  LogOut,
  PanelLeftClose,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SquarePen,
  Trash2,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Brand } from "@/components/brand";
import { ThemeMenuGroup } from "@/components/theme-toggle";
import { ConversationActions } from "@/components/conversation-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RenameDialog } from "@/components/rename-dialog";
import { authClient } from "@/lib/auth-client";
import { api, savedSchema, toastError } from "@/lib/client";
import { projectNameMaxLength } from "@/lib/project-name";
import { cn } from "@/lib/utils";

export type SidebarUser = { name: string; email?: string; image?: string };
export type SidebarConversation = { id: string; title: string; createdAt: Date; projectId: string | null };
export type SidebarProject = { id: string; name: string };
export type SidebarNotice = { label: string; href: string };

type NavLink = { href: string; label: string; icon: LucideIcon };

/** Every area of the app, one click away; they open as panels over the conversation. */
const places: NavLink[] = [
  { href: "/levas", label: "Levas", icon: Layers },
  { href: "/criativos", label: "Resultados", icon: ChartColumn },
  { href: "/configuracoes", label: "Minha oferta", icon: Settings },
  { href: "/integracoes", label: "Integrações", icon: Plug },
];
const archivedHref = "/conversas/arquivadas";
const conversationMime = "application/x-criativos-conversation";

/** Rows sit inside a clipped scroll area, so their focus outline is inset. */
const rowFocus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";
const rowBase =
  "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors duration-(--duration-fast) pointer-coarse:h-11";
const rowIdle = "text-foreground/85 hover:bg-accent hover:text-foreground";
const rowCurrent = "bg-accent font-medium text-foreground";
const rowIcon = "size-[1.125rem] shrink-0 text-muted-foreground group-hover:text-foreground";
const sectionHeading = "flex items-center justify-between gap-2 px-2.5 pt-4 pb-1 text-xs font-medium text-muted-foreground";
const rowActions =
  "absolute top-1/2 right-1 size-7 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:opacity-100 focus-visible:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Case- and accent-insensitive matching for the search field. */
function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Fine pointer (mouse/trackpad) only: touch keyboards should not open by themselves. */
function canAutofocus() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

export function useNewConversation(onNavigate?: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const creating = useRef(false);
  async function create(projectId: string | null = null) {
    if (creating.current) return;
    creating.current = true;
    setPending(true);
    try {
      const conversation = await api("/api/conversations", z.object({ id: z.uuid() }), { projectId });
      onNavigate?.();
      router.push(`/chat/${conversation.id}`);
      router.refresh();
    } catch (error) {
      toastError(error, "Não foi possível criar a conversa.");
    } finally {
      creating.current = false;
      setPending(false);
    }
  }
  return { create, pending };
}

async function moveConversation(conversationId: string, projectId: string | null) {
  await api(`/api/conversations/${conversationId}`, savedSchema, { projectId }, "PATCH");
}

/**
 * Left bar, like the Claude app: new conversation, search, every area of the app,
 * the leva with results, projects with their conversations and the loose conversations.
 */
export function SidebarBody({
  user,
  conversations,
  projects,
  notice,
  showAdminLink,
  supportVisit,
  searchRequest,
  onNavigate,
  onCollapse,
}: {
  user: SidebarUser;
  conversations: SidebarConversation[];
  projects: SidebarProject[];
  notice: SidebarNotice | null;
  showAdminLink: boolean;
  supportVisit: boolean;
  /** Changes when Ctrl/⌘ + K asks for the search field. */
  searchRequest: number;
  /** Closes the phone drawer after a link is followed. */
  onNavigate?: () => void;
  /** Hides the bar on wide screens; absent inside the phone drawer. */
  onCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [searching, setSearching] = useState(searchRequest > 0);
  const [handledRequest, setHandledRequest] = useState(searchRequest);
  if (handledRequest !== searchRequest) {
    setHandledRequest(searchRequest);
    setSearching(true);
  }
  const [query, setQuery] = useState("");
  const { create, pending } = useNewConversation(onNavigate);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-4">
        <Link href="/chat" onClick={onNavigate} aria-label="Criativos Virais — início" className="inline-flex rounded-md">
          <Brand className="h-5" />
        </Link>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Recolher a barra lateral"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCollapse}
          >
            <PanelLeftClose aria-hidden className="size-5" />
          </Button>
        )}
      </div>

      <nav aria-label="Áreas do app" className="shrink-0 space-y-px px-2">
        <button
          type="button"
          onClick={() => void create()}
          disabled={pending}
          aria-busy={pending}
          className={cn(rowBase, rowFocus, rowIdle)}
        >
          <SquarePen aria-hidden className={rowIcon} />
          {pending ? "Criando conversa…" : "Nova conversa"}
        </button>
        <button
          type="button"
          aria-pressed={searching}
          onClick={() => {
            setSearching(!searching);
            setQuery("");
          }}
          className={cn(rowBase, rowFocus, searching ? rowCurrent : rowIdle)}
        >
          <Search aria-hidden className={rowIcon} />
          Buscar conversas
        </button>
        {places.map((place) => (
          <PlaceLink key={place.href} place={place} active={isActive(pathname, place.href)} onNavigate={onNavigate} />
        ))}
        {showAdminLink && (
          <Link href="/admin" onClick={onNavigate} className={cn(rowBase, rowFocus, rowIdle)}>
            <ShieldCheck aria-hidden className={rowIcon} />
            Painel Admin
          </Link>
        )}
      </nav>

      {notice && <NoticeLink notice={notice} onNavigate={onNavigate} className="mx-2 mt-3" />}

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {searching ? (
          <SearchResults
            conversations={conversations}
            projects={projects}
            query={query}
            onQuery={setQuery}
            onClose={() => {
              setSearching(false);
              setQuery("");
            }}
            onNavigate={onNavigate}
          />
        ) : (
          <>
            <ProjectList projects={projects} conversations={conversations} onNavigate={onNavigate} onCreate={create} />
            <LooseConversations conversations={conversations} projects={projects} onNavigate={onNavigate} />
          </>
        )}
      </div>

      <UserMenu user={user} supportVisit={supportVisit} />
    </div>
  );
}

function PlaceLink({ place, active, onNavigate }: { place: NavLink; active: boolean; onNavigate?: () => void }) {
  const Icon = place.icon;
  return (
    <Link
      href={place.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(rowBase, rowFocus, active ? rowCurrent : rowIdle)}
    >
      <Icon aria-hidden weight={active ? "fill" : "duotone"} className={rowIcon} />
      {place.label}
    </Link>
  );
}

/** The newest leva with results, kept in view whatever conversation is open. */
export function NoticeLink({ notice, onNavigate, className }: { notice: SidebarNotice; onNavigate?: () => void; className?: string }) {
  return (
    <Link
      href={notice.href}
      onClick={onNavigate}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground transition-colors hover:bg-success/15",
        rowFocus,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
      <span className="min-w-0 flex-1 truncate">{notice.label}</span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ConversationRow({
  conversation,
  projects,
  nested = false,
  onNavigate,
}: {
  conversation: SidebarConversation;
  projects: SidebarProject[];
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = `/chat/${conversation.id}`;
  const active = pathname === href;
  return (
    <li className="group/row relative">
      <Link
        href={href}
        onClick={onNavigate}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(conversationMime, conversation.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        aria-current={active ? "page" : undefined}
        // Links are not draggable app-wide (globals.css); conversation rows are, to drop them on a project.
        className={cn(rowBase, rowFocus, "pr-9 [-webkit-user-drag:element]", nested && "pl-9", active ? rowCurrent : rowIdle)}
      >
        <span className="truncate">{conversation.title}</span>
      </Link>
      <ConversationActions
        conversation={conversation}
        projects={projects}
        className={cn(rowActions, !active && "opacity-0")}
      />
    </li>
  );
}

/** Drop target for a dragged conversation: a project, or null for "Conversas". */
function useConversationDrop(projectId: string | null) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver(event: React.DragEvent) {
        if (!event.dataTransfer.types.includes(conversationMime)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave() {
        setOver(false);
      },
      async onDrop(event: React.DragEvent) {
        setOver(false);
        const conversationId = event.dataTransfer.getData(conversationMime);
        if (conversationId === "") return;
        event.preventDefault();
        try {
          await moveConversation(conversationId, projectId);
          router.refresh();
        } catch (error) {
          toastError(error, "Não foi possível mover a conversa. Tente novamente.");
        }
      },
    },
  };
}

function ProjectList({
  projects,
  conversations,
  onNavigate,
  onCreate,
}: {
  projects: SidebarProject[];
  conversations: SidebarConversation[];
  onNavigate?: () => void;
  onCreate: (projectId: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createProject(name: string) {
    await api("/api/projects", z.object({ id: z.uuid() }), { name });
    toast.success(`Projeto ${name} criado.`);
    router.refresh();
  }

  return (
    <section aria-label="Projetos">
      <div className={sectionHeading}>
        <h2>Projetos</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Novo projeto"
          className="-my-1 size-7 rounded-md text-muted-foreground hover:text-foreground pointer-coarse:size-9"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="px-2.5 py-1 text-xs text-muted-foreground">Crie um projeto para juntar conversas do mesmo assunto.</p>
      ) : (
        <ul className="space-y-px">
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              projects={projects}
              conversations={conversations.filter((conversation) => conversation.projectId === project.id)}
              onNavigate={onNavigate}
              onCreate={onCreate}
            />
          ))}
        </ul>
      )}
      <RenameDialog
        key={creating ? "open" : "closed"}
        open={creating}
        onOpenChange={setCreating}
        title="Novo projeto"
        label="Nome do projeto"
        value=""
        maxLength={projectNameMaxLength}
        failure="Não foi possível criar o projeto. Tente novamente."
        onSave={createProject}
      />
    </section>
  );
}

function ProjectItem({
  project,
  projects,
  conversations,
  onNavigate,
  onCreate,
}: {
  project: SidebarProject;
  projects: SidebarProject[];
  conversations: SidebarConversation[];
  onNavigate?: () => void;
  onCreate: (projectId: string | null) => Promise<void>;
}) {
  const pathname = usePathname();
  const holdsCurrent = conversations.some((conversation) => pathname === `/chat/${conversation.id}`);
  const [open, setOpen] = useState(true);
  const drop = useConversationDrop(project.id);
  const listId = useId();
  const Caret = open ? ChevronDown : ChevronRightIcon;
  const Icon = open ? FolderOpen : Folder;

  return (
    <li {...drop.handlers}>
      {/* The row is its own positioning box, so the menu button stays beside the name, not over the list. */}
      <div className="group/row relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className={cn(rowBase, rowFocus, "pr-9", drop.over ? "bg-accent ring-1 ring-ring" : rowIdle, holdsCurrent && !open && "font-medium")}
        >
          <Icon aria-hidden className={rowIcon} />
          <span className="truncate">{project.name}</span>
          <Caret aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        </button>
        <ProjectActions project={project} conversationCount={conversations.length} onCreate={onCreate} className={cn(rowActions, "opacity-0")} />
      </div>
      {open && (
        <ul id={listId} className="space-y-px">
          {conversations.length === 0 ? (
            <li className="py-1 pr-2.5 pl-9 text-xs text-muted-foreground">Arraste conversas para cá ou use o menu de uma conversa.</li>
          ) : (
            conversations.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} projects={projects} nested onNavigate={onNavigate} />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function ProjectActions({
  project,
  conversationCount,
  onCreate,
  className,
}: {
  project: SidebarProject;
  conversationCount: number;
  onCreate: (projectId: string | null) => Promise<void>;
  className?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "delete">();
  const url = `/api/projects/${project.id}`;

  async function rename(name: string) {
    await api(url, savedSchema, { name }, "PATCH");
    router.refresh();
  }

  async function remove() {
    await api(url, z.object({ deleted: z.boolean() }), undefined, "DELETE");
    toast.success(`Projeto ${project.name} apagado. As conversas continuam em Conversas.`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações do projeto ${project.name}`} className={className} />}
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void onCreate(project.id)}>
            <SquarePen aria-hidden />
            Nova conversa no projeto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("rename")}>
            <Pencil aria-hidden />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2 aria-hidden />
            Apagar projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        open={dialog === "rename"}
        onOpenChange={(open) => setDialog(open ? "rename" : undefined)}
        title="Renomear projeto"
        label="Nome do projeto"
        value={project.name}
        maxLength={projectNameMaxLength}
        onSave={rename}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : undefined)}
        title={`Apagar o projeto ${project.name}?`}
        description={
          conversationCount === 0
            ? "O projeto está vazio."
            : "Só o projeto é apagado. As conversas dele voltam para Conversas, com todas as mensagens."
        }
        confirmLabel="Apagar projeto"
        icon={Trash2}
        destructive
        onConfirm={remove}
      />
    </>
  );
}

function LooseConversations({
  conversations,
  projects,
  onNavigate,
}: {
  conversations: SidebarConversation[];
  projects: SidebarProject[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const drop = useConversationDrop(null);
  const loose = conversations.filter((conversation) => conversation.projectId == null);
  return (
    <section aria-label="Conversas" {...drop.handlers} className={cn("rounded-lg", drop.over && "bg-accent/50 ring-1 ring-ring")}>
      <h2 className={sectionHeading}>
        Conversas
      </h2>
      {loose.length === 0 ? (
        <p className="px-2.5 py-1 text-xs text-muted-foreground">Suas conversas aparecem aqui.</p>
      ) : (
        <ul className="space-y-px">
          {loose.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} projects={projects} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
      <Link
        href={archivedHref}
        onClick={onNavigate}
        aria-current={pathname === archivedHref ? "page" : undefined}
        className={cn(rowBase, rowFocus, "mt-2 text-muted-foreground", pathname === archivedHref ? rowCurrent : rowIdle)}
      >
        <Archive aria-hidden className={rowIcon} />
        Arquivadas
      </Link>
    </section>
  );
}

function SearchResults({
  conversations,
  projects,
  query,
  onQuery,
  onClose,
  onNavigate,
}: {
  conversations: SidebarConversation[];
  projects: SidebarProject[];
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (canAutofocus()) input.current?.focus();
  }, []);
  const matches = useMemo(() => {
    const term = fold(query.trim());
    if (term === "") return conversations;
    return conversations.filter((conversation) => fold(conversation.title).includes(term));
  }, [conversations, query]);

  return (
    <div role="search" className="pt-3">
      <label htmlFor={`${id}-search`} className="sr-only">
        Buscar conversas
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={input}
          id={`${id}-search`}
          type="search"
          enterKeyHint="search"
          value={query}
          placeholder="Buscar pelo nome"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            // Esc clears first; with an empty field it closes the search.
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (query !== "") return onQuery("");
            onClose();
          }}
          className="h-9 rounded-lg border-border bg-transparent pr-3 pl-9 text-base shadow-none md:text-sm dark:bg-transparent pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      {matches.length === 0 ? (
        <p role="status" className="px-2.5 pt-4 text-sm text-muted-foreground">
          Nenhuma conversa encontrada
        </p>
      ) : (
        <ul aria-label="Resultados da busca" className="mt-2 space-y-px">
          {matches.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} projects={projects} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </div>
  );
}

const menuLink =
  "flex h-8 items-center gap-2 rounded-md px-2.5 text-sm outline-hidden select-none pointer-coarse:h-10 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Only what belongs to the account; the areas of the app live in the bar above it. */
function UserMenu({ user, supportVisit }: { user: SidebarUser; supportVisit: boolean }) {
  const router = useRouter();
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  async function logout() {
    try {
      // Inside a client's account, signing out ends the visit and goes back to the panel.
      if (supportVisit) {
        await api("/api/support-visit", z.object({ left: z.boolean() }), {}, "DELETE");
        router.replace("/admin?aba=contas");
        router.refresh();
        return;
      }
      const result = await authClient.signOut();
      if (result.error) throw new Error("sign-out refused");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    }
  }

  return (
    <div className="shrink-0 border-t border-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Conta de ${user.name}`}
              className={cn(rowBase, rowFocus, rowIdle, "h-11 pointer-coarse:h-12")}
            />
          }
        >
          <Avatar aria-hidden className="size-7">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initial}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">{user.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-64 p-1">
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          </div>
          <DropdownMenuSeparator />
          <MenuPrimitive.LinkItem closeOnClick render={<Link href="/perfil" />} className={menuLink}>
            <UserRound aria-hidden />
            Perfil
          </MenuPrimitive.LinkItem>
          <DropdownMenuSeparator />
          <ThemeMenuGroup />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="h-8 gap-2 px-2.5 pointer-coarse:h-10 [&_svg]:text-muted-foreground">
            <LogOut aria-hidden />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
