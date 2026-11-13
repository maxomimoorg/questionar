// Bio HTML allow-list. The bio comes from the owner's rich editor (BioEditor) but also from
// contacts (P2P snapshots, PNG cards), so it is untrusted: everything the editor cannot produce
// is dropped before it is stored or rendered with innerHTML.

/** Upper bound on the stored HTML; the editor itself limits the visible text to 666 characters. */
export const MAX_BIO_HTML = 12000;

/** Tags the editor produces (execCommand bold/italic/strike, formatBlock h2/p, link, color). */
const KEEP = new Set(["B", "STRONG", "I", "EM", "S", "STRIKE", "DEL", "U", "H2", "P", "DIV", "BR", "SPAN", "A"]);
/** Containers whose content is never shown: dropped with all their children. */
const DROP = new Set([
  "SCRIPT", "STYLE", "IFRAME", "FRAME", "FRAMESET", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE",
  "NOSCRIPT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "INPUT", "FORM", "LINK", "META", "BASE",
  "TITLE", "HEAD", "AUDIO", "VIDEO", "SOURCE", "TRACK", "CANVAS", "IMG", "PICTURE", "MAP", "PORTAL",
]);

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|inherit)$/i;

/** A text colour accepted from `style="color: …"` or `<font color>`; anything else is dropped. */
export function safeColor(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim();
  return COLOR.test(v) ? v.toLowerCase() : undefined;
}

/** Only absolute http(s) and mailto links; a bare domain typed in the editor gets https://. */
export function safeHref(value: string | null | undefined): string | undefined {
  const raw = (value ?? "").trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (!raw) return undefined;
  if (/^(https?:\/\/|mailto:)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return undefined; // javascript:, data:, vbscript:, …
  if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith(".")) return undefined;
  return `https://${raw}`;
}

function colorOf(el: Element): string | undefined {
  if (el.tagName === "FONT") return safeColor(el.getAttribute("color"));
  const style = el.getAttribute("style") ?? "";
  const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
  return safeColor(match?.[1]);
}

function copyChildren(from: Node, to: Node, doc: Document) {
  for (const child of Array.from(from.childNodes)) copyNode(child, to, doc);
}

function copyNode(node: Node, parent: Node, doc: Document) {
  if (node.nodeType === 3) {
    parent.appendChild(doc.createTextNode(node.textContent ?? ""));
    return;
  }
  if (node.nodeType !== 1) return; // comments, processing instructions, …
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag)) return;
  if (tag === "FONT" || tag === "SPAN") {
    const color = colorOf(el);
    if (!color) return copyChildren(el, parent, doc);
    const span = doc.createElement("span");
    span.setAttribute("style", `color: ${color}`);
    copyChildren(el, span, doc);
    parent.appendChild(span);
    return;
  }
  if (tag === "A") {
    const href = safeHref(el.getAttribute("href"));
    if (!href) return copyChildren(el, parent, doc);
    const a = doc.createElement("a");
    a.setAttribute("href", href);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer nofollow");
    copyChildren(el, a, doc);
    parent.appendChild(a);
    return;
  }
  if (!KEEP.has(tag)) return copyChildren(el, parent, doc);
  // Allowed structural/inline tag: rebuilt without any attribute (no on*, style, class, id…).
  const out = doc.createElement(tag.toLowerCase());
  copyChildren(el, out, doc);
  parent.appendChild(out);
}

function escapeText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Returns HTML containing only the editor's tags: no attributes except a safe text colour on
 * <span> and a safe http(s)/mailto href on <a>. Without a DOM parser (server render) the bio is
 * reduced to escaped plain text.
 */
export function sanitizeBio(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  const input = html.slice(0, MAX_BIO_HTML);
  if (typeof DOMParser === "undefined") {
    return escapeText(input.replace(/<[^>]*>?/g, ""));
  }
  // DOMParser documents are inert: scripts never run and images are never fetched.
  const parsed = new DOMParser().parseFromString(input, "text/html");
  const doc = document.implementation.createHTMLDocument("");
  const root = doc.createElement("div");
  copyChildren(parsed.body, root, doc);
  return root.innerHTML;
}
