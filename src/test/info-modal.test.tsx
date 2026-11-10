import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { InfoModal } from "@/components/InfoModal";
import { DemoCategories, DemoCritical, DemoProfileTags, DemoSimilarity } from "@/components/tutorial/demos";
import { questionCompat } from "@/lib/compat";
import { CATEGORIES } from "@/lib/questions";
import {
  TUTORIAL_CUSTOM_CATEGORY,
  TUTORIAL_LIST_CATEGORIES,
  TUTORIAL_MAP_CATEGORIES,
  TUTORIAL_QUESTIONS,
  findTutorialQuestion,
  type TutorialQuestionKey,
} from "@/components/tutorial/examples";

afterEach(cleanup);

const CHAPTERS: { title: RegExp; features: string[]; text?: string[] }[] = [
  { title: /Cos’è QuestionAR/, features: ["Una mappa, non un voto"] },
  {
    title: /Rispondere a modo tuo/,
    features: ["Sfumature", "Commenti", "Domande critiche", "Domande personalizzate", "La tua bio"],
    text: ["666 caratteri"],
  },
  { title: /Somiglianza e reciprocità/, features: ["Somiglianza", "Reciprocità: Fare e Ricevere"] },
  {
    title: /Connettersi e confrontare/,
    features: ["Tre modi per connettersi", "Richieste anche da offline", "Confronto a tre"],
    text: ["72 ore"],
  },
  {
    title: /I tuoi spazi/,
    features: ["Tag del profilo", "Domande nascoste", "Categorie: aprire, contare, nascondere", "Preferiti", "Erotismo, se vuoi"],
  },
  {
    title: /I tuoi dati restano tuoi/,
    features: ["Zero-server", "La scheda avatar", "La tua collezione emoji"],
    text: ["IndexedDB", "Nascondere non significa cifrare"],
  },
];

describe("QuestionAR tutorial", () => {
  it("demonstrates the complete three-state tag cycle without touching saved data", () => {
    render(<DemoProfileTags />);
    expect(screen.getByRole("button", { name: "tabacco: divieto" }).querySelector(".lucide-ban")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "vegan: spunta" }));
    fireEvent.click(screen.getByRole("button", { name: "vegan: divieto" }));
    fireEvent.click(screen.getByRole("button", { name: "vegan: senza risposta" }));
    expect(screen.getByRole("button", { name: "vegan: spunta" })).toBeTruthy();
  });

  it("has six chapters, each documenting its features, and closes with Escape", () => {
    const onClose = vi.fn();
    render(<InfoModal onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "QuestionAR" });
    expect(within(dialog).getAllByRole("heading", { level: 2 })).toHaveLength(6);
    for (const chapter of CHAPTERS) {
      const trigger = within(dialog).getByRole("button", { name: chapter.title });
      if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
      for (const feature of chapter.features) {
        expect(within(dialog).getByRole("heading", { level: 3, name: feature })).toBeTruthy();
      }
      for (const text of chapter.text ?? []) expect(dialog).toHaveTextContent(text);
    }
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("the critical demo uses the real maths: 80% vs 40% drops from 60% to 48%", () => {
    render(<DemoCritical />);
    const score = () => screen.getByTestId("demo-critical-score").textContent;
    expect(score()).toBe(`${questionCompat(80, 40, 0)}%`);
    expect(score()).toBe("60%");
    fireEvent.click(screen.getByRole("button", { name: "Segna come critica" }));
    expect(score()).toBe("48%");
  });

  it("the similarity demo starts from 80% vs 35% = 55%", () => {
    render(<DemoSimilarity />);
    expect(screen.getByTestId("demo-similarity-score")).toHaveTextContent("Compatibilità: 55%");
  });

  it("every question quoted by the demos exists in the app with the expected type", () => {
    for (const key of Object.keys(TUTORIAL_QUESTIONS) as TutorialQuestionKey[]) {
      const question = findTutorialQuestion(key);
      expect(question, `${key}: ${TUTORIAL_QUESTIONS[key].text}`).toBeDefined();
      expect(question!.type).toBe(TUTORIAL_QUESTIONS[key].type);
    }
  });

  it("every category quoted by the demos is a real main-questionnaire category", () => {
    const keys = CATEGORIES.map((c) => c.key as string);
    for (const key of [...TUTORIAL_MAP_CATEGORIES, ...TUTORIAL_LIST_CATEGORIES, TUTORIAL_CUSTOM_CATEGORY]) {
      expect(keys).toContain(key);
    }
  });

  it("the categories demo shows real names and real question counts", () => {
    render(<DemoCategories />);
    expect(screen.getByRole("button", { name: "Apri la categoria Impegno per la stabilità" })).toHaveTextContent("13 ✓");
    expect(screen.getByRole("button", { name: "Apri la categoria Tempo di qualità" })).toHaveTextContent("4/10");
  });
});
