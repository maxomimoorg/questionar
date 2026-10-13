import { X } from "lucide-react";

import { COLLECTION, COLLECTION_SIZE } from "@/lib/emoji";
import { useStore } from "@/lib/store";

/** 15x10 fixed grid: owned emoji replace the faint x placeholders. */
export function EmojiCollection() {
  const { state } = useStore();
  const owned = new Set(state.emojiCollection);
  const slots = Array.from({ length: COLLECTION_SIZE }, (_, i) => COLLECTION[i]);

  return (
    <section className="section-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px]">Collezione emoji</h2>
        <span className="text-[12px] text-muted-foreground">
          {owned.size}/{COLLECTION_SIZE}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Si completa con le emoji degli handle delle tue nuove connessioni.
      </p>
      <div
        className="mx-auto mt-3 grid w-fit justify-center"
        style={{ gridTemplateColumns: "repeat(15, 1fr)", gap: "1px" }}
      >
        {slots.map((entry, i) => {
          const char = entry?.char;
          const has = char ? owned.has(char) : false;
          return (
            <div key={i} className="grid size-5 place-items-center">
              {has ? (
                <span className="emoji-glow text-[15px] leading-none">{char}</span>
              ) : (
                <X
                  size={9}
                  strokeWidth={1.5}
                  className="text-muted-foreground/30"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
