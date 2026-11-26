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
  sanitizeProtection,
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
  type ProtectedSection,
  type QuestionType,
} from "./questions";
import { protectSnapshot, withPassword, withoutPassword, type SectionPayload } from "./protection";
import { idbUnlockStorage } from "./unlock-db";
import { sanitizeHiddenCategories, toggleCategory } from "./visibility";
import { clearAnswers } from "./answer-reset";
import type { BackupPayload } from "./stego";
import { emojisFromHandle } from "./handle";
import { normalizeTheme } from "./theme";
import { sanitizeBio } from "./bio";
import { sanitizeProfileTags } from "./profile-tags";

type Ctx = {
  state: AppState;
  ready: boolean;
  /** The saved profile exists but could not be read: nothing is saved until `retryLoad` works. */
  loadError: boolean;
  retryLoad: () => void;
  questions: Question[];
  patch: (p: Partial<AppState>) => void;
  setIdentity: (i: Identity) => void;
  setAnswer: (id: string, a: Partial<Answer>) => void;
  /** `type`: "similarity" (Normale, default) or "reciprocal" (Complementare, Fare/Ricevere). */
  addCustomQuestion: (category: AnyCategoryKey, text: string, type?: QuestionType) => void;
  /** Adds a contact's custom question to my profile, keeping its type. */
  ensureQuestion: (id: string, text: string, type?: QuestionType) => void;
  removeCustomQuestion: (id: string) => void;
  /** Brings these answers back to the never-answered state (long press on an eye button). */
  clearAnswers: (ids: string[]) => void;
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
  /**
   * The profile as it leaves the device (P2P, PNG): password-protected sections are encrypted.
   * Always async, so nothing can share an unencrypted protected section by mistake.
   */
  mySnapshot: () => Promise<ProfileSnapshot>;
  /** Sets or changes the password of one questionnaire (new salt and keyVersion). */
  setSectionPassword: (section: ProtectedSection, password: string) => void;
  removeSectionPassword: (section: ProtectedSection) => void;
  /**
   * `restored`: protected sections of my own backup opened with my password; their data is
   * merged and the same password (salt, keyVersion) becomes active again on this device.
   */
  applyBackup: (payload: BackupPayload, restored?: RestoredSection[]) => void;
  resetProfile: () => Promise<void>;
};

export type RestoredSection = {
  section: ProtectedSection;
  password: string;
  salt: string;
  keyVersion: number;
  payload: SectionPayload;
};

const LOAD_FAILED = Symbol("load-failed");
const LOAD_RETRY_DELAYS = [300, 1000];

/**
 * Reads the saved state, retrying short transient IndexedDB failures. Resolves null only when
 * there really is no saved profile, and LOAD_FAILED when every attempt failed.
 */
async function readSavedState(alive: () => boolean): Promise<AppState | null | typeof LOAD_FAILED> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await loadState<AppState>();
    } catch {
      const wait = LOAD_RETRY_DELAYS[attempt];
      if (wait === undefined || !alive()) return LOAD_FAILED;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** The shareable profile in clear: contacts, favorites and passwords are never included. */
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
const ctxHolder = globalThis as unknown as {
  __questionarStoreCtx?: import("react").Context<Ctx | null>;
};
const StoreContext = (ctxHolder.__questionarStoreCtx ??= createContext<Ctx | null>(null));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loaded = useRef(false);
  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoadAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    void readSavedState(() => alive).then((saved) => {
      if (!alive) return;
      if (saved === LOAD_FAILED) {
        // Never fall back to an empty profile: saving stays off until a read succeeds.
        setLoadError(true);
        return;
      }
      if (saved) {
        setState({
          ...EMPTY_STATE,
          ...saved,
          bio: sanitizeBio(saved.bio),
          tags: { ...EMPTY_STATE.tags, ...(sanitizeProfileTags(saved.tags) ?? {}) },
          answers: sanitizeAnswers(saved.answers),
          // Custom questions saved before types existed load as Normale.
          customQuestions: sanitizeCustomQuestions(saved.customQuestions),
          hiddenCategories: sanitizeHiddenCategories(saved.hiddenCategories),
          theme: normalizeTheme(saved.theme),
          contacts: (saved.contacts ?? []).map(migrateContact),
          requests: (saved.requests ?? []).map(migrateRequest),
          network: {},
          protection: sanitizeProtection(saved.protection),
        });
      }
      loaded.current = true;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [loadAttempt]);

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
      loadError,
      retryLoad,
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
      clearAnswers: (ids) => setState((s) => ({ ...s, answers: clearAnswers(s.answers, ids) })),
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
      mySnapshot: () => protectSnapshot(buildSnapshot(state), state.protection, questions),
      setSectionPassword: (section, password) =>
        setState((s) => ({ ...s, protection: withPassword(s.protection, section, password) })),
      removeSectionPassword: (section) =>
        setState((s) => ({ ...s, protection: withoutPassword(s.protection, section) })),
      applyBackup: (payload, restored = []) =>
        setState((s) => {
          // Identity, emoji, avatar, keys, collection and contacts stay untouched.
          const custom = [...s.customQuestions];
          // Only valid definitions and types are accepted; a question already on this
          // profile keeps its own definition (and type).
          const restoredQuestions = restored.flatMap((r) => r.payload.customQuestions);
          for (const q of [
            ...sanitizeCustomQuestions(payload.customQuestions),
            ...restoredQuestions,
          ]) {
            if (!custom.some((x) => x.id === q.id)) custom.push(q);
          }
          let protection = s.protection;
          for (const r of restored) {
            protection = {
              ...protection,
              [r.section]: { password: r.password, salt: r.salt, keyVersion: r.keyVersion },
              lastVersion: {
                ...protection.lastVersion,
                [r.section]: Math.max(protection.lastVersion?.[r.section] ?? 0, r.keyVersion),
              },
            };
          }
          return {
            ...s,
            protection,
            answers: {
              ...s.answers,
              ...sanitizeAnswers(payload.answers),
              ...Object.assign({}, ...restored.map((r) => r.payload.answers)),
            },
            ...(Array.isArray(payload.hiddenCategories)
              ? { hiddenCategories: sanitizeHiddenCategories(payload.hiddenCategories) }
              : {}),
            tags: { ...EMPTY_STATE.tags, ...(sanitizeProfileTags(payload.tags) ?? {}) },
            customQuestions: custom,
          };
        }),
      resetProfile: async () => {
        await clearState();
        await idbUnlockStorage.clear();
        setState(EMPTY_STATE);
      },
    };
  }, [state, ready, loadError, retryLoad, patch]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { handleOf };
export { emojisFromHandle };
