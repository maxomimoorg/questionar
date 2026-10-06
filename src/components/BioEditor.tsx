import {
  Bold,
  Italic,
  Strikethrough,
  Heading,
  Pilcrow,
  Link2,
  Ban,
  Pipette,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useStore } from "@/lib/store";
import { PROFILE_TAGS } from "@/components/ProfileTags";

const TEXT_COLORS = [
  "#e23e3e",
  "#eb8d34",
  "#e7c83c",
  "#68c560",
  "#34c8c4",
  "#4a8ff0",
  "#a06ce0",
  "#8b8b8b",
];

const MAX = 666;

export function BioEditor({
  onClose,
  initialTag,
}: {
  onClose: () => void;
  initialTag?: string;
}) {
  const { state, patch } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(state.identity?.name ?? "");
  const [username, setUsername] = useState(state.identity?.username ?? "");
  const [colorsOpen, setColorsOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [tags, setTags] = useState<Record<string, boolean>>(() => ({
    ...PROFILE_TAGS.reduce(
      (acc, tag) => ({ ...acc, [tag.id]: false }),
      {} as Record<string, boolean>,
    ),
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
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
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

  const btn =
    "grid size-9 place-items-center rounded-xl bg-background text-muted-foreground";

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
              <span className="shrink-0 text-[14px]">
                {state.identity?.emojis.join("")}
              </span>
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
            <button
              className={btn}
              aria-label="Barrato"
              onClick={() => cmd("strikeThrough")}
            >
              <Strikethrough size={16} />
            </button>
            <button
              className={btn}
              aria-label="Titolo"
              onClick={() => cmd("formatBlock", "<h2>")}
            >
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
            <div className="mt-1 text-right text-[12px] text-destructive">{MAX}/{MAX}</div>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-surface p-2.5">
          <h3 className="text-[12px] font-semibold text-foreground">Tag</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PROFILE_TAGS.map(({ id, label, icon: Icon }) => {
              const active = tags[id] ?? false;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTags((t) => ({ ...t, [id]: !t[id] }))}
                  aria-pressed={active}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[12px] ring-1 transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground ring-accent"
                      : "bg-background text-muted-foreground ring-input hover:text-foreground"
                  }`}
                >
                  <Icon size={12} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground"
          >
            Annulla
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-2xl bg-accent px-4 py-3 text-accent-foreground"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
