// Plain-text profile backup (PDF, DOCX, CSV, XLSX) offered by diagnostic mode.
// Everything is built in the browser from the local state and saved through a Blob download:
// no network request is ever made, consistent with the zero-server architecture.

import { sanitizeBio } from "../bio";
import { isActiveTag, PROFILE_TAGS } from "../profile-tags";
import {
  ALL_CATEGORIES,
  categoryOfId,
  isEroticQuestionId,
  isReciprocal,
  type Question,
} from "../questions";
import { giveOf, handleOf, receiveOf, type AppState } from "../types";

export type BioRun = { text: string; bold?: boolean; italic?: boolean; strike?: boolean };
export type BioBlock = { heading: boolean; runs: BioRun[] };

export type BackupRow = {
  section: string;
  category: string;
  question: string;
  /** Normal answers. */
  value?: number;
  /** Reciprocal (Fare/Ricevere) answers; an unanswered side stays undefined. */
  give?: number;
  receive?: number;
  reciprocal: boolean;
  comment?: string;
};

export type PlainBackup = {
  handle: string;
  bio: BioBlock[];
  tags: { label: string; state: string }[];
  sections: { title: string; rows: BackupRow[] }[];
};

export const SECTION_MAIN = "Questionario Generale";
export const SECTION_EROTIC = "Questionario Erotismo";

/** Bio HTML (always passed through sanitizeBio) → paragraphs of formatted runs. */
export function bioBlocks(html: string): BioBlock[] {
  const clean = sanitizeBio(html);
  if (!clean || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, "text/html");
  const blocks: BioBlock[] = [];
  let cur: BioBlock = { heading: false, runs: [] };
  const flush = () => {
    if (cur.runs.some((r) => r.text.trim())) blocks.push(cur);
    cur = { heading: false, runs: [] };
  };
  const walk = (node: Node, f: Omit<BioRun, "text">) => {
    if (node.nodeType === 3) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      if (text) cur.runs.push({ text, ...f });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName;
    if (tag === "BR") return flush();
    const block = tag === "P" || tag === "DIV" || tag === "H2";
    if (block) {
      flush();
      cur.heading = tag === "H2";
    }
    const next = {
      ...f,
      ...(tag === "B" || tag === "STRONG" ? { bold: true } : {}),
      ...(tag === "I" || tag === "EM" ? { italic: true } : {}),
      ...(tag === "S" || tag === "STRIKE" || tag === "DEL" ? { strike: true } : {}),
    };
    node.childNodes.forEach((c) => walk(c, next));
    if (block) flush();
  };
  doc.body.firstChild?.childNodes.forEach((c) => walk(c, {}));
  flush();
  return blocks.map((b) => ({ ...b, runs: trimRuns(b.runs) }));
}

function trimRuns(runs: BioRun[]): BioRun[] {
  const out = runs.map((r) => ({ ...r }));
  if (out[0]) out[0].text = out[0].text.trimStart();
  const last = out[out.length - 1];
  if (last) last.text = last.text.trimEnd();
  return out.filter((r) => r.text);
}

export function bioPlainText(blocks: BioBlock[]): string {
  return blocks.map((b) => b.runs.map((r) => r.text).join("")).join("\n");
}

