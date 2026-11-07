// The only place that registers or removes the app service worker (/sw.js).
// It never registers in development, inside an iframe or on Lovable preview hosts, where a
// cached copy would hide fresh edits; `?sw=off` removes it on demand.

export type SwContext = {
  prod: boolean;
  hostname: string;
  search: string;
  inIframe: boolean;
};

const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const PREVIEW_ROOTS = ["lovable.app", "gpt-eng.com", "gptengineer.run"];
const EDITOR_ROOTS = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

function isPreviewHost(raw: string): boolean {
  const host = raw.toLowerCase();
  if (EDITOR_ROOTS.some((root) => host === root || host.endsWith(`.${root}`))) return true;
  const root = PREVIEW_ROOTS.find((r) => host.endsWith(`.${r}`));
  if (!root) return false;
  const label = host.slice(0, -(root.length + 1)).split(".")[0] ?? "";
  return PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label);
}

export function canRegisterServiceWorker(ctx: SwContext): boolean {
  if (!ctx.prod || ctx.inIframe) return false;
  if (new URLSearchParams(ctx.search).get("sw") === "off") return false;
  return !isPreviewHost(ctx.hostname);
}

async function removeAppWorker(): Promise<void> {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = (r.active ?? r.waiting ?? r.installing)?.scriptURL ?? "";
        return url === "" || new URL(url).pathname === "/sw.js";
      })
      .map((r) => r.unregister()),
  );
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("questionar-")).map((k) => caches.delete(k)));
  }
}

export function setupServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  const ok = canRegisterServiceWorker({
    prod: import.meta.env.PROD,
    hostname: window.location.hostname,
    search: window.location.search,
    inIframe,
  });
  if (ok) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return;
  }
  removeAppWorker().catch(() => undefined);
}
