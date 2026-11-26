/** Strips spaces and an optional leading "@" (people often type or share handles that way). */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

/** A valid handle is <username 4-16 letters/digits> followed by exactly 3 emoji. */
export function isValidHandle(handle: string): boolean {
  const h = normalizeHandle(handle);
  const username = h.match(/^[a-z0-9]{4,16}/i)?.[0];
  if (!username) return false;
  const rest = Array.from(h.slice(username.length));
  if (rest.length === 0) return false;
  const emojis = rest.filter((c) => /\p{Extended_Pictographic}/u.test(c));
  // every remaining character must be part of an emoji, and there must be 3 of them
  const nonEmoji = rest.filter((c) => !isEmojiPart(c));
  return emojis.length === 3 && nonEmoji.length === 0;
}

export function emojisFromHandle(handle: string): string[] {
  return Array.from(normalizeHandle(handle).replace(/^[a-z0-9]+/i, "")).filter((c) =>
    /\p{Extended_Pictographic}/u.test(c),
  );
}

/** One code point of an emoji: a pictograph, a joiner (ZWJ), a variation selector or a skin tone. */
function isEmojiPart(c: string): boolean {
  const cp = c.codePointAt(0) ?? 0;
  if (cp === 0x200d || cp === 0xfe0f) return true;
  if (cp >= 0x1f3fb && cp <= 0x1f3ff) return true;
  return /\p{Extended_Pictographic}/u.test(c);
}