/** Handle, bio, tags and every answered, not hidden answer of both questionnaires. */
export function buildPlainBackup(state: AppState, questions: Question[]): PlainBackup {
  const label = new Map(ALL_CATEGORIES.map((c) => [c.key as string, c.label]));
  const hiddenCats = new Set(state.hiddenCategories);
  const main: BackupRow[] = [];
  const erotic: BackupRow[] = [];
  for (const q of questions) {
    const a = state.answers[q.id];
    if (!a || a.answered !== true || a.hidden) continue;
    const cat = categoryOfId(q.id);
    if (hiddenCats.has(cat)) continue;
    const erot = isEroticQuestionId(q.id);
    const reciprocal = isReciprocal(q);
    const g = reciprocal ? giveOf(a) : undefined;
    const r = reciprocal ? receiveOf(a) : undefined;
    const row: BackupRow = {
      section: erot ? SECTION_EROTIC : SECTION_MAIN,
      category: label.get(cat) ?? cat,
      question: q.text,
      reciprocal,
      ...(reciprocal ? {} : { value: Math.round(a.value) }),
      ...(g !== undefined ? { give: Math.round(g) } : {}),
      ...(r !== undefined ? { receive: Math.round(r) } : {}),
      ...(a.comment?.trim() ? { comment: a.comment.trim() } : {}),
    };
    (erot ? erotic : main).push(row);
  }
  const tags = PROFILE_TAGS.filter((t) => isActiveTag(state.tags[t.id])).map((t) => ({
    label: t.label,
    state: state.tags[t.id] === "cross" ? "escluso" : "sì",
  }));
  return {
    handle: `@${handleOf(state.identity)}`,
    bio: bioBlocks(state.bio),
    tags,
    sections: [
      { title: SECTION_MAIN, rows: main },
      { title: SECTION_EROTIC, rows: erotic },
    ],
  };
}

export function answerText(r: BackupRow): string {
  const pct = (v: number | undefined) => (v === undefined ? "—" : `${v}%`);
  return r.reciprocal
    ? `Fare: ${pct(r.give)} · Ricevere: ${pct(r.receive)}`
    : `Valore: ${pct(r.value)}`;
}

const HEADER = ["Questionario", "Categoria", "Domanda", "Risposta", "Commento"];

/** Table rows shared by CSV and XLSX: profile info first, then one line per answer. */
export function tableRows(b: PlainBackup): string[][] {
  const rows: string[][] = [
    ["Handle", b.handle],
    ["Bio", bioPlainText(b.bio)],
    ["Tag", b.tags.map((t) => `${t.label} (${t.state})`).join(", ")],
    [],
    HEADER,
  ];
  for (const s of b.sections)
    for (const r of s.rows)
      rows.push([s.title, r.category, r.question, answerText(r), r.comment ?? ""]);
  return rows;
}

