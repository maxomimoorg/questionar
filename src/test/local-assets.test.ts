import { createHash } from "node:crypto";
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
    // Formatting adds a trailing comma, which JSON does not allow.
    const resources: string[] = JSON.parse((precache ?? "[]").replace(/,\s*\]$/, "]"));
    expect(resources).toEqual([
      "/",
      "/rubrica",
      "/erotismo",
      "/manifest.json",
      "/favicon.png",
      "/logo.png",
      "/apple-touch-icon.png",
      "/icon-192.png",
      "/icon-512.png",
    ]);
    for (const resource of resources.slice(3)) expect(existsSync(`public${resource}`)).toBe(true);
  });

  it("loads Nunito and Quicksand from the app, not from Google Fonts", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const css = readFileSync("src/styles.css", "utf8");
    for (const weight of [400, 600, 700])
      expect(css).toContain(`@fontsource/nunito/latin-${weight}.css`);
    for (const weight of [500, 600, 700])
      expect(css).toContain(`@fontsource/quicksand/latin-${weight}.css`);
  });

  it("shows the saved page after a short wait and serves build files from the cache", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    expect(worker).toMatch(/const NAV_TIMEOUT_MS = 2500;/);
    expect(worker).toMatch(/req\.mode === "navigate"[\s\S]*networkFirstWithTimeout/);
    expect(worker).toMatch(/isHashedAsset\(url\)[\s\S]*cacheFirst/);
    expect(worker).not.toContain("notificationclick");
  });

  it("ships the QuestionAR favicon.ico, not the Lovable template icon", () => {
    const ico = readFileSync("public/favicon.ico");
    const LOVABLE_DEFAULT_FAVICON =
      "dd821076a9b03adc2173c93956226aea3d92482d7578fc4339c5d3a2e9c24586";
    expect(createHash("sha256").update(ico).digest("hex")).not.toBe(LOVABLE_DEFAULT_FAVICON);
    // ICO header: reserved 0, type 1 (icon), then the image count.
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48]));
  });
});
