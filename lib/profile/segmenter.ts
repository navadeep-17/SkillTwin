import { normalizeProfileText } from "./normalizer";

export type ProfileBlockKind =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "achievements"
  | "other";

export interface ProfileSourceBlock {
  id: string;
  sourceId: string;
  kind: ProfileBlockKind;
  title: string | null;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  ordinal: number;
}

const HEADING_KIND: Array<[RegExp, ProfileBlockKind]> = [
  [/^(professional\s+)?summary$|^profile$|^objective$/i, "summary"],
  [/^(technical\s+)?skills?$|^technologies$|^tech stack$/i, "skills"],
  [/^(work\s+)?experience$|^employment$|^internships?$/i, "experience"],
  [/^(academic\s+)?projects?$|^personal projects?$/i, "projects"],
  [/^education$|^academics?$/i, "education"],
  [/^certifications?$|^licenses?$/i, "certifications"],
  [/^achievements?$|^awards?$|^honors?$/i, "achievements"]
];

function headingKind(line: string): ProfileBlockKind | null {
  const cleaned = line.replace(/[:|]+$/g, "").trim();
  if (!cleaned || cleaned.length > 48) return null;
  for (const [pattern, kind] of HEADING_KIND) {
    if (pattern.test(cleaned)) return kind;
  }
  return null;
}

function chunks(text: string, max = 2400): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let split = remaining.lastIndexOf("\n", max);
    if (split < Math.floor(max * 0.6)) split = remaining.lastIndexOf(". ", max);
    if (split < Math.floor(max * 0.6)) split = max;
    parts.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

export function segmentResume(input: {
  documentId: string;
  documentVersion: number;
  pages: Array<{ page: number; text: string }>;
}): ProfileSourceBlock[] {
  const blocks: ProfileSourceBlock[] = [];
  let currentKind: ProfileBlockKind = "other";
  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  let startPage: number | null = null;
  let endPage: number | null = null;

  const flush = () => {
    const text = normalizeProfileText(currentLines.join("\n"));
    if (!text) {
      currentLines = [];
      startPage = null;
      endPage = null;
      return;
    }

    for (const part of chunks(text)) {
      const ordinal = blocks.length;
      blocks.push({
        id: input.documentId + ":v" + input.documentVersion + ":b" + ordinal,
        sourceId: input.documentId,
        kind: currentKind,
        title: currentTitle,
        text: part,
        pageStart: startPage,
        pageEnd: endPage,
        ordinal
      });
    }
    currentLines = [];
    startPage = null;
    endPage = null;
  };

  for (const page of input.pages) {
    const lines = normalizeProfileText(page.text).split("\n").filter(Boolean);
    for (const line of lines) {
      const kind = headingKind(line);
      if (kind) {
        flush();
        currentKind = kind;
        currentTitle = line.replace(/[:|]+$/g, "").trim();
        startPage = page.page;
        endPage = page.page;
        continue;
      }
      if (startPage == null) startPage = page.page;
      endPage = page.page;
      currentLines.push(line);
    }
  }

  flush();

  if (!blocks.length && input.pages.length) {
    const text = normalizeProfileText(input.pages.map(page => page.text).join("\n"));
    if (text) {
      blocks.push({
        id: input.documentId + ":v" + input.documentVersion + ":b0",
        sourceId: input.documentId,
        kind: "other",
        title: null,
        text,
        pageStart: 1,
        pageEnd: input.pages.at(-1)?.page ?? 1,
        ordinal: 0
      });
    }
  }
  return blocks;
}
