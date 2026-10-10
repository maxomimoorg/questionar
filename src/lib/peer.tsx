import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { P2P, NetMode, NetIssue } from "./p2p";
import { Connections } from "./connections";
import { generateKeyPair } from "./keys";
import { RELAY_URL, relayWsUrl } from "./transport";
import { useStore } from "./store";
import { handleOf, type ProfileSnapshot } from "./types";

type PeerCtx = {
  connected: boolean;
  mode: NetMode;
  issue: NetIssue;
  relayConfigured: boolean;
  sendRequest: (handle: string) => Promise<void>;
  accept: (handle: string) => Promise<void>;
  reject: (handle: string) => Promise<void>;
  cancel: (handle: string) => Promise<void>;
  linkFromBackup: (
    handle: string,
    name: string,
    snapshot: ProfileSnapshot,
    pub?: JsonWebKey,
  ) => Promise<void>;
};

const Ctx = createContext<PeerCtx | null>(null);

export function PeerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { state } = store;
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<NetMode>("offline");
  const [issue, setIssue] = useState<NetIssue>(null);
  const peerRef = useRef<P2P | null>(null);
  const connRef = useRef<Connections | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const myHandle = handleOf(state.identity);
  const hasKeys = Boolean(state.identity?.keys);

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
    const s = () => storeRef.current;
    const conn = new Connections(
      myHandle,
      {
        contacts: () => s().state.contacts,
        requests: () => s().state.requests,
        myName: () => s().state.identity?.name ?? "",
        mySnapshot: () => s().mySnapshot(),
        addRequest: (r) => s().addRequest(r),
        updateRequest: (h, p) => s().updateRequest(h, p),
        removeRequest: (h) => s().removeRequest(h),
        acceptRequest: (h) => s().acceptRequest(h),
        upsertContact: (c) => s().upsertContact(c),
        updateContact: (h, p) => s().updateContact(h, p),
      },
      (kind, text, id) => toast[kind](text, { id }),
      {
        onStatus: (c, m, i) => {
          setConnected(c);
          setMode(m);
          setIssue(i);
        },
      },
    );
    connRef.current = conn;

    void (async () => {
      const { P2P: Impl } = await import("./p2p");
      if (disposed) return;
      const p2p = new Impl(myHandle, keys, conn.handlers, {});
      conn.attach(p2p);
      peerRef.current = p2p;
      live = p2p;
      const st = s().state;
      void p2p.start([...st.contacts.map((c) => c.handle), ...st.requests.map((r) => r.handle)]);
    })();

    const retry = () => live?.reconnect();
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
      connRef.current = null;
    };
  }, [myHandle, hasKeys]);

  const value = useMemo<PeerCtx>(
    () => ({
      connected,
      mode,
      issue,
      relayConfigured: Boolean(relayWsUrl(RELAY_URL)),
      sendRequest: async (handle) => {
        const r = (await connRef.current?.sendRequest(handle)) ?? "offline";
        if (r === "offline")
          toast.error("Rete non disponibile: puoi comunque usare il backup PNG", {
            id: "net-offline",
          });
        else if (r === "failed")
          toast.error("Rete non raggiungibile, riprova tra poco", { id: "net-unreachable" });
        else toast.success("Richiesta inviata", { id: `sent-${handle}` });
      },
      accept: async (handle) => {
        await connRef.current?.accept(handle);
      },
      reject: async (handle) => {
        await connRef.current?.reject(handle);
      },
      cancel: async (handle) => {
        await connRef.current?.cancel(handle);
      },
      linkFromBackup: async (handle, name, snapshot, pub) => {
        const r = await connRef.current?.linkFromBackup(handle, name, snapshot, pub);
        if (r === "key_mismatch")
          toast.error(`La chiave nel backup di @${handle} non corrisponde a quella salvata`, {
            id: `key-${handle}`,
          });
      },
    }),
    [connected, mode, issue],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeer must be used inside PeerProvider");
  return ctx;
}
