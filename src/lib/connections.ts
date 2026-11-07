// Connection protocol (request -> keyx -> preview -> accept -> profile), independent of React
// so it can be tested with an in-memory store and network.

import { emojisFromHandle } from "./handle";
import type { Envelope, MessageMeta, P2P, P2PHandlers } from "./p2p";
import { sanitizeSnapshot, type Contact, type ConnectionRequest, type ProfileSnapshot } from "./types";

export type ConnStore = {
  contacts: () => Contact[];
  requests: () => ConnectionRequest[];
  myName: () => string;
  mySnapshot: () => ProfileSnapshot;
  addRequest: (r: ConnectionRequest) => void;
  updateRequest: (handle: string, p: Partial<ConnectionRequest>) => void;
  removeRequest: (handle: string) => void;
  acceptRequest: (handle: string) => void;
  upsertContact: (c: Contact) => void;
  updateContact: (handle: string, p: Partial<Contact>) => void;
};

export type Notify = (kind: "info" | "success" | "error", text: string, id: string) => void;

/** Placeholder name until the encrypted preview arrives (the clear request carries no name). */
export const nameFromHandle = (handle: string) => handle.replace(/[^\p{L}\p{N}]/gu, "") || handle;

export class Connections {
  /** Keys seen before the handle is saved as a request/contact (never "verified"). */
  readonly keyCache = new Map<string, JsonWebKey>();
  private p2p: P2P | null = null;

  constructor(
    private me: string,
    private store: ConnStore,
    private notify: Notify,
    private hooks: {
      onStatus?: P2PHandlers["onStatus"];
      onTunnel?: P2PHandlers["onTunnel"];
    } = {},
  ) {}

  attach(p2p: P2P) {
    this.p2p = p2p;
  }

  private contact(h: string) {
    return this.store.contacts().find((c) => c.handle === h);
  }
  private request(h: string, dir?: ConnectionRequest["direction"]) {
    return this.store.requests().find((r) => r.handle === h && (!dir || r.direction === dir));
  }

  peerKey = (handle: string): JsonWebKey | undefined =>
    this.contact(handle)?.publicKey ?? this.request(handle)?.publicKey ?? this.keyCache.get(handle);

  private profile(): Omit<Extract<Envelope, { type: "profile" }>, "type"> {
    return { from: this.me, name: this.store.myName(), snapshot: sanitizeSnapshot(this.store.mySnapshot()) };
  }

  private send(h: string, msg: Envelope) {
    return this.p2p ? this.p2p.send(h, msg) : Promise.resolve(false);
  }

  readonly handlers: P2PHandlers = {
    onStatus: (c, m, i) => this.hooks.onStatus?.(c, m, i),
    onTunnel: (h, open) => this.hooks.onTunnel?.(h, open),
    getPeerKey: (h) => this.peerKey(h),
    rememberKey: (h, key) => {
      this.keyCache.set(h, key);
      // Persisted as NOT verified: the user can compare fingerprints later.
      const c = this.contact(h);
      if (c && !c.publicKey) this.store.updateContact(h, { publicKey: key, keyVerified: false });
      const r = this.request(h);
      if (r && !r.publicKey) this.store.updateRequest(h, { publicKey: key, keyVerified: false });
    },
    onKeyMismatch: (h) =>
      this.notify(
        "error",
        `La chiave di @${h} non corrisponde a quella salvata: messaggio ignorato e profilo non aggiornato.`,
        `key-${h}`,
      ),
    onUndecryptable: (h) =>
      this.notify(
        "error",
        `Messaggio di @${h} illeggibile (non decifrabile): profilo non aggiornato.`,
        `dec-${h}`,
      ),
    onPresence: (h, online) => {
      const contact = this.contact(h);
      if (!contact) return;
      this.store.updateContact(h, { online });
      if (!online || !this.p2p) return;
      if (!contact.roomKey) {
        // Link created from a backup: ask for the real handshake now.
        void this.send(h, { type: "request", from: this.me });
      } else if (!this.peerKey(h)) {
        void this.send(h, { type: "keyx", from: this.me });
      } else {
        void this.p2p.upgrade(h);
        void this.send(h, { type: "profile", ...this.profile() });
      }
    },
    onMessage: (msg, meta) => this.onMessage(msg, meta),
  };

