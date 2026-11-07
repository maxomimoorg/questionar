import { describe, expect, it } from "vitest";

import { Connections, type ConnStore } from "@/lib/connections";
import { generateKeyPair } from "@/lib/keys";
import { P2P, type NetIssue, type NetMode } from "@/lib/p2p";
import type { Transport, TransportEvents } from "@/lib/transport";
import type { Contact, ConnectionRequest, ProfileSnapshot } from "@/lib/types";

/** In-memory relay: queues messages for offline rooms, pushes them live otherwise. */
class Hub {
  online = new Map<string, FakeTransport>();
  queue = new Map<string, { id: string; raw: string }[]>();
  connect(t: FakeTransport) {
    this.online.set(t.room, t);
    for (const other of this.online.values()) if (other !== t) other.presence(t.room, true);
    const q = this.queue.get(t.room) ?? [];
    this.queue.set(t.room, []);
    for (const m of q) void this.deliver(t, m);
  }
  disconnect(t: FakeTransport) {
    this.online.delete(t.room);
    for (const other of this.online.values()) other.presence(t.room, false);
  }
  async deliver(t: FakeTransport, m: { id: string; raw: string }) {
    const r = await t.ev.onWire(m.raw);
    if (r === "retry") this.queue.set(t.room, [...(this.queue.get(t.room) ?? []), m]);
  }
  send(to: string, id: string, raw: string) {
    const t = this.online.get(to);
    if (t) void this.deliver(t, { id, raw });
    else this.queue.set(to, [...(this.queue.get(to) ?? []), { id, raw }]);
  }
}

class FakeTransport implements Transport {
  readonly kind = "relay" as const;
  room = "";
  watched = new Set<string>();
  connected = false;
  constructor(
    private hub: Hub,
    public ev: TransportEvents,
  ) {}
  start(room: string, watch: string[]) {
    this.room = room;
    watch.forEach((w) => this.watched.add(w));
    this.connected = true;
    this.ev.onStatus(true);
    this.hub.connect(this);
    for (const w of this.watched) this.ev.onPresence(w, this.hub.online.has(w));
  }
  presence(room: string, on: boolean) {
    if (this.watched.has(room)) this.ev.onPresence(room, on);
  }
  watch(room: string) {
    this.watched.add(room);
    this.ev.onPresence(room, this.hub.online.has(room));
  }
  async send(to: string, id: string, raw: string) {
    if (!this.connected) return false;
    this.hub.send(to, id, raw);
    return true;
  }
  isConnected() {
    return this.connected;
  }
  stop() {
    this.connected = false;
    this.hub.disconnect(this);
  }
}

function memStore(name: string) {
  const s = { contacts: [] as Contact[], requests: [] as ConnectionRequest[] };
  const snap: ProfileSnapshot = {
    name,
    bio: "",
    answers: {},
    customQuestions: [],
    updatedAt: 1,
  };
  const store: ConnStore = {
    contacts: () => s.contacts,
    requests: () => s.requests,
    myName: () => name,
    mySnapshot: () => snap,
    addRequest: (r) => {
      if (!s.requests.some((x) => x.handle === r.handle)) s.requests.push(r);
    },
    updateRequest: (h, p) => {
      s.requests = s.requests.map((r) => (r.handle === h ? { ...r, ...p } : r));
    },
    removeRequest: (h) => {
      s.requests = s.requests.filter((r) => r.handle !== h);
    },
    acceptRequest: (h) => {
      const r = s.requests.find((x) => x.handle === h);
      if (!r) return;
      s.requests = s.requests.filter((x) => x.handle !== h);
      s.contacts.push({
        handle: h,
        name: r.name,
        emojis: r.emojis,
        roomKey: h,
        ...(r.snapshot ? { snapshot: r.snapshot } : {}),
        ...(r.publicKey ? { publicKey: r.publicKey } : {}),
      });
    },
    upsertContact: (c) => {
      const old = s.contacts.find((x) => x.handle === c.handle);
      s.contacts = [...s.contacts.filter((x) => x.handle !== c.handle), { ...old, ...c }];
    },
    updateContact: (h, p) => {
      s.contacts = s.contacts.map((c) => (c.handle === h ? { ...c, ...p } : c));
    },
  };
  return { s, store };
}

async function makePeer(hub: Hub | null, handle: string, relayUrl = "wss://relay.test") {
  const keys = (await generateKeyPair())!;
  const { s, store } = memStore(handle);
  const statuses: { connected: boolean; mode: NetMode; issue: NetIssue }[] = [];
  const conn = new Connections(handle, store, () => undefined, {
    onStatus: (connected, mode, issue) => statuses.push({ connected, mode, issue }),
  });
  let transport: FakeTransport | null = null;
  const p2p = new P2P(handle, keys, conn.handlers, {
    relayUrl,
    relayRetryMs: 10_000_000,
    ...(hub
      ? {
          transportFactory: (_m, ev) => (transport = new FakeTransport(hub, ev)),
        }
      : {}),
  });
  conn.attach(p2p);
  return { s, conn, p2p, statuses, transport: () => transport! };
}

const flush = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 5));
};

