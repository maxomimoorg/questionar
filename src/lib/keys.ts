// End-to-end key pair assigned to every new profile (used later by the P2P layer).

export type KeyPairJwk = { publicKey: JsonWebKey; privateKey: JsonWebKey };

export async function generateKeyPair(): Promise<KeyPairJwk | null> {
  try {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"],
    );
    const [publicKey, privateKey] = await Promise.all([
      crypto.subtle.exportKey("jwk", pair.publicKey),
      crypto.subtle.exportKey("jwk", pair.privateKey),
    ]);
    return { publicKey, privateKey };
  } catch {
    return null;
  }
}
