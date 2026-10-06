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

import type { P2P, Envelope } from "./p2p";
import { useStore } from "./store";
import { emojisFromHandle } from "./handle";
import { handleOf, type ProfileSnapshot } from "./types";

type PeerCtx = {
  connected: boolean;
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
  const peerRef = useRef<P2P | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const myHandle = handleOf(state.identity);

  useEffect(() => {
    if (!myHandle || typeof window === "undefined") return;
    let disposed = false;
    let live: P2P | null = null;
    void (async () => {
      const { P2P: Impl } = await import("./p2p");
      if (disposed) return;
      const p2p = new Impl(myHandle, state.identity?.name ?? "", {
        onStatus: setConnected,
        onPresence: (handle, online) => {
          const s = storeRef.current;
          s.updateContact(handle, { online });
          const contact = s.state.contacts.find((c) => c.handle === handle);
          if (online && contact) {
            if (!contact.roomKey) {
              // link created from a backup: ask for the real handshake now
              void p2p.send(handle, {
                type: "request",
                from: myHandle,
                name: s.state.identity?.name ?? "",
                snapshot: s.mySnapshot(),
              });
            } else {
              void p2p.upgrade(handle);
              void p2p.send(handle, {
                type: "profile",
                from: myHandle,
                name: s.state.identity?.name ?? "",
                snapshot: s.mySnapshot(),
              });
            }
          }
        },
        onMessage: (msg: Envelope) => {
          const s = storeRef.current;
          if (msg.type === "request") {
            s.addRequest({
              handle: msg.from,
              name: msg.name,
              direction: "incoming",
              emojis: emojisFromHandle(msg.from),
              createdAt: Date.now(),
              snapshot: msg.snapshot,
            });
            toast.info(`Nuova richiesta di connessione da ${msg.name}`, {
              id: `req-${msg.from}`,
            });
          } else if (msg.type === "accept") {
            s.removeRequest(msg.from);
            s.upsertContact({
              handle: msg.from,
              name: msg.name,
              emojis: emojisFromHandle(msg.from),
              snapshot: msg.snapshot,
              roomKey: msg.from,
              online: true,
            });
            toast.success(`${msg.name} ha accettato la connessione`, {
              id: `acc-${msg.from}`,
            });
          } else if (msg.type === "reject" || msg.type === "cancel") {
            s.removeRequest(msg.from);
          } else if (msg.type === "profile") {
            s.updateContact(msg.from, {
              name: msg.name,
              snapshot: msg.snapshot,
              online: true,
            });
          }
        },
      });
      peerRef.current = p2p;
      live = p2p;
      void p2p.start(storeRef.current.state.contacts.map((c) => c.handle));
    })();

    const onOnline = () => void live?.start(storeRef.current.state.contacts.map((c) => c.handle));
    window.addEventListener("online", onOnline);
    const onVisible = () => {
      if (document.visibilityState === "visible") onOnline();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      live?.stop();
      peerRef.current = null;
    };
    // Re-create only when the identity changes.
  }, [myHandle]);

  const value = useMemo<PeerCtx>(
    () => ({
      connected,
      sendRequest: async (handle) => {
        const p2p = peerRef.current;
        const s = storeRef.current;
        if (!p2p) return;
        await p2p.track(handle);
        const ok = await p2p.sendWithRetry(handle, {
          type: "request",
          from: myHandle,
          name: s.state.identity?.name ?? "",
          snapshot: s.mySnapshot(),
        });
        if (!ok) {
          toast.error("Rete non raggiungibile, riprova tra poco", { id: "net-unreachable" });
          return;
        }
        s.addRequest({
          handle,
          name: handle.replace(/[^a-z0-9]/gi, ""),
          direction: "outgoing",
          emojis: emojisFromHandle(handle),
          createdAt: Date.now(),
        });
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
    [connected, myHandle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeer must be used inside PeerProvider");
  return ctx;
}
