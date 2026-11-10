import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { loadState, saveState, clearState } from "./db";
import {
  EMPTY_STATE,
  handleOf,
  migrateContact,
  migrateRequest,
  sanitizeAnswers,
  type AppState,
  type Answer,
  type Contact,
  type ConnectionRequest,
  type Identity,
  type ProfileSnapshot,
} from "./types";
import {
  DEFAULT_QUESTIONS,
  ALL_CATEGORIES,
  isDefaultQuestionId,
  questionId,
  sanitizeCustomQuestions,
  type AnyCategoryKey,
  type Question,
  type QuestionType,
} from "./questions";
import { sanitizeHiddenCategories, toggleCategory } from "./visibility";
import type { BackupPayload } from "./stego";
import { emojisFromHandle } from "./handle";
import { normalizeTheme } from "./theme";



type Ctx = {
  state: AppState;
  ready: boolean;
  questions: Question[];
  patch: (p: Partial<AppState>) => void;
  setIdentity: (i: Identity) => void;
  setAnswer: (id: string, a: Partial<Answer>) => void;
  /** `type`: "similarity" (Normale, default) or "reciprocal" (Complementare, Fare/Ricevere). */
  addCustomQuestion: (category: AnyCategoryKey, text: string, type?: QuestionType) => void;
  /** Adds a contact's custom question to my profile, keeping its type. */
  ensureQuestion: (id: string, text: string, type?: QuestionType) => void;
  removeCustomQuestion: (id: string) => void;
  /** `defaultOpen`: state of a drawer never toggled (main: open, Erotismo: closed). */
  toggleDrawer: (key: string, defaultOpen?: boolean) => void;
  setDrawers: (keys: string[], open: boolean) => void;
  /** Hides/restores a whole category; per-question hidden flags are left untouched. */
  toggleCategoryHidden: (key: string) => void;
  toggleMode: () => void;
  addEmojisToCollection: (emojis: string[]) => void;
  addRequest: (r: ConnectionRequest) => void;
  removeRequest: (handle: string) => void;
  updateRequest: (handle: string, patch: Partial<ConnectionRequest>) => void;
  acceptRequest: (handle: string) => void;
  upsertContact: (c: Contact) => void;
  updateContact: (handle: string, patch: Partial<Contact>) => void;
  removeContact: (handle: string) => void;
  /** Local-only favorite star (never shared). */
  toggleFavorite: (handle: string) => void;
  mySnapshot: () => ProfileSnapshot;
  applyBackup: (payload: BackupPayload) => void;
  resetProfile: () => Promise<void>;
};

/** The shareable profile: contacts and favorites are never included. */
export function buildSnapshot(state: AppState, now = Date.now()): ProfileSnapshot {
  return {
    name: state.identity?.name ?? "",
    bio: state.bio,
    tags: state.tags,
    answers: state.answers,
    hiddenCategories: state.hiddenCategories,
    customQuestions: state.customQuestions,
    updatedAt: now,
  };
}

