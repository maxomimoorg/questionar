/** A valid handle is <username 4-16 letters/digits> followed by exactly 3 emoji. */
export function isValidHandle(handle: string): boolean {
  const h = handle.trim();
  const username = h.match(/^[a-z0-9]{4,16}/i)?.[0];
  if (!username) return false;
  const rest = Array.from(h.slice(username.length));
  if (rest.length === 0) return false;
  const emojis = rest.filter((c) => /\p{Extended_Pictographic}/u.test(c));
  // every remaining character must be part of an emoji, and there must be 3 of them
  const nonEmoji = rest.filter(
    (c) => !/[\p{Extended_Pictographic}\u200d\ufe0f\u{1f3fb}-\u{1f3ff}]/u.test(c),
  );
  return emojis.length === 3 && nonEmoji.length === 0;
}

export function emojisFromHandle(handle: string): string[] {
  return Array.from(handle.replace(/^[a-z0-9]+/i, "")).filter((c) =>
    /\p{Extended_Pictographic}/u.test(c),
  );
}
