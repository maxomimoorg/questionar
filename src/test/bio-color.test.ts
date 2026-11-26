import { afterEach, describe, expect, it, vi } from "vitest";

import { removeBioColor, sanitizeBio } from "@/lib/bio";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Bio · rimozione del colore", () => {
  it("con il cursore in mezzo a un testo colorato, il testo nuovo resta fuori dagli span", () => {
    const editor = document.createElement("div");
    editor.innerHTML = '<span style="color: #ff3131">rosso</span>';
    document.body.appendChild(editor);
    const text = editor.querySelector("span")!.firstChild!;
    const selection = window.getSelection()!;
    selection.collapse(text, 2);

    removeBioColor(editor);

    expect(selection.anchorNode).toBe(editor);
    for (const data of [" normale ", "!"]) {
      editor.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data,
        }),
      );
    }
    expect(editor.innerHTML).toBe(
      '<span style="color: #ff3131">ro</span> normale !<span style="color: #ff3131">sso</span>',
    );
    expect(sanitizeBio(editor.innerHTML)).toBe(
      '<span style="color: #ff3131">ro</span> normale !<span style="color: #ff3131">sso</span>',
    );
  });

  it("su una selezione usa removeFormat e non imposta alcun rosso o inherit", () => {
    const editor = document.createElement("div");
    editor.innerHTML = '<span style="color: #ff3131">rosso</span>';
    document.body.appendChild(editor);
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(editor.querySelector("span")!);
    selection.removeAllRanges();
    selection.addRange(range);
    const exec = vi.fn();
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });

    removeBioColor(editor);

    expect(exec.mock.calls.map((call) => call[0])).toEqual([
      "styleWithCSS",
      "removeFormat",
      "styleWithCSS",
    ]);
    expect(exec.mock.calls.flat()).not.toContain("#ff3131");
    expect(exec.mock.calls.flat()).not.toContain("inherit");
    expect(editor.querySelector("span")?.style.color).toBe("");
  });

  it("rimuove style.color e attributo color da span e font nella selezione anche se removeFormat li lascia", () => {
    const editor = document.createElement("div");
    editor.innerHTML =
      '<span style="color: #ff3131">uno</span><font color="#0cc0df" style="color: #0cc0df">due</font><span style="color: #38b6ff">fuori</span>';
    document.body.appendChild(editor);
    const selection = window.getSelection()!;
    const range = document.createRange();
    const [firstSpan, secondFont] = [editor.querySelector("span")!, editor.querySelector("font")!];
    range.setStart(firstSpan.firstChild!, 0);
    range.setEnd(secondFont.firstChild!, secondFont.textContent!.length);
    selection.removeAllRanges();
    selection.addRange(range);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn() });

    removeBioColor(editor);

    expect(firstSpan.style.color).toBe("");
    expect(secondFont.style.color).toBe("");
    expect(secondFont.getAttribute("color")).toBeNull();
    expect(editor.querySelectorAll("span")[1]?.style.color).not.toBe("");
  });

  it("il sanitizzatore conserva testo normale e colori validi, ma elimina inherit", () => {
    expect(sanitizeBio("testo normale")).toBe("testo normale");
    expect(sanitizeBio('<span style="color: #0cc0df">azzurro</span>')).toBe(
      '<span style="color: #0cc0df">azzurro</span>',
    );
    expect(sanitizeBio('<span style="color: inherit">normale</span>')).toBe("normale");
    expect(sanitizeBio('<span style="color: #ff3131"></span>normale')).toBe("normale");
  });
});
