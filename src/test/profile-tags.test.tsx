import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BioEditor } from "@/components/BioEditor";
import { CompactProfileTags } from "@/components/ProfileTags";
import { EMPTY_STATE } from "@/lib/types";
import { isActiveTag, nextTagState } from "@/lib/profile-tags";
import { layoutBackupTags } from "@/lib/backup-card";

const patch = vi.fn();
vi.mock("@/lib/store", () => ({ useStore: () => ({ state: { ...EMPTY_STATE, tags: { vegan: true, alcol: "cross" } }, patch }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("profile tags", () => {
  it("cycles unanswered → check → cross → unanswered, preserving legacy booleans", () => {
    expect(nextTagState(undefined)).toBe(true);
    expect(nextTagState(false)).toBe(true);
    expect(nextTagState(true)).toBe("cross");
    expect(nextTagState("cross")).toBe(false);
    expect(isActiveTag("cross")).toBe(true);
    expect(isActiveTag(false)).toBe(false);
  });
  it("moves tags between sections and saves the cross state", () => {
    Object.defineProperty(HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent ?? ""; } });
    render(<BioEditor onClose={vi.fn()} />);
    const unanswered = screen.getByRole("region", { name: "Senza risposta" });
    const active = screen.getByRole("region", { name: "Cosa mi caratterizza" });
    fireEvent.click(within(unanswered).getByRole("button", { name: "sport: senza risposta" }));
    fireEvent.click(within(active).getByRole("button", { name: "sport: spunta" }));
    const refused = within(active).getByRole("button", { name: "sport: divieto" });
    expect(refused).toHaveClass("profile-tag-cross");
    expect(refused.querySelector("svg.lucide-ban")).toBeTruthy();
    expect(refused.querySelector("svg.lucide-x")).toBeNull();
    fireEvent.click(refused);
    expect(within(unanswered).getByRole("button", { name: "sport: senza risposta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(patch.mock.calls[0]?.[0].tags).toMatchObject({ vegan: true, alcol: "cross", sport: false });
  });
  it("shows only active tags with their check or cross", () => {
    render(<CompactProfileTags tags={{ vegan: true, alcol: "cross", sport: false }} />);
    expect(screen.getByLabelText("vegan: spunta")).toBeTruthy();
    expect(screen.getByLabelText("alcol: divieto")).toBeTruthy();
    expect(screen.queryByText("sport")).toBeNull();
  });
  it("packs short tag sets in one row and full sets within two rows", () => {
    const ctx = { font: "", measureText(label: string) { return { width: label.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 18) * 0.5 } as TextMetrics; } };
    expect(layoutBackupTags(ctx, []).rows).toHaveLength(0);
    expect(layoutBackupTags(ctx, ["vegan", "sport"]).rows).toHaveLength(1);
    expect(layoutBackupTags(ctx, ["vegan", "animali", "tabacco", "alcol", "droghe", "sport", "non-monogamia", "prole", "queer", "spirituale", "attivista"]).rows).toHaveLength(2);
  });
});