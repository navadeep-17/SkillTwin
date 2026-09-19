export const PDF_PARSER_VERSION = "pdfjs-b1";

export interface ParsedPdfPage {
  page: number;
  text: string;
  charCount: number;
}

export interface ParsedPdf {
  fullText: string;
  pages: ParsedPdfPage[];
  quality: {
    pageCount: number;
    charCount: number;
    nonEmptyPages: number;
    extractionRatio: number;
    needsOcr: boolean;
  };
}

function normalizePageText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const document = await task.promise;
  const pages: ParsedPdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const fragments: string[] = [];

      for (const item of content.items) {
        if (!("str" in item)) continue;
        const text = String(item.str ?? "");
        if (text) fragments.push(text);
        if ("hasEOL" in item && item.hasEOL) fragments.push("\n");
        else fragments.push(" ");
      }

      const text = normalizePageText(fragments.join(""));
      pages.push({ page: pageNumber, text, charCount: text.length });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  const fullText = pages.map(page => page.text).filter(Boolean).join("\n\n");
  const nonEmptyPages = pages.filter(page => page.charCount >= 40).length;
  const extractionRatio = pages.length ? nonEmptyPages / pages.length : 0;

  return {
    fullText,
    pages,
    quality: {
      pageCount: pages.length,
      charCount: fullText.length,
      nonEmptyPages,
      extractionRatio: Number(extractionRatio.toFixed(3)),
      needsOcr: fullText.length < 120 || extractionRatio < 0.5
    }
  };
}
