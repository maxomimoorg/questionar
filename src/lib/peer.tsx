import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { P2P, Envelope, NetMode } from "./p2p";
import { generateKeyPair } from "./keys";
import { RELAY_URL } from "./transport";
import { useStore } from "./store";
import { emojisFromHandle } from "./handle";
import { handleOf, type ProfileSnapshot } from "./types";

type PeerCtx = {
  connected: boolean;
  /** Which network carries presence/rendezvous right now. */
  mode: NetMode;
  relayConfigured: boolean;
  mqttFallback: boolean;
  setMqttFallback: (on: boolean) => void;
  sendRequest: (handle: string) => Promise<void>;
  accept: (handle: string) => Promise<void>;
  reject: (handle: string) => Promise<void>;
  cancel: (handle: string) => Promise<void>;
  linkFromBackup: (handle: string, name: string, snapshot: ProfileSnapshot) => Promise<void>;
};

const Ctx = createContext<PeerCtx | null>(null);

export function PeerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { state } = store;
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<NetMode>("offline");
  const peerRef = useRef<P2P | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  // Keys learned before the handle is saved as a request/contact.
  const keyCache = useRef(new Map<string, JsonWebKey>());

  const myHandle = handleOf(state.identity);
  const mqttFallback = state.network.mqttFallback;
  const hasKeys = Boolean(state.identity?.keys);

  // Older profiles may have no key pair yet: create one once.
  useEffect(() => {
    if (!state.identity || state.identity.keys) return;
    void generateKeyPair().then((keys) => {
      const id = storeRef.current.state.identity;
      if (keys && id) storeRef.current.patch({ identity: { ...id, keys } });
    });
  }, [state.identity]);

  useEffect(() => {
    const keys = storeRef.current.state.identity?.keys;
    if (!myHandle || !keys || typeof window === "undefined") return;
    let disposed = false;
    let live: P2P | null = null;

    const peerKey = (handle: string) => {
      const s = storeRef.current.state;
      return (
        s.contacts.find((c) => c.handle === handle)?.publicKey ??
        s.requests.find((r) => r.handle === handle)?.publicKey ??
        keyCache.current.get(handle)
      );
    };

    void (async () => {
      const { P2P: Impl } = await import("./p2p");
      if (disposed) return;
      const me = () => ({ from: myHandle, name: storeRef.current.state.identity?.name ?? "" });
      const p2p = new Impl(
        myHandle,
        keys,
        {
          onStatus: (c, m) => {
            setConnected(c);
            setMode(m);
          },
          getPeerKey: peerKey,
          setPeerKey: (handle, key) => {
            keyCache.current.set(handle, key);
            const s = storeRef.current;
            if (s.state.contacts.some((c) => c.handle === handle))
              s.updateContact(handle, { publicKey: key });
            if (s.state.requests.some((r) => r.handle === handle))
              s.updateRequest(handle, { publicKey: key });
          },
          onKeyMismatch: (handle) =>
            toast.error(`La chiave di ${handle} è cambiata: messaggio ignorato`, {
              id: `key-${handle}`,
            }),
          onPresence: (handle, online) => {
            const s = storeRef.current;
            s.updateContact(handle, { online });
            const contact = s.state.contacts.find((c) => c.handle === handle);
            if (!online || !contact) return;
            if (!contact.roomKey) {
              // link created from a backup: ask for the real handshake now
              void p2p.send(handle, { type: "request", ...me() });
            } else if (!peerKey(handle)) {
              void p2p.send(handle, { type: "keyx", from: myHandle });
            } else {
              void p2p.upgrade(handle);
              void p2p.send(handle, { type: "profile", ...me(), snapshot: s.mySnapshot() });
            }
          },
          onMessage: (msg: Envelope) => {
            const s = storeRef.current;
            const key = keyCache.current.get(msg.from);
            if (msg.type === "request") {
              s.addRequest({
                handle: msg.from,
                name: msg.name,
                direction: "incoming",
                emojis: emojisFromHandle(msg.from),
                createdAt: Date.now(),
                ...(key ? { publicKey: key } : {}),
              });
              // Give the requester our key so it can send its profile encrypted.
              void p2p.send(msg.from, { type: "keyx", from: myHandle });
              toast.info(`Nuova richiesta di connessione da ${msg.name}`, { id: `req-${msg.from}` });
            } else if (msg.type === "keyx") {
              const out = s.state.requests.find(
                (r) => r.handle === msg.from && r.direction === "outgoing",
              );
              if (out) void p2p.send(msg.from, { type: "preview", ...me(), snapshot: s.mySnapshot() });
              else if (s.state.contacts.some((c) => c.handle === msg.from))
                void p2p.send(msg.from, { type: "profile", ...me(), snapshot: s.mySnapshot() });
            } else if (msg.type === "preview") {
              if (s.state.requests.some((r) => r.handle === msg.from && r.direction === "incoming"))
                s.updateRequest(msg.from, { name: msg.name, snapshot: msg.snapshot });
            } else if (msg.type === "accept") {
              s.removeRequest(msg.from);
              s.upsertContact({
                handle: msg.from,
                name: msg.name,
                emojis: emojisFromHandle(msg.from),
                snapshot: msg.snapshot,
                roomKey: msg.from,
                online: true,
                ...(key ? { publicKey: key } : {}),
              });
              toast.success(`${msg.name} ha accettato la connessione`, { id: `acc-${msg.from}` });
            } else if (msg.type === "reject" || msg.type === "cancel") {
              s.removeRequest(msg.from);
            } else if (msg.type === "profile") {
              s.updateContact(msg.from, { name: msg.name, snapshot: msg.snapshot, online: true });
            }
          },
        },
        mqttFallback,
      );
      peerRef.current = p2p;
      live = p2p;
      const st = storeRef.current.state;
      void p2p.start([
        ...st.contacts.map((c) => c.handle),
        ...st.requests.filter((r) => r.direction === "outgoing").map((r) => r.handle),
      ]);
    })();

    const retry = () => void live?.start(storeRef.current.state.contacts.map((c) => c.handle));
    window.addEventListener("online", retry);
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      live?.stop();
      peerRef.current = null;
    };
    // Re-create only when the identity, its keys or the fallback choice change.
  }, [myHandle, hasKeys, mqttFallback]);

  const value = useMemo<PeerCtx>(
    () => ({
      connected,
      mode,
      relayConfigured: Boolean(RELAY_URL),
      mqttFallback,
      setMqttFallback: (on) => storeRef.current.patch({ network: { mqttFallback: on } }),
      sendRequest: async (handle) => {
        const p2p = peerRef.current;
        const s = storeRef.current;
        if (!p2p || p2p.getMode() === "offline") {
          toast.error("Rete non disponibile: usa il backup PNG oppure attiva il ripiego MQTT", {
            id: "net-offline",
          });
          return;
        }
        await p2p.track(handle);
        // Saved first so the reply with the peer's key can trigger the encrypted preview.
        s.addRequest({
          handle,
          name: handle.replace(/[^a-z0-9]/gi, ""),
          direction: "outgoing",
          emojis: emojisFromHandle(handle),
          createdAt: Date.now(),
        });
        const ok = await p2p.sendWithRetry(handle, {
          type: "request",
          from: myHandle,
          name: s.state.identity?.name ?? "",
        });
        if (!ok) {
          storeRef.current.removeRequest(handle);
          toast.error("Rete non raggiungibile, riprova tra poco", { id: "net-unreachable" });
          return;
        }
        toast.success("Richiesta inviata", { id: `sent-${handle}` });
      },
      accept: async (handle) => {
        const s = storeRef.current;
        s.acceptRequest(handle);
        await peerRef.current?.send(handle, {
          type: "accept",
          from: myHandle,
          name: s.state.identity?.name ?? "",
          snapshot: s.mySnapshot(),
        });
        void peerRef.current?.upgrade(handle);
      },
      reject: async (handle) => {
        storeRef.current.removeRequest(handle);
        await peerRef.current?.send(handle, { type: "reject", from: myHandle });
      },
      cancel: async (handle) => {
        storeRef.current.removeRequest(handle);
        await peerRef.current?.send(handle, { type: "cancel", from: myHandle });
      },
      linkFromBackup: async (handle, name, snapshot) => {
        const s = storeRef.current;
        s.upsertContact({
          handle,
          name,
          emojis: emojisFromHandle(handle),
          snapshot,
          online: false,
        });
        await peerRef.current?.track(handle);
      },
    }),
    [connected, mode, mqttFallback, myHandle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeer must be used inside PeerProvider");
  return ctx;
}
