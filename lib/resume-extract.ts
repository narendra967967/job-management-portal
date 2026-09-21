import "server-only";

// Server-only résumé text extraction. PDFs via pdf-parse (pdfjs under the hood),
// .docx via mammoth. Used at upload time so scoring reuses the stored text.

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractResumeText(
  bytes: Buffer,
  ext: "pdf" | "docx",
): Promise<string> {
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return value.trim();
  }
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const res = await parser.getText();
    return (res.text ?? "").trim();
  } finally {
    // Release the pdfjs document/worker resources.
    await parser.destroy?.();
  }
}