describe("connection requests", () => {
  it("sending a request by handle creates an outgoing request", async () => {
    const hub = new Hub();
    const a = await makePeer(hub, "alice🦊🌊⭐");
    await a.p2p.start([]);
    expect(await a.conn.sendRequest("bob🐻🌲🔥")).toBe("sent");
    expect(a.s.requests).toHaveLength(1);
    expect(a.s.requests[0]).toMatchObject({ handle: "bob🐻🌲🔥", direction: "outgoing" });
  });

  it("the receiver gets the request and accepting it creates contacts on both sides", async () => {
    const hub = new Hub();
    const a = await makePeer(hub, "alice🦊🌊⭐");
    const b = await makePeer(hub, "bob🐻🌲🔥");
    await a.p2p.start([]);
    await b.p2p.start([]);
    await a.conn.sendRequest("bob🐻🌲🔥");
    await flush();
    expect(b.s.requests[0]).toMatchObject({ handle: "alice🦊🌊⭐", direction: "incoming" });
    // the encrypted preview gives the real name
    expect(b.s.requests[0]!.name).toBe("alice🦊🌊⭐");

    await b.conn.accept("alice🦊🌊⭐");
    await flush();
    expect(b.s.requests).toHaveLength(0);
    expect(b.s.contacts.map((c) => c.handle)).toEqual(["alice🦊🌊⭐"]);
    expect(a.s.requests).toHaveLength(0);
    expect(a.s.contacts.map((c) => c.handle)).toEqual(["bob🐻🌲🔥"]);
    expect(a.s.contacts[0]!.snapshot?.name).toBe("bob🐻🌲🔥");
  });

  it("a request sent while the receiver is offline arrives when it comes online", async () => {
    const hub = new Hub();
    const a = await makePeer(hub, "alice🦊🌊⭐");
    await a.p2p.start([]);
    await a.conn.sendRequest("bob🐻🌲🔥");
    const b = await makePeer(hub, "bob🐻🌲🔥");
    await b.p2p.start([]);
    await flush();
    expect(b.s.requests[0]).toMatchObject({ handle: "alice🦊🌊⭐", direction: "incoming" });
  });

  it("rejecting removes the request on both sides", async () => {
    const hub = new Hub();
    const a = await makePeer(hub, "alice🦊🌊⭐");
    const b = await makePeer(hub, "bob🐻🌲🔥");
    await a.p2p.start([]);
    await b.p2p.start([]);
    await a.conn.sendRequest("bob🐻🌲🔥");
    await flush();
    await b.conn.reject("alice🦊🌊⭐");
    await flush();
    expect(b.s.requests).toHaveLength(0);
    expect(a.s.requests).toHaveLength(0);
    expect(a.s.contacts).toHaveLength(0);
  });

  it("cancelling removes the request on both sides", async () => {
    const hub = new Hub();
    const a = await makePeer(hub, "alice🦊🌊⭐");
    const b = await makePeer(hub, "bob🐻🌲🔥");
    await a.p2p.start([]);
    await b.p2p.start([]);
    await a.conn.sendRequest("bob🐻🌲🔥");
    await flush();
    await a.conn.cancel("bob🐻🌲🔥");
    await flush();
    expect(a.s.requests).toHaveLength(0);
    expect(b.s.requests).toHaveLength(0);
  });

  it("a duplicate message is confirmed but not handled twice", async () => {
    const hub = new Hub();
    const b = await makePeer(hub, "bob🐻🌲🔥");
    await b.p2p.start([]);
    const keys = (await generateKeyPair())!;
    const raw = JSON.stringify({
      v: 2,
      id: "dup-id-0001",
      from: "eve🐍🌙💧",
      to: "bob🐻🌲🔥",
      pub: keys.publicKey,
      msg: { type: "request", from: "eve🐍🌙💧" },
    });
    expect(await b.p2p.deliver(raw)).toBe("ok");
    expect(await b.p2p.deliver(raw)).toBe("duplicate");
    expect(b.s.requests).toHaveLength(1);
  });
});

describe("network status and issues", () => {
  it("connected relay reports mode relay with no issue", async () => {
    const a = await makePeer(new Hub(), "alice🦊🌊⭐");
    await a.p2p.start([]);
    expect(a.statuses.at(-1)).toEqual({ connected: true, mode: "relay", issue: null });
  });

  it("a missing relay URL reports not_configured and stays offline", async () => {
    const a = await makePeer(null, "alice🦊🌊⭐", "");
    await a.p2p.start([]);
    expect(a.statuses.at(-1)).toEqual({ connected: false, mode: "offline", issue: "not_configured" });
    expect(await a.conn.sendRequest("bob🐻🌲🔥")).toBe("offline");
  });

  it.each([
    ["closed", "unreachable"],
    ["quota", "quota"],
  ] as const)("relay unavailable (%s) reports %s and goes offline", async (reason, issue) => {
    let ev: TransportEvents | null = null;
    const keys = (await generateKeyPair())!;
    const statuses: { connected: boolean; mode: NetMode; issue: NetIssue }[] = [];
    const { store } = memStore("a");
    const conn = new Connections("alice🦊🌊⭐", store, () => undefined, {
      onStatus: (connected, mode, i) => statuses.push({ connected, mode, issue: i }),
    });
    const p2p = new P2P("alice🦊🌊⭐", keys, conn.handlers, {
      relayUrl: "wss://relay.test",
      relayRetryMs: 10_000_000,
      transportFactory: (_m, e) => {
        ev = e;
        return {
          kind: "relay",
          start: () => undefined,
          watch: () => undefined,
          send: async () => false,
          isConnected: () => false,
          stop: () => undefined,
        };
      },
    });
    await p2p.start([]);
    ev!.onUnavailable(reason);
    expect(statuses.at(-1)).toEqual({ connected: false, mode: "offline", issue });
    expect(p2p.getMode()).toBe("offline");
    p2p.stop();
  });
});
