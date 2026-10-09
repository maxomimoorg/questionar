// End-to-end encryption for every message that leaves the device.
// ECDH P-256 (identity keys) -> AES-GCM 256. Relays only see opaque ciphertext.

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type Sealed = { iv: string; ct: string };

/** Short fingerprint used to compare keys (trust on first use). */
export function keyFingerprint(jwk: JsonWebKey | undefined | null) {
  return jwk ? `${jwk.x ?? ""}.${jwk.y ?? ""}` : "";
}

export class E2E {
  private shared = new Map<string, Promise<CryptoKey>>();
  private priv: Promise<CryptoKey>;

  constructor(privateJwk: JsonWebKey) {
    this.priv = crypto.subtle.importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, [
      "deriveKey",
    ]);
  }

  private key(peer: JsonWebKey) {
    const fp = keyFingerprint(peer);
    let k = this.shared.get(fp);
    if (!k) {
      k = (async () => {
        const pub = await crypto.subtle.importKey(
          "jwk",
          publicOnly(peer) as JsonWebKey,
          { name: "ECDH", namedCurve: "P-256" },
          false,
          [],
        );
        return crypto.subtle.deriveKey(
          { name: "ECDH", public: pub },
          await this.priv,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
      })();
      this.shared.set(fp, k);
    }
    return k;
  }

  async seal(peer: JsonWebKey, text: string, aad: string): Promise<Sealed> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
      await this.key(peer),
      new TextEncoder().encode(text),
    );
    return { iv: b64(iv), ct: b64(ct) };
  }

  async open(peer: JsonWebKey, sealed: Sealed, aad: string): Promise<string> {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(sealed.iv), additionalData: new TextEncoder().encode(aad) },
      await this.key(peer),
      unb64(sealed.ct),
    );
    return new TextDecoder().decode(pt);
  }
}

export function publicOnly(jwk: JsonWebKey): JsonWebKey {
  const out: JsonWebKey = { kty: jwk.kty ?? "EC", crv: jwk.crv ?? "P-256" };
  if (jwk.x) out.x = jwk.x;
  if (jwk.y) out.y = jwk.y;
  return out;
}
