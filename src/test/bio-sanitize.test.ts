import { describe, expect, it } from "vitest";

import { sanitizeBio, safeHref } from "@/lib/bio";
import { sanitizeSnapshot, type ProfileSnapshot } from "@/lib/types";

const snap = (extra: Partial<ProfileSnapshot> & Record<string, unknown>): ProfileSnapshot =>
  ({ name: "x", bio: "", answers: {}, customQuestions: [], updatedAt: 1, ...extra }) as ProfileSnapshot;

describe("bio allow-list", () => {
  it("removes event handlers and script-like elements", () => {
    const out = sanitizeBio('<img src=x onerror="alert(1)"><script>alert(2)</script><b onclick="x()">ciao</b>');
    expect(out).toBe("<b>ciao</b>");
  });

  it("drops javascript: and data: links but keeps their text", () => {
    expect(sanitizeBio('<a href="javascript:alert(1)">qui</a>')).toBe("qui");
    expect(sanitizeBio('<a href=" JaVaScRiPt:alert(1)">qui</a>')).toBe("qui");
    expect(sanitizeBio('<a href="data:text/html,x">qui</a>')).toBe("qui");
  });

  it("keeps https links, opened safely in a new tab", () => {
    expect(sanitizeBio('<a href="https://maxomimo.org" style="x">sito</a>')).toBe(
      '<a href="https://maxomimo.org" target="_blank" rel="noopener noreferrer nofollow">sito</a>',
    );
    expect(safeHref("example.com")).toBe("https://example.com");
  });

  it("keeps editor formatting and only a plain text colour", () => {
    expect(sanitizeBio('<h2>Titolo</h2><p><i>a</i><strike>b</strike><br></p>')).toBe(
      "<h2>Titolo</h2><p><i>a</i><strike>b</strike><br></p>",
    );
    expect(sanitizeBio('<span style="color: #ff00aa; background:url(x)">r</span>')).toBe(
      '<span style="color: #ff00aa">r</span>',
    );
    expect(sanitizeBio('<font color="#00ccaa">t</font>')).toBe('<span style="color: #00ccaa">t</span>');
    expect(sanitizeBio('<span style="color: expression(alert(1))">r</span>')).toBe("r");
  });

  it("cleans bios received from contacts", () => {
    const out = sanitizeSnapshot(snap({ bio: '<svg onload="alert(1)"></svg><u>ok</u>' }));
    expect(out.bio).toBe("<u>ok</u>");
  });
});

describe("profile tags in snapshots", () => {
  it("keeps only known tags with true, false or cross", () => {
    const out = sanitizeSnapshot(
      snap({ tags: { vegan: true, alcol: "cross", sport: false, droghe: "maybe", inventato: true, __proto__x: 1 } as never }),
    );
    expect(out.tags).toEqual({ vegan: true, alcol: "cross", sport: false });
  });

  it("drops a tags field that is not an object", () => {
    expect(sanitizeSnapshot(snap({ tags: "vegan" as never })).tags).toBeUndefined();
  });
});
