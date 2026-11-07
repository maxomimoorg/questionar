import { describe, expect, it } from "vitest";
import { canRegisterServiceWorker } from "@/lib/sw-register";

const base = { prod: true, search: "", inIframe: false };

describe("service worker registration guard", () => {
  it("registers on the published app and custom domains", () => {
    expect(canRegisterServiceWorker({ ...base, hostname: "questionar.lovable.app" })).toBe(true);
    expect(canRegisterServiceWorker({ ...base, hostname: "questionar.example.com" })).toBe(true);
  });

  it("never registers on Lovable preview or editor hosts", () => {
    for (const hostname of [
      "id-preview--737bfdcc-0795-43a9-b9a4-fc885a649faf.lovable.app",
      "preview--questionar.lovable.app",
      "project--737bfdcc-dev.lovable.app",
      "737bfdcc.lovableproject.com",
      "beta.lovable.dev",
    ]) {
      expect(canRegisterServiceWorker({ ...base, hostname })).toBe(false);
    }
  });

  it("never registers in development, in an iframe or with ?sw=off", () => {
    const hostname = "questionar.lovable.app";
    expect(canRegisterServiceWorker({ ...base, hostname, prod: false })).toBe(false);
    expect(canRegisterServiceWorker({ ...base, hostname, inIframe: true })).toBe(false);
    expect(canRegisterServiceWorker({ ...base, hostname, search: "?sw=off" })).toBe(false);
  });
});
