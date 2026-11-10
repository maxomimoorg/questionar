import { Bold, Italic, Strikethrough, Heading, Pilcrow, Link2, Ban, Pipette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useStore } from "@/lib/store";
import { PALETTE } from "@/lib/palette";
import { ProfileTagChip } from "@/components/ProfileTags";
import { isActiveTag, nextTagState, PROFILE_TAGS, type ProfileTags } from "@/lib/profile-tags";
import { Button } from "@/components/ui/button";

const TEXT_COLORS = PALETTE.map((p) => p.hex);

const MAX = 666;

export function BioEditor({ onClose, initialTag }: { onClose: () => void; initialTag?: string }) {
  const { state, patch } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(state.identity?.name ?? "");
  const [username, setUsername] = useState(state.identity?.username ?? "");
  const [colorsOpen, setColorsOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [tags, setTags] = useState<ProfileTags>(() => ({
    ...PROFILE_TAGS.reduce((acc, tag) => ({ ...acc, [tag.id]: false }), {} as ProfileTags),
    ...state.tags,
    ...(initialTag ? { [initialTag]: true } : {}),
  }));

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = state.bio;
      setCount(editorRef.current.innerText.length);
    }
  }, [state.bio]);

  const cmd = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const applyColor = (color: string) => {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    document.execCommand("styleWithCSS", false, "false");
  };

  const save = () => {
    const html = editorRef.current?.innerHTML ?? "";
    const cleanUser = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16);
    patch({
      bio: html,
      tags,
      identity: state.identity
        ? {
            ...state.identity,
            name: name.trim().slice(0, 20) || state.identity.name,
            username: cleanUser.length >= 4 ? cleanUser : state.identity.username,
          }
        : state.identity,
    });
    onClose();
  };

  const btn = "grid size-9 place-items-center rounded-xl bg-background text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="app-shell safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-popover py-4 sm:rounded-3xl">
        <h2 className="text-[16px]">Modifica profilo</h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] text-muted-foreground">Nome</span>
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted-foreground">
              Username (le emoji non cambiano mai)
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-background px-3 py-2 ring-1 ring-input focus-within:ring-accent">
              <input
                value={username}
                maxLength={16}
                onChange={(e) => setUsername(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
              <span className="shrink-0 text-[14px]">{state.identity?.emojis.join("")}</span>
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-2">
          <div className="flex flex-wrap items-center gap-1">
            <button className={btn} aria-label="Grassetto" onClick={() => cmd("bold")}>
              <Bold size={16} />
            </button>
            <button className={btn} aria-label="Corsivo" onClick={() => cmd("italic")}>
              <Italic size={16} />
            </button>
            <button className={btn} aria-label="Barrato" onClick={() => cmd("strikeThrough")}>
              <Strikethrough size={16} />
            </button>
            <button className={btn} aria-label="Titolo" onClick={() => cmd("formatBlock", "<h2>")}>
              <Heading size={16} />
            </button>
            <button
              className={btn}
              aria-label="Paragrafo"
              onClick={() => cmd("formatBlock", "<p>")}
            >
              <Pilcrow size={16} />
            </button>
            <button
              className={btn}
              aria-label="Link"
              onClick={() => {
                const url = window.prompt("Indirizzo del link");
                if (url) cmd("createLink", url);
              }}
            >
              <Link2 size={16} />
            </button>
            <button
              className={btn}
              aria-label="Rimuovi colore"
              onClick={() => applyColor("inherit")}
            >
              <Ban size={16} />
            </button>
            <button
              className={btn}
              aria-label="Selettore colore"
              onClick={() => setColorsOpen((v) => !v)}
            >
              <Pipette size={16} />
            </button>
          </div>

          {colorsOpen && (
            <div className="mt-2 flex flex-wrap gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Colore ${c}`}
                  onClick={() => applyColor(c)}
                  className="size-7 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              const el = e.currentTarget;
              if (el.innerText.length > MAX) {
                el.innerText = el.innerText.slice(0, MAX);
              }
              setCount(el.innerText.length);
            }}
            className="rte-content mt-2 min-h-32 rounded-xl bg-background p-3 text-[14px] outline-none"
          />
          {count >= MAX && (
            <div className="mt-1 text-right text-[12px] text-destructive">
              {MAX}/{MAX}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-surface p-2.5">
          {[
            { title: "Cosa mi caratterizza", active: true },
            { title: "Senza risposta", active: false },
          ].map((section) => (
            <section key={section.title} aria-label={section.title} className="mb-3 last:mb-0">
              <h3 className="text-[12px] font-semibold text-foreground">{section.title}</h3>
              <div className="mt-1.5 flex min-h-7 flex-wrap gap-1.5">
                {PROFILE_TAGS.filter((tag) => isActiveTag(tags[tag.id]) === section.active).map(
                  (tag) => (
                    <ProfileTagChip
                      key={tag.id}
                      tag={tag}
                      value={tags[tag.id]}
                      onClick={() =>
                        setTags((current) => ({
                          ...current,
                          [tag.id]: nextTagState(current[tag.id]),
                        }))
                      }
                    />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground"
          >
            Annulla
          </button>
          <Button onClick={save} className="h-auto flex-1 rounded-2xl px-4 py-3">
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}
