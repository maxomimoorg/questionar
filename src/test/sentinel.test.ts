import { afterEach, describe, expect, it, vi } from "vitest";

import { Sentinel, formatElapsed, newArrivals, type SentinelEnv } from "@/lib/sentinel";

function fakeEnv(permission: NotificationPermission = "default") {
  const release = vi.fn(async () => undefined);
  const shown: string[] = [];
  const N = Object.assign(
    function (this: unknown, title: string) {
      shown.push(title);
    },
    { permission, requestPermission: vi.fn(async () => "granted" as NotificationPermission) },
  );
  N.requestPermission.mockImplementation(async () => {
    N.permission = "granted";
    return "granted";
  });
  const env: SentinelEnv = {
    nav: { wakeLock: { request: vi.fn(async () => ({ release })) } },
    Notification: N as unknown as SentinelEnv["Notification"],
    doc: { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() },
  };
  return { env, release, shown, N };
}

afterEach(() => vi.useRealTimers());

describe("standby connection sentinel", () => {
  it("asks for notifications, takes the screen wake lock and pings the relay regularly", async () => {
    vi.useFakeTimers();
    const { env, N } = fakeEnv();
    const keepAlive = vi.fn(() => true);
    const s = new Sentinel(keepAlive, () => undefined, env, 20_000);
    const status = await s.start();
    expect(N.requestPermission).toHaveBeenCalledOnce();
    expect(status.notifications).toBe("granted");
    expect(status.wakeLock).toBe("active");
    expect(keepAlive).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(keepAlive).toHaveBeenCalledTimes(4);
    await s.stop();
  });

  it("counts incoming requests and shows a local notification", async () => {
    const { env, shown } = fakeEnv("granted");
    const s = new Sentinel(() => true, () => undefined, env);
    await s.start();
    expect(await s.incoming("luna🦊🌊⭐")).toBe(true);
    expect(s.current.incoming).toBe(1);
    expect(shown).toEqual(["Nuova richiesta di connessione"]);
    await s.stop();
  });

  it("releases the wake lock and stops pinging when closed manually", async () => {
    vi.useFakeTimers();
    const { env, release } = fakeEnv("granted");
    const keepAlive = vi.fn(() => true);
    const s = new Sentinel(keepAlive, () => undefined, env, 20_000);
    await s.start();
    await s.stop();
    expect(release).toHaveBeenCalledOnce();
    expect(s.current.active).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(keepAlive).toHaveBeenCalledTimes(1);
    expect(await s.incoming("x")).toBe(false);
  });

  it("reports missing browser support instead of failing", async () => {
    const s = new Sentinel(() => false, () => undefined, {});
    const status = await s.start();
    expect(status.wakeLock).toBe("unsupported");
    expect(status.notifications).toBe("unsupported");
    await s.stop();
  });

  it("formats listening time and detects only new arrivals", () => {
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
    expect(newArrivals(["a"], ["a", "b"])).toEqual(["b"]);
  });
});
