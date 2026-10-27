"use client";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Menu, PanelLeftOpen, SquarePen } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StrategistAvatar } from "@/components/chat/strategist";
import { Hint } from "@/components/hint";
import { ConversationActions } from "@/components/conversation-actions";
import {
  NoticeLink,
  SidebarBody,
  useNewConversation,
  type SidebarConversation,
  type SidebarNotice,
  type SidebarProject,
  type SidebarUser,
} from "@/components/sidebar";
import { cn } from "@/lib/utils";

const quietButton = "text-muted-foreground hover:bg-accent hover:text-foreground";
/** Matches Tailwind's lg: the bar stays open beside the conversation from here up. */
const wideScreen = "(min-width: 1024px)";
const collapsedKey = "criativos-sidebar-collapsed";
const collapsedEvent = "criativos-sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App frame: the left bar (areas, projects and conversations) beside one conversation
 * surface. Areas open as panels over the conversation. On phones the bar opens from ☰;
 * Ctrl/⌘ + K opens the search. Chat routes get an unpadded flex column; direct visits to
 * other pages get a padded column.
 */
export function AppShell({
  children,
  panel,
  user,
  conversations,
  projects,
  notice,
  banner,
  showAdminLink,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  user: SidebarUser;
  conversations: SidebarConversation[];
  projects: SidebarProject[];
  /** The newest leva with results, kept in view in every conversation. */
  notice: SidebarNotice | null;
  /** Notice above everything, such as the support visit. */
  banner?: React.ReactNode;
  /** Team members outside a support visit get a shortcut to the panel. */
  showAdminLink: boolean;
}) {
  const pathname = usePathname();
  const chat = useChatBehindPanel(isActive(pathname, "/chat"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchRequest, setSearchRequest] = useState(0);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const conversationId = /^\/chat\/([^/]+)/.exec(pathname)?.[1];
  const current = conversations.find((conversation) => conversation.id === conversationId);

  useEffect(() => {
    // Ctrl/⌘ + K opens the conversation search from anywhere.
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setSearchRequest((request) => request + 1);
      if (window.matchMedia(wideScreen).matches) return saveCollapsed(false);
      setDrawerOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = {
    user,
    conversations,
    projects,
    notice,
    showAdminLink,
    supportVisit: Boolean(banner),
    searchRequest,
  };

  return (
    <div
      data-slot="app-shell"
      data-chat={chat ? "" : undefined}
      className={cn(
        "flex flex-col bg-background print:block print:h-auto print:overflow-visible",
        chat ? "h-dvh overflow-hidden" : "min-h-svh",
      )}
    >
      {banner}
      <div className="flex min-h-0 flex-1 print:block">
        {!collapsed && (
          <aside
            aria-label="Barra lateral"
            data-print="hide"
            className={cn(
              "hidden w-72 shrink-0 border-r border-border bg-muted/40 pt-[env(safe-area-inset-top)] lg:flex",
              chat ? "h-full" : "sticky top-0 h-dvh self-start",
            )}
          >
            <SidebarBody {...sidebar} onCollapse={() => saveCollapsed(true)} />
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col print:block">
          <header
            data-print="hide"
            className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 bg-background/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-4"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir a barra lateral"
              className={cn(quietButton, "lg:hidden")}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden className="size-5" />
            </Button>
            {collapsed && (
              <Hint label="Abrir a barra lateral">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir a barra lateral"
                  className={cn(quietButton, "hidden lg:inline-flex")}
                  onClick={() => saveCollapsed(false)}
                >
                  <PanelLeftOpen aria-hidden className="size-5" />
                </Button>
              </Hint>
            )}
            {!(chat && current) && (
              <Link href="/chat" aria-label="Criativos Virais — início" className="inline-flex shrink-0 rounded-md px-1 lg:hidden">
                <StrategistAvatar className="size-7" />
              </Link>
            )}
            <p className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">{chat && current ? current.title : ""}</p>
            {chat && current && <ConversationActions conversation={current} projects={projects} className={quietButton} />}
            <NewConversationButton className="lg:hidden" />
          </header>
          {notice && <NoticeLink notice={notice} className="mx-3 mb-2 lg:hidden" />}

          <div className={cn("flex min-h-0 flex-1 flex-col print:block print:overflow-visible", !chat && "overflow-y-auto")}>
            <main
              id="main-content"
              tabIndex={-1}
              className={cn(
                "w-full min-w-0 outline-none",
                chat
                  ? "flex min-h-0 flex-1 flex-col"
                  : "mx-auto max-w-(--content-width) px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8",
              )}
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(18rem,88vw)] gap-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] data-[side=left]:sm:max-w-[18rem]"
        >
          <SheetTitle className="sr-only">Barra lateral</SheetTitle>
          <SidebarBody {...sidebar} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
      {panel}
    </div>
  );
}

/** Whether this browser keeps the bar hidden on wide screens; a per-viewer convenience. */
function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === "1";
  } catch {
    // Blocked storage (private windows, strict settings) keeps the bar open.
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(collapsedKey, collapsed ? "1" : "0");
  } catch {
    // Without storage the choice lasts until the page reloads.
  }
  window.dispatchEvent(new Event(collapsedEvent));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(collapsedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(collapsedEvent, onChange);
  };
}

/**
 * A panel changes the address (/levas, /criativos…) while the conversation stays behind it,
 * so the page keeps the layout it had before the panel opened instead of following the address.
 */
function useChatBehindPanel(onChatRoute: boolean) {
  const panelSegment = useSelectedLayoutSegment("panel");
  const panelOpen = panelSegment?.startsWith("(.)") === true;
  const [chatBehind, setChatBehind] = useState(onChatRoute);
  if (!panelOpen && chatBehind !== onChatRoute) setChatBehind(onChatRoute);
  if (panelOpen) return chatBehind;
  return onChatRoute;
}

/** Phones keep a one-tap new conversation in the top bar; wide screens have it in the bar. */
function NewConversationButton({ className }: { className?: string }) {
  const { create, pending } = useNewConversation();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => void create()}
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "Criando conversa" : "Nova conversa"}
      className={cn(quietButton, className)}
    >
      <SquarePen aria-hidden className="size-5" />
    </Button>
  );
}
