// Emoji collection: 150 entries, fixed order by rarity (common -> uncommon -> rare).

export type Rarity = "common" | "uncommon" | "rare";

export const COMMON = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐮","🐷","🐸","🐔","🐧","🐦",
  "🐝","🐞","🐴","🐑","🐐","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑",
  "🥕","🥦","🌽","🥬","🍅","🥔","🧄","🧅","🍆","🌰","🌳","🔥","💧","⚡","🌊",
  "😀","😅","😂","🥲","😍","😎","😴","😭","😡","🤔","🥳","😱","🤗","😇","🙃",
  "🌻","🌼","🌷","🍄","🌈","🐟","🐛","🦆","🍏","☘️","🌙","⭐","🍀","🐝","🍊",
];

export const UNCOMMON = [
  "🦁","🐯","🐘","🦒","🦓","🦏","🦛","🐊","🐍","🦎","🐢","🦖","🦕","🦧","🦍",
  "🦥","🦦","🦨","🦡","🦔","🦩","🦚","🦜","🦢","🦉","🥝","🥭","🍍","🥥","🐉",
  "🦂","🕷️","🦑","🐙","🦈","🐬","🐳","🦭","🦚","🦤",
];

export const RARE = [
  "🧚","🧜","🧞","🧝","🧙","🦄","🐲","👽","👾","🤖","🧟","🧛","👻","🎃","😈",
];

export type EmojiEntry = { char: string; rarity: Rarity };

function dedupe(list: string[], seen: Set<string>) {
  const out: string[] = [];
  for (const c of list) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

const seen = new Set<string>();
const commons = dedupe(COMMON, seen);
const uncommons = dedupe(UNCOMMON, seen);
const rares = dedupe(RARE, seen);

export const COLLECTION: EmojiEntry[] = [
  ...commons.map((char) => ({ char, rarity: "common" as Rarity })),
  ...uncommons.map((char) => ({ char, rarity: "uncommon" as Rarity })),
  ...rares.map((char) => ({ char, rarity: "rare" as Rarity })),
];

export const COLLECTION_SIZE = 150;

export function rarityOf(char: string): Rarity | undefined {
  return COLLECTION.find((e) => e.char === char)?.rarity;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 9 random emoji for the onboarding picker: 75% common, 20% uncommon, 5% rare. */
export function rollPickerEmojis(): string[] {
  const out: string[] = [];
  while (out.length < 9) {
    const r = Math.random();
    const char = r < 0.75 ? pick(commons) : r < 0.95 ? pick(uncommons) : pick(rares);
    if (!out.includes(char)) out.push(char);
  }
  return out;
}
