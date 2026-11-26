/** Strips spaces and an optional leading "@" (people often type or share handles that way). */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function segmentGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (entry) => entry.segment);
}

function isEmojiGrapheme(grapheme: string): boolean {
  return /\p{Extended_Pictographic}/u.test(grapheme);
}

/** A valid handle is <username 4-16 letters/digits> followed by exactly 3 emoji. */
export function isValidHandle(handle: string): boolean {
  const h = normalizeHandle(handle);
  const username = h.match(/^[a-z0-9]{4,16}/i)?.[0];
  if (!username) return false;
  const graphemes = segmentGraphemes(h.slice(username.length));
  return graphemes.length === 3 && graphemes.every(isEmojiGrapheme);
}

export function emojisFromHandle(handle: string): string[] {
  const rest = normalizeHandle(handle).replace(/^[a-z0-9]+/i, "");
  return segmentGraphemes(rest).filter(isEmojiGrapheme);
}
