// QR invite: opening /rubrica?handle=... sends a connection request to that handle.
// The invite is kept in localStorage until it is queued by the relay, cancelled or
// found definitively invalid, so it survives onboarding, reloads and network drops.

import { isValidHandle } from "./handle";
import type { Contact, ConnectionRequest } from "./types";

export const INVITE_KEY = "questionar.pendingInvite";

export type PendingInvite = { handle: string; savedAt: number; attempted?: boolean };
type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStorage = (): KV | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function loadInvite(storage = defaultStorage()): PendingInvite | null {
  try {
    const raw = storage?.getItem(INVITE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingInvite;
    return typeof p?.handle === "string" ? p : null;
  } catch {
    return null;
  }
}

export function saveInvite(p: PendingInvite, storage = defaultStorage()) {
  try {
    storage?.setItem(INVITE_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked: the invite simply is not persisted */
  }
}

export function clearInvite(handle?: string, storage = defaultStorage()) {
  const p = loadInvite(storage);
  if (!p || (handle && p.handle !== handle)) return;
  try {
    storage?.removeItem(INVITE_KEY);
  } catch {
    /* ignore */
  }
}

/** Saves the handle of a QR link (`/rubrica?handle=...`). Same handle keeps its progress. */
export function captureInvite(
  loc: { pathname: string; search: string },
  storage = defaultStorage(),
): string | null {
  if (loc.pathname.replace(/\/+$/, "") !== "/rubrica") return null;
  const handle = new URLSearchParams(loc.search).get("handle")?.trim();
  if (!handle) return null;
  if (loadInvite(storage)?.handle !== handle) saveInvite({ handle, savedAt: Date.now() }, storage);
  return handle;
}

export type InviteClass = "invalid" | "self" | "contact" | "incoming" | "outgoing" | "send";

export function classifyInvite(
  handle: string,
  ctx: { myHandle: string; contacts: Contact[]; requests: ConnectionRequest[] },
): InviteClass {
  if (!isValidHandle(handle)) return "invalid";
  if (handle === ctx.myHandle) return "self";
  if (ctx.contacts.some((c) => c.handle === handle)) return "contact";
  const req = ctx.requests.find((r) => r.handle === handle);
  if (req) return req.direction === "incoming" ? "incoming" : "outgoing";
  return "send";
}

export type InviteDeps = {
  myHandle: string;
  contacts: () => Contact[];
  requests: () => ConnectionRequest[];
  /** New request (adds the outgoing request, true only when the relay accepted it). */
  send: (handle: string) => Promise<"sent" | "offline" | "failed">;
  /** Re-sends the request message for an outgoing request that already exists. */
  resend: (handle: string) => Promise<boolean>;
  notify: (kind: "info" | "success" | "error", text: string, id: string) => void;
  storage?: KV | null;
};

export type InviteResult = "none" | "sent" | "pending" | "dropped";

let inflight: Promise<InviteResult> | null = null;

/** Handles the pending invite once; concurrent calls share the same run (Strict Mode, rerenders). */
export function processInvite(deps: InviteDeps): Promise<InviteResult> {
  if (!inflight) inflight = run(deps).finally(() => (inflight = null));
  return inflight;
}

async function run(d: InviteDeps): Promise<InviteResult> {
  const storage = d.storage === undefined ? defaultStorage() : d.storage;
  const p = loadInvite(storage);
  if (!p || !d.myHandle) return "none";
  const h = p.handle;
  const drop = (kind: "info" | "error", text: string): InviteResult => {
    clearInvite(h, storage);
    d.notify(kind, text, `invite-${h}`);
    return "dropped";
  };
  const done = (): InviteResult => {
    clearInvite(h, storage);
    d.notify("success", `Richiesta inviata a @${h}`, `sent-${h}`);
    return "sent";
  };
  const wait = (): InviteResult => {
    d.notify("info", `Invito per @${h} in attesa: riprovo appena la rete torna`, "invite-wait");
    return "pending";
  };

  switch (
    classifyInvite(h, { myHandle: d.myHandle, contacts: d.contacts(), requests: d.requests() })
  ) {
    case "invalid":
      return drop("error", "Il link QR non contiene un handle valido");
    case "self":
      return drop("info", "Questo è il tuo QR");
    case "contact":
      return drop("info", `@${h} è già tra le tue connessioni`);
    case "incoming":
      return drop("info", `@${h} ti ha già inviato una richiesta: puoi accettarla qui sotto`);
    case "outgoing":
      // Not started by this invite: the request was already sent before.
      if (!p.attempted) return drop("info", `Richiesta a @${h} già inviata`);
      // Interrupted earlier (reload during send): re-sending is idempotent for the receiver.
      return (await d.resend(h)) ? done() : wait();
    case "send": {
      saveInvite({ ...p, attempted: true }, storage);
      const r = await d.send(h);
      return r === "sent" ? done() : wait();
    }
  }
}