  private async onMessage(msg: Envelope, meta: MessageMeta) {
    const from = msg.from;
    const s = this.store;
    switch (msg.type) {
      case "request": {
        if (this.contact(from) || this.request(from, "outgoing")) {
          // Already linked (backup, re-add) or both asked each other: accept right away.
          if (this.request(from, "outgoing")) s.acceptRequest(from);
          if (!this.peerKey(from)) this.keyCache.set(from, meta.pub);
          s.updateContact(from, { roomKey: from });
          await this.p2p?.track(from);
          await this.send(from, { type: "accept", ...this.profile() });
          return;
        }
        if (!this.request(from, "incoming")) {
          s.addRequest({
            handle: from,
            name: nameFromHandle(from),
            direction: "incoming",
            emojis: emojisFromHandle(from),
            createdAt: Date.now(),
            publicKey: meta.pub,
            keyVerified: false,
          });
          await this.p2p?.track(from);
          this.notify("info", `Nuova richiesta di connessione da @${from}`, `req-${from}`);
        }
        // Give the requester our key so it can send its profile encrypted.
        await this.send(from, { type: "keyx", from: this.me });
        return;
      }
      case "keyx": {
        if (this.request(from, "outgoing"))
          await this.send(from, { type: "preview", ...this.profile() });
        else if (this.contact(from)) {
          s.updateContact(from, { roomKey: from });
          await this.send(from, { type: "profile", ...this.profile() });
        }
        return;
      }
      case "preview": {
        if (this.request(from, "incoming"))
          s.updateRequest(from, { name: msg.name, snapshot: sanitizeSnapshot(msg.snapshot) });
        return;
      }
      case "accept": {
        const out = this.request(from, "outgoing");
        const existing = this.contact(from);
        if (!out && !existing) return; // cancelled meanwhile
        if (out) s.removeRequest(from);
        s.upsertContact({
          handle: from,
          name: msg.name,
          emojis: emojisFromHandle(from),
          snapshot: sanitizeSnapshot(msg.snapshot),
          roomKey: from,
          online: this.p2p?.isOnline(from) ?? false,
          publicKey: existing?.publicKey ?? out?.publicKey ?? meta.pub,
          keyVerified: Boolean(existing?.keyVerified ?? out?.keyVerified),
        });
        await this.p2p?.track(from);
        // Make sure the other side also has our profile (the preview may have been missed).
        await this.send(from, { type: "profile", ...this.profile() });
        if (out) this.notify("success", `${msg.name} ha accettato la connessione`, `acc-${from}`);
        return;
      }
      case "reject":
      case "cancel":
        if (this.request(from)) s.removeRequest(from);
        return;
      case "profile": {
        if (!this.contact(from)) return;
        s.updateContact(from, {
          name: msg.name,
          snapshot: sanitizeSnapshot(msg.snapshot),
          roomKey: from,
          ...(this.p2p?.isOnline(from) ? { online: true } : {}),
        });
        return;
      }
      default:
        return;
    }
  }

  // ---------- user actions ----------

  async sendRequest(handle: string): Promise<"sent" | "offline" | "failed"> {
    const p2p = this.p2p;
    if (!p2p || p2p.getMode() === "offline") return "offline";
    await p2p.track(handle);
    // Saved first so the reply with the peer's key can trigger the encrypted preview.
    this.store.addRequest({
      handle,
      name: nameFromHandle(handle),
      direction: "outgoing",
      emojis: emojisFromHandle(handle),
      createdAt: Date.now(),
    });
    const ok = await p2p.sendWithRetry(handle, { type: "request", from: this.me });
    if (!ok) {
      this.store.removeRequest(handle);
      return "failed";
    }
    return "sent";
  }

  async accept(handle: string) {
    if (!this.request(handle, "incoming")) return false;
    this.store.acceptRequest(handle);
    await this.p2p?.track(handle); // follow the requester's presence from now on
    const ok = await this.send(handle, { type: "accept", ...this.profile() });
    if (this.p2p?.isOnline(handle)) void this.p2p.upgrade(handle);
    return ok;
  }

  async reject(handle: string) {
    this.store.removeRequest(handle);
    return this.send(handle, { type: "reject", from: this.me });
  }

  async cancel(handle: string) {
    this.store.removeRequest(handle);
    return this.send(handle, { type: "cancel", from: this.me });
  }

  /** Backup PNG: the key inside it (newer backups) is the person's own, so it counts as verified. */
  async linkFromBackup(handle: string, name: string, snapshot: ProfileSnapshot, pub?: JsonWebKey) {
    const existing = this.contact(handle);
    const pinned = existing?.publicKey ?? this.request(handle)?.publicKey;
    if (pub && pinned && !sameKey(pub, pinned)) return "key_mismatch" as const;
    this.store.upsertContact({
      handle,
      name,
      emojis: emojisFromHandle(handle),
      snapshot: sanitizeSnapshot(snapshot),
      online: this.p2p?.isOnline(handle) ?? false,
      ...(pub ? { publicKey: pub, keyVerified: true } : {}),
    });
    await this.p2p?.track(handle);
    return "linked" as const;
  }
}

export function sameKey(a: JsonWebKey, b: JsonWebKey) {
  return a.x === b.x && a.y === b.y;
}
