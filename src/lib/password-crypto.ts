// Password-based encryption of one questionnaire compartment (Web Crypto only, no server).
// PBKDF2-HMAC-SHA-256 with 600 000 iterations and a random 128-bit salt derives an AES-256-GCM
// key; every encryption uses a fresh random 96-bit IV and a 128-bit authentication tag.

export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const TAG_BITS = 128;

/** Encrypted compartment as it travels in a ProfileSnapshot (all binary fields in base64). */
export type ProtectedBox = {
  salt: string;
  iv: string;
  ciphertext: string;
  keyVersion: number;
};

/** Raised when a password (or stored key) does not open a compartment. */
export class WrongPasswordError extends Error {
  constructor() {
    super("wrong_password");
    this.name = "WrongPasswordError";
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("crypto_unavailable");
  return s;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

/** New random 128-bit salt, base64. */
export function newSalt(): string {
  return toBase64(randomBytes(SALT_BYTES));
}

/** AES-256-GCM key from a password and a base64 salt; not extractable. */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await subtle().importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts any JSON value with a fresh IV. */
export async function encryptJson(
  key: CryptoKey,
  salt: string,
  keyVersion: number,
  value: unknown,
): Promise<ProtectedBox> {
  const iv = randomBytes(IV_BYTES);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, tagLength: TAG_BITS }, key, plain);
  return { salt, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ct)), keyVersion };
}

/** Decrypts a box; any failure (wrong key, tampering, malformed data) is a WrongPasswordError. */
export async function decryptJson(key: CryptoKey, box: ProtectedBox): Promise<unknown> {
  try {
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(box.iv), tagLength: TAG_BITS },
      key,
      fromBase64(box.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new WrongPasswordError();
  }
}

/** Derives the key of a box from a password and opens it; the key is returned for reuse. */
export async function openWithPassword(
  password: string,
  box: ProtectedBox,
): Promise<{ key: CryptoKey; value: unknown }> {
  let key: CryptoKey;
  try {
    key = await deriveKey(password, box.salt);
  } catch {
    throw new WrongPasswordError();
  }
  return { key, value: await decryptJson(key, box) };
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Keeps a received box only when every field has the expected shape. */
export function sanitizeBox(raw: unknown): ProtectedBox | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Partial<Record<keyof ProtectedBox, unknown>>;
  const ok = (v: unknown, max: number): v is string =>
    typeof v === "string" && v.length > 0 && v.length <= max && B64.test(v);
  if (!ok(b.salt, 64) || !ok(b.iv, 64) || !ok(b.ciphertext, 4_000_000)) return undefined;
  if (typeof b.keyVersion !== "number" || !Number.isInteger(b.keyVersion) || b.keyVersion < 1)
    return undefined;
  return { salt: b.salt, iv: b.iv, ciphertext: b.ciphertext, keyVersion: b.keyVersion };
}