export function toCsv(b: PlainBackup): string {
  const cell = (v: string) => (/[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM so spreadsheet apps read accents and emoji as UTF-8.
  return (
    "\uFEFF" +
    tableRows(b)
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}

export function backupFileName(b: PlainBackup, ext: string): string {
  const safe = b.handle.replace(/^@/, "").replace(/[\\/:*?"<>|\s]/g, "") || "profilo";
  return `questionar-backup-${safe}.${ext}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function toXlsx(b: PlainBackup): Promise<Blob> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(tableRows(b));
  ws["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 60 }, { wch: 28 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Profilo");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function toDocx(b: PlainBackup): Promise<Blob> {
  const d = await import("docx");
  const children: InstanceType<typeof d.Paragraph>[] = [
    new d.Paragraph({ text: "QuestionAR — backup in chiaro", heading: d.HeadingLevel.TITLE }),
    new d.Paragraph({ children: [new d.TextRun({ text: b.handle, bold: true })] }),
    new d.Paragraph({ text: "Bio", heading: d.HeadingLevel.HEADING_1 }),
    ...b.bio.map(
      (blk) =>
        new d.Paragraph({
          ...(blk.heading ? { heading: d.HeadingLevel.HEADING_2 } : {}),
          children: blk.runs.map(
            (r) =>
              new d.TextRun({
                text: r.text,
                bold: !!r.bold,
                italics: !!r.italic,
                strike: !!r.strike,
              }),
          ),
        }),
    ),
    new d.Paragraph({ text: "Tag del profilo", heading: d.HeadingLevel.HEADING_1 }),
    ...(b.tags.length
      ? b.tags.map(
          (t) => new d.Paragraph({ text: `${t.label} (${t.state})`, bullet: { level: 0 } }),
        )
      : [new d.Paragraph({ text: "Nessun tag attivo." })]),
  ];
  for (const s of b.sections) {
    children.push(new d.Paragraph({ text: s.title, heading: d.HeadingLevel.HEADING_1 }));
    if (!s.rows.length) children.push(new d.Paragraph({ text: "Nessuna risposta." }));
    let cat = "";
    for (const r of s.rows) {
      if (r.category !== cat) {
        cat = r.category;
        children.push(new d.Paragraph({ text: cat, heading: d.HeadingLevel.HEADING_2 }));
      }
      children.push(
        new d.Paragraph({ children: [new d.TextRun({ text: r.question, bold: true })] }),
      );
      children.push(new d.Paragraph({ text: answerText(r) }));
      if (r.comment)
        children.push(
          new d.Paragraph({
            children: [new d.TextRun({ text: `Commento: ${r.comment}`, italics: true })],
          }),
        );
    }
  }
  return d.Packer.toBlob(new d.Document({ sections: [{ children }] }));
}

/** The built-in PDF fonts only cover Latin-1: emoji and other symbols are left out. */
function latin(s: string): string {
  return s
    .replace(/[^\u0000-\u00ff\u2013\u2014\u2019\u201c\u201d\u00b7]/gu, "")
    .replace(/\u00a0/g, " ");
}

export async function toPdf(b: PlainBackup): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 48;
  const W = doc.internal.pageSize.getWidth() - M * 2;
  const H = doc.internal.pageSize.getHeight() - M;
  let y = M;
  const style = (r: { bold?: boolean; italic?: boolean }) =>
    r.bold && r.italic ? "bolditalic" : r.bold ? "bold" : r.italic ? "italic" : "normal";
  const ensure = (h: number) => {
    if (y + h > H) {
      doc.addPage();
      y = M;
    }
  };
  // Lays out formatted runs word by word, wrapping at the page width.
  const para = (runs: BioRun[], size = 11, gap = 6) => {
    doc.setFontSize(size);
    const lh = size * 1.35;
    let x = M;
    ensure(lh);
    for (const r of runs) {
      doc.setFont("helvetica", style(r));
      for (const word of latin(r.text).split(/(\s+)/)) {
        if (!word) continue;
        const w = doc.getTextWidth(word);
        if (x + w > M + W && word.trim()) {
          y += lh;
          ensure(lh);
          x = M;
        }
        if (x === M && !word.trim()) continue;
        doc.text(word, x, y);
        if (r.strike) doc.line(x, y - size * 0.3, x + w, y - size * 0.3);
        x += w;
      }
    }
    y += lh + gap;
  };
  para([{ text: "QuestionAR — backup in chiaro", bold: true }], 18, 4);
  para([{ text: latin(b.handle) || b.handle.replace(/[^\w@]/g, "") }], 12, 12);
  para([{ text: "Bio", bold: true }], 14);
  if (!b.bio.length) para([{ text: "Nessuna bio.", italic: true }]);
  for (const blk of b.bio)
    para(
      blk.heading ? blk.runs.map((r) => ({ ...r, bold: true })) : blk.runs,
      blk.heading ? 13 : 11,
    );
  para([{ text: "Tag del profilo", bold: true }], 14);
  para([
    {
      text: b.tags.length
        ? b.tags.map((t) => `${t.label} (${t.state})`).join(", ")
        : "Nessun tag attivo.",
    },
  ]);
  for (const s of b.sections) {
    y += 6;
    para([{ text: s.title, bold: true }], 15);
    if (!s.rows.length) para([{ text: "Nessuna risposta.", italic: true }]);
    let cat = "";
    for (const r of s.rows) {
      if (r.category !== cat) {
        cat = r.category;
        para([{ text: cat, bold: true }], 12, 2);
      }
      para([{ text: r.question, bold: true }], 10.5, 0);
      para([{ text: answerText(r) }], 10.5, r.comment ? 0 : 6);
      if (r.comment) para([{ text: `Commento: ${r.comment}`, italic: true }], 10.5);
    }
  }
  return doc.output("blob");
}

export type PlainFormat = "pdf" | "docx" | "csv" | "xlsx";

export async function exportPlainBackup(b: PlainBackup, format: PlainFormat) {
  const blob =
    format === "csv"
      ? new Blob([toCsv(b)], { type: "text/csv;charset=utf-8" })
      : format === "xlsx"
        ? await toXlsx(b)
        : format === "docx"
          ? await toDocx(b)
          : await toPdf(b);
  download(blob, backupFileName(b, format));
}
