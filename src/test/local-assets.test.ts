import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Self-contained PWA assets", () => {
  it("uses the two local maskable PNG icons", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    expect(manifest.icons).toEqual([
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ]);
  });

  it("precaches exactly the requested local shell and existing static files", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    const precache = worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)?.[1];
    expect(precache).toBeDefined();
    const resources: string[] = JSON.parse(precache ?? "[]");
    expect(resources).toEqual([
      "/", "/rubrica", "/manifest.json", "/favicon.png", "/logo.png",
      "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png",
    ]);
    for (const resource of resources.slice(2)) expect(existsSync(`public${resource}`)).toBe(true);
  });
});