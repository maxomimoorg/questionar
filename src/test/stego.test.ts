import { afterEach, describe, expect, it, vi } from "vitest";
import { importBackupPng, type BackupPayload } from "@/lib/stego";

const payload: BackupPayload = { v: 1, name: "Luna", handle: "luna🦊🌊⭐", bio: "<b>Ciao</b>", answers: { "A-1": { value: 73, answered: true } }, customQuestions: [], savedAt: 123456 };

function mockPng(width: number, height: number, value: BackupPayload, claimedLength?: number) {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const bytes = new Uint8Array(8 + json.length);
  bytes.set(new TextEncoder().encode("QAR1"));
  new DataView(bytes.buffer).setUint32(4, claimedLength ?? json.length);
  bytes.set(json, 8);
  const data = new Uint8ClampedArray(width * height * 4).fill(254);
  for (let bit = 0; bit < bytes.length * 8; bit++) {
    const pos = Math.floor(bit / 3) * 4 + bit % 3;
    data[pos] = ((data[pos] ?? 0) & 254) | (((bytes[Math.floor(bit / 8)] ?? 0) >> (7 - bit % 8)) & 1);
  }
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
  const getImageData = vi.fn().mockReturnValue({ data });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData } as unknown as CanvasRenderingContext2D);
  return getImageData;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("QuestionAR backup compatibility", () => {
  it("reads old 512×512 backups without a public key", async () => {
    const read = mockPng(512, 512, payload);
    expect(await importBackupPng(new File([], "old.png"))).toEqual(payload);
    expect(read).toHaveBeenCalledWith(0, 0, 512, 512);
  });
  it("reads new 700×1000 backups including their public key and styled bio", async () => {
    const current: BackupPayload = { ...payload, tags: { vegan: true, alcol: "cross", sport: false }, pub: { kty: "EC", crv: "P-256", x: "public-x", y: "public-y" } };
    const read = mockPng(700, 1000, current);
    expect(await importBackupPng(new File([], "new.png"))).toEqual(current);
    expect(read).toHaveBeenCalledWith(0, 0, 700, 1000);
  });
  it("rejects a length extending past the available pixels", async () => {
    mockPng(512, 512, payload, 999999);
    await expect(importBackupPng(new File([], "broken.png"))).rejects.toThrow("Backup illeggibile");
  });
});