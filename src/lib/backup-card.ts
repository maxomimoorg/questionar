import type { BackupPayload } from "./stego";
import { avatarDataUri } from "./avatar";
import { PROFILE_TAGS } from "@/lib/profile-tags";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

type TextStyle = {
  color: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  heading: boolean;
};
type Glyph = TextStyle & { text: string; width: number };

const graphemes = (text: string) =>
  Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (part) => part.segment,
  );
const isEmoji = (text: string) =>
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(text);
const emojiFont = (size: number) =>
  `400 ${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  family: string,
) {
  const parts = graphemes(text);
  const font = (part: string) => (isEmoji(part) ? emojiFont(size) : `700 ${size}px ${family}`);
  const measure = () =>
    parts.map((part) => {
      ctx.font = font(part);
      return ctx.measureText(part).width;
    });
  let widths = measure();
  while (widths.reduce((sum, w) => sum + w, 0) > width && size > 10) {
    size--;
    widths = measure();
  }
  let left = x - widths.reduce((sum, w) => sum + w, 0) / 2;
  ctx.textAlign = "left";
  parts.forEach((part, index) => {
    ctx.font = font(part);
    ctx.fillText(part, left, y);
    left += widths[index] ?? 0;
  });
}

function contextOf(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
  return ctx;
}

async function imageFrom(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Immagine non disponibile");
  const blob = await response.blob();
  if (blob.type.includes("svg")) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  return createImageBitmap(blob);
}

/** Render editor HTML as styled text only: never execute or load embedded content. */
function drawBio(
  ctx: CanvasRenderingContext2D,
  html: string,
  family: string,
  display: string,
  color: string,
  maxLines = 3,
) {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const lines: Glyph[][] = [[]];
  let width = 0;
  const font = (s: TextStyle) =>
    `${s.italic ? "italic " : ""}${s.bold ? 700 : 400} ${s.heading ? 26 : 22}px ${s.heading ? display : family}`;
  const newline = () => {
    lines.push([]);
    width = 0;
  };
  const append = (text: string, style: TextStyle) => {
    for (const char of graphemes(text)) {
      if (char === "\n") {
        newline();
        continue;
      }
      const glyphStyle = isEmoji(char)
        ? { ...style, bold: false, italic: false, strike: false }
        : style;
      ctx.font = isEmoji(char) ? emojiFont(style.heading ? 26 : 22) : font(style);
      const w = ctx.measureText(char).width;
      if (width + w > 572) newline();
      lines.at(-1)?.push({ ...glyphStyle, text: char, width: w });
      width += w;
    }
  };
  const walk = (node: Node, inherited: TextStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent ?? "", inherited);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "img"].includes(tag)) return;
    if (tag === "br") {
      newline();
      return;
    }
    const block = ["div", "p", "h1", "h2", "h3", "li"].includes(tag);
    if (block && (lines.at(-1)?.length ?? 0) > 0) newline();
    const requestedColor = node.style.color || node.getAttribute("color");
    const style: TextStyle = {
      color:
        requestedColor &&
        CSS.supports("color", requestedColor) &&
        !["inherit", "initial", "unset"].includes(requestedColor)
          ? requestedColor
          : inherited.color,
      bold:
        inherited.bold ||
        ["b", "strong", "h1", "h2", "h3"].includes(tag) ||
        ["bold", "700"].includes(node.style.fontWeight),
      italic: inherited.italic || ["i", "em"].includes(tag) || node.style.fontStyle === "italic",
      strike:
        inherited.strike ||
        ["s", "strike", "del"].includes(tag) ||
        node.style.textDecoration.includes("line-through"),
      heading: inherited.heading || ["h1", "h2", "h3"].includes(tag),
    };
    node.childNodes.forEach((child) => walk(child, style));
    if (block && (lines.at(-1)?.length ?? 0) > 0) newline();
  };
  const base = { color, bold: false, italic: false, strike: false, heading: false };
  root.childNodes.forEach((node) => walk(node, base));
  if (!lines.some((line) => line.some((glyph) => glyph.text.trim()))) {
    lines.splice(0, lines.length, []);
    width = 0;
    append("Nessuna bio.", base);
  }
  while (lines.length > 1 && lines.at(-1)?.length === 0) lines.pop();
  if (lines.length > maxLines) {
    const last = lines[maxLines - 1];
    if (last) {
      const style = last.at(-1) ?? base;
      ctx.font = font(style);
      const dots = ctx.measureText("...").width;
      let used = last.reduce((sum, g) => sum + g.width, 0);
      while (used + dots > 572 && last.length) used -= last.pop()?.width ?? 0;
      last.push({ ...style, text: "...", width: dots });
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  lines.slice(0, maxLines).forEach((line, index) => {
    let x = 64;
    const y = 902 + index * 30;
    for (const glyph of line) {
      ctx.font = isEmoji(glyph.text) ? emojiFont(glyph.heading ? 26 : 22) : font(glyph);
      ctx.fillStyle = glyph.color;
      ctx.fillText(glyph.text, x, y);
      if (glyph.strike) ctx.fillRect(x, y - 7, glyph.width, 1.5);
      x += glyph.width;
    }
  });
}

/** At most two rows, always leaving one line for the biography. */
export function layoutBackupTags(
  ctx: Pick<CanvasRenderingContext2D, "measureText" | "font">,
  labels: string[],
  family = '"Nunito", sans-serif',
) {
  let size = 18;
  ctx.font = `700 ${size}px ${family}`;
  const pack = () => {
    const rows: { label: string; width: number }[][] = [[]];
    let used = 0;
    for (const label of labels) {
      const width = ctx.measureText(label).width + 40;
      if (used && used + 8 + width > 572) {
        rows.push([]);
        used = 0;
      }
      rows.at(-1)?.push({ label, width });
      used += (used ? 8 : 0) + width;
    }
    return rows;
  };
  let rows = pack();
  while (rows.length > 2 && size > 12) {
    size--;
    ctx.font = `700 ${size}px ${family}`;
    rows = pack();
  }
  return { rows: labels.length ? rows : [], size };
}

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  payload: BackupPayload,
  family: string,
  display: string,
  token: (name: string) => string,
) {
  const tags = PROFILE_TAGS.filter((tag) => payload.tags?.[tag.id] === true);
  ctx.font = `700 18px ${family}`;
  const { rows, size } = layoutBackupTags(
    ctx,
    tags.map((tag) => tag.label),
    family,
  );
  drawBio(ctx, payload.bio, family, display, token("text"), 3 - rows.length);
  const icons = await Promise.all(
    tags.map(async (tag) => {
      const svg = renderToStaticMarkup(createElement(tag.icon, { color: token("name"), size: 18 }));
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return { label: tag.label, image };
      } finally {
        URL.revokeObjectURL(url);
      }
    }),
  );
  rows.forEach((row, index) => {
    let x = 64;
    const y = 902 + (3 - rows.length + index) * 30;
    for (const tag of row) {
      ctx.strokeStyle = token("name");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y - 21, tag.width, 28, 14);
      ctx.stroke();
      const icon = icons.find((icon) => icon.label === tag.label);
      if (icon) ctx.drawImage(icon.image, x + 8, y - 16, 18, 18);
      ctx.fillStyle = token("name");
      ctx.font = `700 ${size}px ${family}`;
      ctx.fillText(tag.label, x + 30, y);
      x += tag.width + 8;
    }
  });
}

export async function createBackupCard(payload: BackupPayload): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load('700 28px "Quicksand"'),
    document.fonts.load('400 22px "Nunito"'),
    document.fonts.load('700 22px "Nunito"'),
  ]);
  await document.fonts.ready;
  const [avatar, logo] = await Promise.all([
    // Generated on the device: the card works offline and the handle is never sent anywhere.
    imageFrom(avatarDataUri(payload.handle, 700)),
    imageFrom("/logo.png"),
  ]);
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--backup-${name}`).trim();
  const display = token("display-font");
  const body = token("body-font");
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 1000;
  const ctx = contextOf(canvas);
  ctx.fillStyle = token("background");
  ctx.fillRect(0, 0, 700, 1000);
  ctx.drawImage(logo, 40, 12, 108, 108);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = token("name");
  ctx.font = `700 19px ${display}`;
  ctx.fillText("QuestionAR", 94, 130);
  ctx.fillStyle = token("surface");
  ctx.beginPath();
  ctx.roundRect(180, 30, 340, 96, 48);
  ctx.fill();
  ctx.fillStyle = token("name");
  drawCenteredText(ctx, payload.name, 350, 61, 292, 28, display);
  ctx.fillStyle = token("handle");
  drawCenteredText(ctx, `@${payload.handle}`, 350, 98, 292, 22, body);
  const date = new Date(payload.savedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  ctx.fillStyle = token("text");
  drawCenteredText(
    ctx,
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`,
    606,
    61,
    132,
    20,
    display,
  );
  drawCenteredText(
    ctx,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    606,
    98,
    132,
    22,
    display,
  );
  ctx.save();
  ctx.beginPath();
  ctx.arc(350, 500, 300, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, 50, 200, 600, 600);
  ctx.restore();
  ctx.fillStyle = token("surface");
  ctx.beginPath();
  ctx.roundRect(28, 866, 644, 116, 58);
  ctx.fill();
  await drawFooter(ctx, payload, body, display, token);
  avatar.close();
  logo.close();
  return canvas;
}
