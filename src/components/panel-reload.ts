"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { chatKey, panelKey, panelReloadAttribute, reopenKey } from "@/components/panel-reload-script";

// A reload keeps the address of an open panel (/levas) but not the conversation behind it,
// so the panel came back as a page of its own and the conversation was lost. Each tab
// remembers both, and a reload of an open panel reopens it over the same conversation.

/** Session storage of this tab, or null where the browser blocks it (the reload then shows the page alone). */
function tabStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function currentUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

function wasReloaded() {
  const [entry] = performance.getEntriesByType("navigation");
  return entry instanceof PerformanceNavigationTiming && entry.type === "reload";
}

/** Called by an open panel so a reload knows to bring it back over the conversation. */
export function rememberOpenPanel() {
  tabStorage()?.setItem(panelKey, currentUrl());
}

/** Shows the page the inline panel reload script hid. */
function showPage() {
  document.documentElement.removeAttribute(panelReloadAttribute);
}

/** Called when the person closes the panel: a later reload shows the conversation alone. */
export function forgetOpenPanel() {
  tabStorage()?.removeItem(panelKey);
}

/**
 * Keeps a reloaded panel over its conversation: first back to the conversation that was
 * behind it, then the panel opens again over it, as an intercepted route.
 */
export function usePanelReload(conversationId: string | undefined) {
  const router = useRouter();
  const panelOpen = useSelectedLayoutSegment("panel")?.startsWith("(.)") === true;

  // Only the first render of a reloaded page decides; later navigations are the person's.
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    const storage = tabStorage();
    const url = currentUrl();
    const chatId = storage?.getItem(chatKey);
    if (
      storage == null ||
      conversationId != null ||
      panelOpen ||
      wasReloaded() === false ||
      chatId == null ||
      storage.getItem(panelKey) !== url
    ) {
      showPage();
      return;
    }
    storage.setItem(reopenKey, url);
    router.replace(`/chat/${chatId}`);
  }, [conversationId, panelOpen, router]);

  // The page stays hidden until the panel is back over the conversation.
  useEffect(() => {
    if (panelOpen) showPage();
  }, [panelOpen]);

  useEffect(() => {
    const storage = tabStorage();
    if (storage == null || conversationId == null || panelOpen) return;
    storage.setItem(chatKey, conversationId);
    const reopen = storage.getItem(reopenKey);
    storage.removeItem(reopenKey);
    if (reopen == null) {
      forgetOpenPanel();
      return;
    }
    router.push(reopen);
  }, [conversationId, panelOpen, router]);
}
