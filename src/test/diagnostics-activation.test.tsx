import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createTapCounter } from "@/lib/diagnostics/activation";
import { InfoModal } from "@/components/InfoModal";
import { DiagnosticsBadge } from "@/components/diagnostics/DiagnosticsBadge";
import { endDiagnostics, getDiagState } from "@/lib/diagnostics/session";

afterEach(() => {
  cleanup();
  endDiagnostics();
});

describe("diagnostic activation", () => {
  it("activates only on the 5th quick tap", () => {
    let t = 0;
    const c = createTapCounter({ now: () => t });
    const results = [0, 1, 2, 3, 4].map(() => ((t += 200), c.tap()));
    expect(results).toEqual([false, false, false, false, true]);
  });

  it("ignores slow taps (accidental activation)", () => {
    let t = 0;
    const c = createTapCounter({ now: () => t });
    for (let i = 0; i < 10; i++) {
      t += 1000;
      expect(c.tap()).toBe(false);
    }
  });

  it("4 taps leave the info popup and app unchanged", () => {
    const onClose = vi.fn();
    render(<InfoModal onClose={onClose} />);
    const title = screen.getByRole("heading", { level: 1, name: "QuestionAR" });
    for (let i = 0; i < 4; i++) fireEvent.click(title);
    expect(getDiagState().active).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("5 taps start diagnostics, show the indicator and do not download anything", () => {
    const createUrl = vi.fn();
    URL.createObjectURL = createUrl;
    const onClose = vi.fn();
    render(<InfoModal onClose={onClose} />);
    render(<DiagnosticsBadge />);
    const title = screen.getByRole("heading", { level: 1, name: "QuestionAR" });
    for (let i = 0; i < 5; i++) fireEvent.click(title);
    expect(getDiagState().active).toBe(true);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText("Modalità diagnostica attiva")).toBeInTheDocument();
    expect(createUrl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Termina la modalità diagnostica" }));
    expect(getDiagState().active).toBe(false);
  });
});
