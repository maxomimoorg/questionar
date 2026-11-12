import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureInvite, loadInvite, processInvite, type InviteDeps } from "@/lib/qr-invite";
import type { Contact, ConnectionRequest } from "@/lib/types";

const ME = "mario🐱🌙⭐";
const BOB = "luna🦊🌊⭐";

function mem() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

function setup(opts: { online?: boolean; me?: string } = {}) {
  const storage = mem();
  const state = { contacts: [] as Contact[], requests: [] as ConnectionRequest[] };
  const net = { online: opts.online ?? true, sent: [] as string[] };
  const notes: { kind: string; text: string }[] = [];
  const send = vi.fn(async (h: string) => {
    if (!net.online) return "offline" as const;
    state.requests.push({ handle: h, name: h, direction: "outgoing", emojis: [], createdAt: 1 });
    net.sent.push(h);
    return "sent" as const;
  });
  const deps: InviteDeps = {
    myHandle: opts.me ?? ME,
    contacts: () => state.contacts,
    requests: () => state.requests,
    send,
    resend: async (h) => {
      if (!net.online) return false;
      net.sent.push(h);
      return true;
    },
    notify: (kind, text) => notes.push({ kind, text }),
    storage,
  };
  const open = (handle: string) =>
    captureInvite(
      { pathname: "/rubrica", search: `?handle=${encodeURIComponent(handle)}` },
      storage,
    );
  return { storage, state, net, notes, send, deps, open };
}

describe("QR invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("existing profile: opening the link sends one request without connecting", async () => {
    const t = setup();
    t.open(BOB);
    expect(await processInvite(t.deps)).toBe("sent");
    expect(t.net.sent).toEqual([BOB]);
    expect(t.state.contacts).toHaveLength(0);
    expect(t.state.requests[0]?.direction).toBe("outgoing");
    expect(loadInvite(t.storage)).toBeNull();
    expect(t.notes.at(-1)?.kind).toBe("success");
  });

  it("concurrent runs (Strict Mode / rerender) send only once", async () => {
    const t = setup();
    t.open(BOB);
    const [a, b] = await Promise.all([processInvite(t.deps), processInvite(t.deps)]);
    expect([a, b]).toEqual(["sent", "sent"]);
    expect(t.send).toHaveBeenCalledTimes(1);
  });

  it("link opened before onboarding is kept and sent once identity exists", async () => {
    const t = setup({ me: "" });
    t.open(BOB);
    expect(await processInvite(t.deps)).toBe("none");
    expect(loadInvite(t.storage)?.handle).toBe(BOB);
    expect(await processInvite({ ...t.deps, myHandle: ME })).toBe("sent");
    expect(t.net.sent).toEqual([BOB]);
  });

  it("offline: no success, stays pending, sent once when the network returns", async () => {
    const t = setup({ online: false });
    t.open(BOB);
    expect(await processInvite(t.deps)).toBe("pending");
    expect(t.notes.some((n) => n.kind === "success")).toBe(false);
    expect(loadInvite(t.storage)?.handle).toBe(BOB);
    t.open(BOB); // refresh with the same link keeps the invite
    t.net.online = true;
    expect(await processInvite(t.deps)).toBe("sent");
    expect(await processInvite(t.deps)).toBe("none");
    t.open(BOB); // reopening the link later does not resend
    expect(await processInvite(t.deps)).toBe("dropped");
    expect(t.net.sent).toEqual([BOB]);
  });

  it("reload during send re-sends the request without duplicating it locally", async () => {
    const t = setup();
    t.storage.setItem(
      "questionar.pendingInvite",
      JSON.stringify({ handle: BOB, savedAt: 1, attempted: true }),
    );
    t.state.requests.push({
      handle: BOB,
      name: BOB,
      direction: "outgoing",
      emojis: [],
      createdAt: 1,
    });
    expect(await processInvite(t.deps)).toBe("sent");
    expect(t.send).not.toHaveBeenCalled();
    expect(t.state.requests).toHaveLength(1);
  });

  it("invalid handle is dropped with an error", async () => {
    const t = setup();
    t.open("x!");
    expect(await processInvite(t.deps)).toBe("dropped");
    expect(t.send).not.toHaveBeenCalled();
    expect(t.notes[0]?.kind).toBe("error");
    expect(loadInvite(t.storage)).toBeNull();
  });

  it("own handle is not sent", async () => {
    const t = setup();
    t.open(ME);
    expect(await processInvite(t.deps)).toBe("dropped");
    expect(t.send).not.toHaveBeenCalled();
  });

  it("existing contact, outgoing or incoming request: nothing is sent", async () => {
    for (const kind of ["contact", "outgoing", "incoming"] as const) {
      const t = setup();
      if (kind === "contact")
        t.state.contacts.push({ handle: BOB, name: "Bob", emojis: [] } as Contact);
      else
        t.state.requests.push({
          handle: BOB,
          name: "Bob",
          direction: kind,
          emojis: [],
          createdAt: 1,
        });
      t.open(BOB);
      expect(await processInvite(t.deps)).toBe("dropped");
      expect(t.send).not.toHaveBeenCalled();
      expect(t.state.contacts.length + t.state.requests.length).toBe(1);
    }
  });

  it("no handle parameter: nothing is captured or sent", async () => {
    const t = setup();
    expect(captureInvite({ pathname: "/rubrica", search: "" }, t.storage)).toBeNull();
    expect(captureInvite({ pathname: "/", search: `?handle=${BOB}` }, t.storage)).toBeNull();
    expect(await processInvite(t.deps)).toBe("none");
    expect(t.send).not.toHaveBeenCalled();
  });
});
