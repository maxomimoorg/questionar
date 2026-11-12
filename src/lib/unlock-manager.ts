// Opening contacts' protected questionnaires: saved keys, password attempts with a progressive
// delay against brute force, and invalidation when the contact changes password (keyVersion).

import { WrongPasswordError, type ProtectedBox } from "./password-crypto";
import {
  attemptDelaySeconds,
  openSection,
  openSectionWithPassword,
  type SectionPayload,
} from "./protection";
import type { ProtectedSection } from "./questions";
import type { UnlockStorage } from "./unlock-db";

export type UnlockResult =
  | { status: "ok"; payload: SectionPayload }
  /** Wrong password; the next attempt is allowed after `waitSeconds`. */
  | { status: "wrong"; waitSeconds: number }
  /** Too soon after a wrong attempt: nothing was tried. */
  | { status: "wait"; waitSeconds: number };

export class UnlockManager {
  private failures = new Map<string, { count: number; until: number }>();

  constructor(
    private storage: UnlockStorage,
    private now: () => number = () => Date.now(),
  ) {}

  private id(handle: string, section: ProtectedSection) {
    return `${handle}|${section}`;
  }

  /** Seconds still to wait before a new attempt (0 = allowed now). */
  waitSeconds(handle: string, section: ProtectedSection): number {
    const f = this.failures.get(this.id(handle, section));
    if (!f) return 0;
    return Math.max(0, Math.ceil((f.until - this.now()) / 1000));
  }

  /**
   * Opens a box with the key saved for this contact, if it still matches the box's keyVersion
   * and salt. A stale or unusable key is deleted, so the password is asked again.
   */
  async restore(
    handle: string,
    section: ProtectedSection,
    box: ProtectedBox,
  ): Promise<SectionPayload | null> {
    const saved = await this.storage.get(handle, section);
    if (!saved) return null;
    if (saved.keyVersion !== box.keyVersion || saved.salt !== box.salt) {
      await this.storage.remove(handle, section);
      return null;
    }
    try {
      return await openSection(saved.key, box, section);
    } catch {
      await this.storage.remove(handle, section);
      return null;
    }
  }

  /** Tries a password communicated by the contact; on success the key is saved locally. */
  async unlock(
    handle: string,
    section: ProtectedSection,
    box: ProtectedBox,
    password: string,
  ): Promise<UnlockResult> {
    const wait = this.waitSeconds(handle, section);
    if (wait > 0) return { status: "wait", waitSeconds: wait };
    const id = this.id(handle, section);
    try {
      const { key, payload } = await openSectionWithPassword(password, box, section);
      this.failures.delete(id);
      await this.storage.put({
        handle,
        section,
        keyVersion: box.keyVersion,
        salt: box.salt,
        key,
        savedAt: this.now(),
      });
      return { status: "ok", payload };
    } catch (err) {
      if (!(err instanceof WrongPasswordError)) throw err;
      const count = (this.failures.get(id)?.count ?? 0) + 1;
      const waitSeconds = attemptDelaySeconds(count);
      this.failures.set(id, { count, until: this.now() + waitSeconds * 1000 });
      return { status: "wrong", waitSeconds };
    }
  }

  /** Forgets the saved key of one contact's section. */
  forget(handle: string, section: ProtectedSection) {
    return this.storage.remove(handle, section);
  }
}
