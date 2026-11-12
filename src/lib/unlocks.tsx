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

import { boxOf, type UnlockedSections } from "./protection";
import { PROTECTED_SECTIONS, type ProtectedSection } from "./questions";
import { useStore } from "./store";
import { idbUnlockStorage, type UnlockStorage } from "./unlock-db";
import { UnlockManager, type UnlockResult } from "./unlock-manager";

type UnlockCtx = {
  /** Opened compartments per contact handle; decrypted data lives only in memory. */
  unlocked: Record<string, UnlockedSections>;
  /** Tries the password a contact communicated for one of their protected questionnaires. */
  unlock: (
    handle: string,
    section: ProtectedSection,
    password: string,
  ) => Promise<UnlockResult | { status: "missing" }>;
  waitSeconds: (handle: string, section: ProtectedSection) => number;
};

const UnlockContext = createContext<UnlockCtx | null>(null);

/**
 * Opens contacts' protected questionnaires with keys saved on this device, re-opening them
 * whenever a contact sends an updated profile. A new keyVersion (changed password) locks again.
 */
export function UnlockProvider({
  children,
  storage = idbUnlockStorage,
}: {
  children: ReactNode;
  storage?: UnlockStorage;
}) {
  const { state } = useStore();
  const manager = useMemo(() => new UnlockManager(storage), [storage]);
  const [unlocked, setUnlocked] = useState<Record<string, UnlockedSections>>({});
  // Box (iv) last opened or tried per handle|section, so each received box is processed once.
  const seen = useRef(new Map<string, string>());

  const setSection = useCallback(
    (handle: string, section: ProtectedSection, payload: UnlockedSections[ProtectedSection]) =>
      setUnlocked((cur) => {
        const sections = { ...(cur[handle] ?? {}) };
        if (payload) sections[section] = payload;
        else delete sections[section];
        return { ...cur, [handle]: sections };
      }),
    [],
  );

  useEffect(() => {
    for (const contact of state.contacts) {
      for (const section of PROTECTED_SECTIONS) {
        const id = `${contact.handle}|${section}`;
        const box = boxOf(contact.snapshot, section);
        if (!box) {
          if (seen.current.has(id)) {
            seen.current.delete(id);
            setSection(contact.handle, section, undefined);
          }
          continue;
        }
        const tag = `${box.keyVersion}|${box.iv}`;
        if (seen.current.get(id) === tag) continue;
        seen.current.set(id, tag);
        void manager.restore(contact.handle, section, box).then((payload) => {
          // Ignore a result overtaken by a newer box of the same contact.
          if (seen.current.get(id) === tag)
            setSection(contact.handle, section, payload ?? undefined);
        });
      }
    }
  }, [state.contacts, manager, setSection]);

  const contactsRef = useRef(state.contacts);
  contactsRef.current = state.contacts;

  const value = useMemo<UnlockCtx>(
    () => ({
      unlocked,
      waitSeconds: (handle, section) => manager.waitSeconds(handle, section),
      unlock: async (handle, section, password) => {
        const contact = contactsRef.current.find((c) => c.handle === handle);
        const box = boxOf(contact?.snapshot, section);
        if (!box) return { status: "missing" as const };
        const result = await manager.unlock(handle, section, box, password);
        if (result.status === "ok") {
          seen.current.set(`${handle}|${section}`, `${box.keyVersion}|${box.iv}`);
          setSection(handle, section, result.payload);
        }
        return result;
      },
    }),
    [unlocked, manager, setSection],
  );

  return <UnlockContext.Provider value={value}>{children}</UnlockContext.Provider>;
}

export function useUnlocks() {
  const ctx = useContext(UnlockContext);
  if (!ctx) throw new Error("useUnlocks must be used inside UnlockProvider");
  return ctx;
}
