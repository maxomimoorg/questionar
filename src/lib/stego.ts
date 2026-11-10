// Backup hidden inside the avatar PNG with LSB steganography.

import type { Answer, Question } from "./types";
import { createBackupCard } from "./backup-card";
import type { ProfileTags } from "./profile-tags";

export type BackupPayload = {
  v: 1;
  name: string;
  handle: string;
  bio: string;
  tags?: ProfileTags;
  answers: Record<string, Answer>;
  /** Optional (newer backups): categories hidden as a whole. */
  hiddenCategories?: string[];
  customQuestions: Question[];
  savedAt: number;
  /** Optional (newer backups): the owner's public key, used to verify the first contact. */
  pub?: JsonWebKey;
};

const MAGIC = "QAR1";

function toBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

/** Writes the legacy-compatible JSON payload into the full opaque backup card. */
export async function exportBackupPng(payload: BackupPayload): Promise<Blob> {
  const canvas = await createBackupCard(payload);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
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
      data[i + c] = ((data[i + c] ?? 0) & 0xfe) | (bits[bit] ?? 0);
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
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas non disponibile");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const bits: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) bits.push((data[i + c] ?? 0) & 1);
  }

  const byteAt = (index: number) => {
    let out = 0;
    for (let i = 0; i < 8; i++) out = (out << 1) | (bits[index * 8 + i] ?? 0);
    return out;
  };

  const magic = String.fromCharCode(byteAt(0), byteAt(1), byteAt(2), byteAt(3));
  if (magic !== MAGIC) throw new Error("Nessun backup trovato in questa immagine");
  const length = new DataView(
    Uint8Array.from([byteAt(4), byteAt(5), byteAt(6), byteAt(7)]).buffer,
  ).getUint32(0);
  if (length <= 0 || length > 5_000_000 || (length + 8) * 8 > bits.length)
    throw new Error("Backup illeggibile");
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = byteAt(8 + i);
  return JSON.parse(new TextDecoder().decode(bytes)) as BackupPayload;
}
