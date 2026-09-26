import "server-only";

// Server-only résumé text extraction. PDFs via unpdf (a Node/serverless-friendly
// pdfjs build — no canvas/DOMMatrix needed), .docx via mammoth. Used at upload
// time so scoring reuses the stored text.

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export async function extractResumeText(
  bytes: Buffer,
  ext: "pdf" | "docx",
): Promise<string> {
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return value.trim();
  }
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
