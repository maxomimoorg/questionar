import { describe, expect, it } from "vitest";

import { buildSnapshot } from "@/lib/store";
import {
  EMPTY_STATE,
  migrateContact,
  sanitizeSnapshot,
  sortFavoritesFirst,
  type AppState,
  type Contact,
  type ProfileSnapshot,
} from "@/lib/types";

const contacts: Contact[] = [
  { handle: "luna🦊🌊⭐", name: "Luna", emojis: ["🦊", "🌊", "⭐"], favorite: true },
  { handle: "sole🌻🐝🍉", name: "Sole", emojis: ["🌻", "🐝", "🍉"] },
];

describe("favorites stay local, recommendations are gone", () => {
  it("never puts contacts or favorites in the shared profile snapshot", () => {
    const state: AppState = {
      ...EMPTY_STATE,
      identity: { name: "Io", username: "iome", emojis: ["🐙", "🌙", "🔥"], createdAt: 1 },
      contacts,
    };
    const snap = buildSnapshot(state, 5);
    expect(Object.keys(snap).sort()).toEqual([
      "answers",
      "bio",
      "customQuestions",
      "hiddenCategories",
      "name",
      "tags",
      "updatedAt",
    ]);
    expect(JSON.stringify(snap)).not.toContain("luna");
    expect(snap).not.toHaveProperty("recommends");
  });

  it("drops the legacy public recommends list from snapshots received from older versions", () => {
    const legacy = {
      name: "Vecchio",
      bio: "",
      answers: {},
      customQuestions: [],
      updatedAt: 3,
      recommends: ["luna🦊🌊⭐"],
    } as ProfileSnapshot;
    const clean = sanitizeSnapshot(legacy);
    expect(clean).not.toHaveProperty("recommends");
    expect(clean.name).toBe("Vecchio");
  });

  it("turns old 'recommended' contacts into local favorites and cleans their snapshot", () => {
    const old = {
      handle: "luna🦊🌊⭐",
      name: "Luna",
      emojis: ["🦊", "🌊", "⭐"],
      recommended: true,
      snapshot: {
        name: "Luna",
        bio: "",
        answers: {},
        customQuestions: [],
        updatedAt: 1,
        recommends: ["x"],
      },
    } as unknown as Contact;
    const migrated = migrateContact(old);
    expect(migrated.favorite).toBe(true);
    expect(migrated).not.toHaveProperty("recommended");
    expect(migrated.snapshot).not.toHaveProperty("recommends");
  });

  it("lists favorites first in the address book", () => {
    const order = sortFavoritesFirst([contacts[1]!, contacts[0]!]).map((c) => c.name);
    expect(order).toEqual(["Luna", "Sole"]);
  });
});
