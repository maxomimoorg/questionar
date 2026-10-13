import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DemoProfileTags, InfoModal } from "@/components/InfoModal";

afterEach(cleanup);

describe("QuestionAR tutorial", () => {
  it("demonstrates the complete three-state cycle without changing saved profile data", () => {
    render(<DemoProfileTags />);
    expect(screen.getByRole("button", { name: "tabacco: divieto" }).querySelector(".lucide-ban")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "vegan: spunta" }));
    fireEvent.click(screen.getByRole("button", { name: "vegan: divieto" }));
    fireEvent.click(screen.getByRole("button", { name: "vegan: senza risposta" }));
    expect(screen.getByRole("button", { name: "vegan: spunta" })).toBeTruthy();
  });

  it("documents all requested features and closes with Escape", () => {
    const onClose = vi.fn();
    render(<InfoModal onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "QuestionAR" });
    for (const title of ["Tag del profilo", "Domande personalizzate", "Confronto a tre", "Zero-server", "collezione emoji"]) {
      expect(within(dialog).getByRole("heading", { name: new RegExp(title, "i") })).toBeTruthy();
    }
    expect(dialog).toHaveTextContent("666 caratteri");
    expect(dialog).toHaveTextContent("IndexedDB");
    expect(dialog).toHaveTextContent("Nascondere non significa cifrare");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});