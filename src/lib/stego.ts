// Backup hidden inside the avatar PNG with LSB steganography.

import type { Answer, Question } from "./types";

export type BackupPayload = {
  v: 1;
  name: string;
  handle: string;
  bio: string;
  tags?: Record<string, boolean>;
  answers: Record<string, Answer>;
  customQuestions: Question[];
  savedAt: number;
};

const MAGIC = "QAR1";

function toBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

async function loadAvatarCanvas(handle: string): Promise<HTMLCanvasElement> {
  const url = `https://api.dicebear.com/10.x/critters/png?size=512&seed=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/** Writes the payload into the avatar image and returns a PNG blob. */
export async function exportBackupPng(payload: BackupPayload): Promise<Blob> {
  const canvas = await loadAvatarCanvas(payload.handle);
  const ctx = canvas.getContext("2d")!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  const json = new TextEncoder().encode(JSON.stringify(payload));
  const header = new TextEncoder().encode(MAGIC);
  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, json.length);
  const bits = toBits(new Uint8Array([...header, ...lengthBytes, ...json]));

  const usable = Math.floor(data.length / 4) * 3;
  if (bits.length > usable) throw new Error("Backup troppo grande per questa immagine");

  let bit = 0;
  for (let i = 0; i < data.length && bit < bits.length; i += 4) {
    // keep the image fully opaque so the alpha channel never hides data
    data[i + 3] = 255;
    for (let c = 0; c < 3 && bit < bits.length; c++) {
      data[i + c] = (data[i + c]! & 0xfe) | bits[bit]!;
      bit++;
    }
  }
  ctx.putImageData(image, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG non generato"))), "image/png");
  });
}

/** Reads a payload back out of a PNG file. */
export async function importBackupPng(file: File): Promise<BackupPayload> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const bits: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) bits.push(data[i + c]! & 1);
  }

  const byteAt = (index: number) => {
    let out = 0;
    for (let i = 0; i < 8; i++) out = (out << 1) | (bits[index * 8 + i] ?? 0);
    return out;
  };

  const magic = String.fromCharCode(byteAt(0), byteAt(1), byteAt(2), byteAt(3));
  if (magic !== MAGIC) throw new Error("Nessun backup trovato in questa immagine");
  const length =
    (byteAt(4) << 24) | (byteAt(5) << 16) | (byteAt(6) << 8) | byteAt(7);
  if (length <= 0 || length > 5_000_000) throw new Error("Backup illeggibile");
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = byteAt(8 + i);
  return JSON.parse(new TextDecoder().decode(bytes)) as BackupPayload;
}