// Keep one context instance across hot-module reloads: when a dependency (e.g. questions.ts)
// changes, this module re-runs and a fresh createContext would orphan the mounted provider.
const ctxHolder = globalThis as unknown as { __questionarStoreCtx?: import("react").Context<Ctx | null> };
const StoreContext = (ctxHolder.__questionarStoreCtx ??= createContext<Ctx | null>(null));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    loadState<AppState>().then((saved) => {
      if (!alive) return;
      if (saved) {
        setState({
          ...EMPTY_STATE,
          ...saved,
          tags: { ...EMPTY_STATE.tags, ...(saved.tags ?? {}) },
          answers: sanitizeAnswers(saved.answers),
          // Custom questions saved before types existed load as Normale.
          customQuestions: sanitizeCustomQuestions(saved.customQuestions),
          hiddenCategories: sanitizeHiddenCategories(saved.hiddenCategories),
          theme: normalizeTheme(saved.theme),
          contacts: (saved.contacts ?? []).map(migrateContact),
          requests: (saved.requests ?? []).map(migrateRequest),
          network: {},
        });
      }
      loaded.current = true;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !loaded.current) return;
    void saveState(state);
  }, [state, ready]);

  // Apply theme to the document
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme.mode === "dark");
  }, [state.theme]);

  const patch = useCallback((p: Partial<AppState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const value = useMemo<Ctx>(() => {
    const questions = [...DEFAULT_QUESTIONS, ...state.customQuestions];
    return {
      state,
      ready,
      questions,
      patch,
      setIdentity: (identity) => patch({ identity }),
      setAnswer: (id, a) =>
        setState((s) => {
          const prev: Answer = s.answers[id] ?? { value: 50, answered: false };
          return { ...s, answers: { ...s.answers, [id]: { ...prev, ...a } } };
        }),
      addCustomQuestion: (category, text, type = "similarity") =>
        setState((s) => {
          const id = questionId(category, text);
          if (s.customQuestions.some((q) => q.id === id) || isDefaultQuestionId(id)) return s;
          return {
            ...s,
            customQuestions: [
              ...s.customQuestions,
              {
                id,
                category,
                text,
                custom: true,
                type: type === "reciprocal" ? "reciprocal" : "similarity",
              },
            ],
          };
        }),
      ensureQuestion: (id, text, type = "similarity") =>
        setState((s) => {
          if (
            DEFAULT_QUESTIONS.some((q) => q.id === id) ||
            s.customQuestions.some((q) => q.id === id)
          )
            return s;
          const letter = id.split("-")[0] as AnyCategoryKey;
          const category = ALL_CATEGORIES.some((c) => c.key === letter) ? letter : "J";
          return {
            ...s,
            customQuestions: [
              ...s.customQuestions,
              {
                id,
                category,
                text,
                custom: true,
                type: type === "reciprocal" ? "reciprocal" : "similarity",
              },
            ],
          };
        }),
      removeCustomQuestion: (id) =>
        setState((s) => {
          const answers = { ...s.answers };
          delete answers[id];
          return {
            ...s,
            answers,
            customQuestions: s.customQuestions.filter((q) => q.id !== id),
          };
        }),
      toggleDrawer: (key, defaultOpen = true) =>
        setState((s) => ({
          ...s,
          openDrawers: { ...s.openDrawers, [key]: !(s.openDrawers[key] ?? defaultOpen) },
        })),
      setDrawers: (keys, open) =>
        setState((s) => ({
          ...s,
          openDrawers: { ...s.openDrawers, ...Object.fromEntries(keys.map((k) => [k, open])) },
        })),
      toggleCategoryHidden: (key) =>
        setState((s) => ({ ...s, hiddenCategories: toggleCategory(s.hiddenCategories, key) })),
      toggleMode: () =>
        setState((s) => ({
          ...s,
          theme: { ...s.theme, mode: s.theme.mode === "dark" ? "light" : "dark" },
        })),
      addEmojisToCollection: (emojis) =>
        setState((s) => ({
          ...s,
          emojiCollection: Array.from(new Set([...s.emojiCollection, ...emojis])),
        })),
      addRequest: (r) =>
        setState((s) => {
          if (
            s.requests.some((x) => x.handle === r.handle) ||
            s.contacts.some((c) => c.handle === r.handle)
          )
            return s;
          return { ...s, requests: [...s.requests, r] };
        }),
      removeRequest: (handle) =>
        setState((s) => ({
          ...s,
          requests: s.requests.filter((r) => r.handle !== handle),
        })),
      updateRequest: (handle, p) =>
        setState((s) => ({
          ...s,
          requests: s.requests.map((r) => (r.handle === handle ? { ...r, ...p } : r)),
        })),
      acceptRequest: (handle) =>
        setState((s) => {
          const req = s.requests.find((r) => r.handle === handle);
          if (!req) return s;
          const contact: Contact = {
            handle: req.handle,
            name: req.name,
            emojis: req.emojis,
            ...(req.snapshot ? { snapshot: req.snapshot } : {}),
            ...(req.publicKey ? { publicKey: req.publicKey } : {}),
            ...(req.keyVerified ? { keyVerified: true } : {}),
            roomKey: handle,
            online: true,
          };
          return {
            ...s,
            requests: s.requests.filter((r) => r.handle !== handle),
            contacts: [...s.contacts.filter((c) => c.handle !== handle), contact],
            emojiCollection: Array.from(
              new Set([...s.emojiCollection, ...emojisFromHandle(handle)]),
            ),
          };
        }),
      upsertContact: (c) =>
        setState((s) => ({
          ...s,
          contacts: [
            ...s.contacts.filter((x) => x.handle !== c.handle),
            { ...s.contacts.find((x) => x.handle === c.handle), ...c },
          ],
          emojiCollection: Array.from(
            new Set([...s.emojiCollection, ...emojisFromHandle(c.handle)]),
          ),
        })),
      updateContact: (handle, p) =>
        setState((s) => ({
          ...s,
          contacts: s.contacts.map((c) => (c.handle === handle ? { ...c, ...p } : c)),
        })),
      removeContact: (handle) =>
        setState((s) => ({
          ...s,
          contacts: s.contacts.filter((c) => c.handle !== handle),
        })),
      toggleFavorite: (handle) =>
        setState((s) => ({
          ...s,
          contacts: s.contacts.map((c) =>
            c.handle === handle ? { ...c, favorite: !c.favorite } : c,
          ),
        })),
      mySnapshot: () =>
        buildSnapshot(state),
      applyBackup: (payload) =>
        setState((s) => {
          // Identity, emoji, avatar, keys, collection and contacts stay untouched.
          const custom = [...s.customQuestions];
          // Only valid definitions and types are accepted; a question already on this
          // profile keeps its own definition (and type).
          for (const q of sanitizeCustomQuestions(payload.customQuestions)) {
            if (!custom.some((x) => x.id === q.id)) custom.push(q);
          }
          return {
            ...s,
            answers: { ...s.answers, ...sanitizeAnswers(payload.answers) },
            ...(Array.isArray(payload.hiddenCategories)
              ? { hiddenCategories: sanitizeHiddenCategories(payload.hiddenCategories) }
              : {}),
            tags: { ...EMPTY_STATE.tags, ...(payload.tags ?? {}) },
            customQuestions: custom,
          };
        }),
      resetProfile: async () => {
        await clearState();
        setState(EMPTY_STATE);
      },
    };
  }, [state, ready, patch]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { handleOf };
export { emojisFromHandle };
