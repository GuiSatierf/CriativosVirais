// Shared by the inline script, which runs before the first paint, and by usePanelReload.
export const chatKey = "criativos:chat-behind-panel";
export const panelKey = "criativos:open-panel";
export const reopenKey = "criativos:reopen-panel";
/** Set on <html> while a reloaded panel goes back over its conversation; globals.css hides the page. */
export const panelReloadAttribute = "data-panel-reload";
// If the panel never opens again (a failed navigation), the page shows after this anyway.
const hiddenAtMostInMs = 4_000;

/**
 * Hides the page of a reloaded panel before the browser paints it, so the panel does not flash
 * as a full page before it reopens over the conversation. Mirrors the checks in usePanelReload.
 */
export const panelReloadScript = `try {
  var storage = sessionStorage;
  var navigation = performance.getEntriesByType("navigation")[0];
  var url = location.pathname + location.search;
  if (
    navigation && navigation.type === "reload" &&
    location.pathname.indexOf("/chat") !== 0 &&
    storage.getItem(${JSON.stringify(chatKey)}) != null &&
    storage.getItem(${JSON.stringify(panelKey)}) === url
  ) {
    var root = document.documentElement;
    root.setAttribute(${JSON.stringify(panelReloadAttribute)}, "");
    setTimeout(function () { root.removeAttribute(${JSON.stringify(panelReloadAttribute)}); }, ${hiddenAtMostInMs});
  }
} catch (error) {
  // Blocked storage: the reload shows the panel as a page of its own, as without this script.
}`;
