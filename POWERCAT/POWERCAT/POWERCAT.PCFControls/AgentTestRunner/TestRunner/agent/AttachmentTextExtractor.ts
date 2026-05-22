/**
 * AttachmentTextExtractor.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Client-side extraction of readable text from attachment formats so the
 * agent receives actual content alongside the binary attachment.
 *
 * Copilot Studio accepts uploads up to 15 MB of the following types:
 *   PDF, TXT, CSV, XLSX, PNG, JPEG, WEBP, non-animated GIF.
 * Plus Office formats this test runner has historically supported: DOCX, PPTX.
 *
 * Extraction policy:
 *   - PPTX / DOCX / XLSX                                    → text extracted via JSZip + OpenXML
 *   - TXT / CSV / MD / TSV / JSON / XML / YAML / HTML / RTF → UTF-8 decoded directly
 *   - PDF                                                   → not extracted client-side;
 *                                                              binary is forwarded and the agent's
 *                                                              own document AI processes it
 *   - PNG / JPEG / WEBP / GIF / BMP / SVG                   → not extracted client-side;
 *                                                              binary is forwarded and the agent's
 *                                                              vision capability processes it
 *
 * For unsupported formats this function returns an empty string; the binary
 * is still attached to the activity by the caller.
 */

import JSZip from "jszip";
import type { TestCaseAttachmentData } from "../shared/models/DataModels";

/** Soft cap on extracted text length to keep the activity payload reasonable. */
const MAX_EXTRACTED_CHARS = 60_000;

const TEXT_LIKE_MIME_REGEX =
  /^(text\/|application\/(json|xml|x-yaml|yaml|javascript|x-www-form-urlencoded))/i;

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Decodes a base64 string into a Uint8Array.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes a base64 string as UTF-8 text.
 */
function base64ToUtf8(base64: string): string {
  try {
    const bytes = base64ToBytes(base64);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Collapses XML/markup whitespace runs to single spaces and trims.
 */
function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Extracts text from <a:t>...</a:t> (PPTX), <w:t>...</w:t> (DOCX), or <t>...</t> (XLSX shared strings).
 * Uses a regex pass which is robust for office xml text runs.
 */
function extractXmlText(xml: string, tag: "a:t" | "w:t" | "t"): string {
  // The xml:space attribute may appear; match opening tag forms with optional attrs.
  const escapedTag = tag.replace(":", "\\:");
  const re = new RegExp(
    `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTag}>`,
    "g"
  );
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const raw = match[1];
    if (raw) parts.push(decodeXmlEntities(raw));
  }
  return parts.join(" ");
}

/**
 * Decodes the small set of XML entities that Office files commonly emit.
 */
function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Sorts office package paths by numeric suffix when present
 * (e.g. slide1.xml, slide2.xml, ...).
 */
function sortByNumericSuffix(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const na = parseInt(a.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
    const nb = parseInt(b.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
    return na - nb;
  });
}

/**
 * Extracts text content from a PPTX (OpenXML presentation).
 */
async function extractFromPptx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slidePaths = Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(p)
  );
  const ordered = sortByNumericSuffix(slidePaths);

  const sections: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const path = ordered[i];
    const xml = await zip.files[path].async("string");
    const text = normalizeWhitespace(extractXmlText(xml, "a:t"));
    if (text) {
      sections.push(`Slide ${i + 1}: ${text}`);
    }
  }
  return sections.join("\n");
}

/**
 * Extracts text content from a DOCX (OpenXML wordprocessing).
 */
async function extractFromDocx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.files["word/document.xml"];
  if (!docFile) return "";
  const xml = await docFile.async("string");
  return normalizeWhitespace(extractXmlText(xml, "w:t"));
}

/**
 * Extracts text content from an XLSX (OpenXML spreadsheet) via the shared strings table.
 */
async function extractFromXlsx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const sharedStrings = zip.files["xl/sharedStrings.xml"];
  if (!sharedStrings) return "";
  const xml = await sharedStrings.async("string");
  return normalizeWhitespace(extractXmlText(xml, "t"));
}

/**
 * Decides whether a MIME type is text-like and decodes directly.
 */
function tryExtractTextLike(
  mimeType: string,
  fileName: string,
  base64: string
): string | undefined {
  const lowerMime = (mimeType || "").toLowerCase();
  const lowerName = (fileName || "").toLowerCase();
  const looksTextLikeByExt = /\.(txt|md|csv|tsv|json|xml|ya?ml|html?|log|rtf)$/i.test(
    lowerName
  );
  if (TEXT_LIKE_MIME_REGEX.test(lowerMime) || looksTextLikeByExt) {
    return base64ToUtf8(base64);
  }
  return undefined;
}

/**
 * Extracts readable text from a Dataverse file attachment, when the file type is
 * a format the test runner knows how to parse client-side. Returns an empty
 * string for unsupported types or on extraction failure.
 *
 * The returned text is truncated to `MAX_EXTRACTED_CHARS` characters.
 */
export async function extractTextFromAttachment(
  attachment: TestCaseAttachmentData
): Promise<string> {
  if (!attachment?.base64Content) {
    return "";
  }

  const mime = (attachment.mimeType || "").toLowerCase();
  const fileName = attachment.fileName || "";
  const lowerName = fileName.toLowerCase();

  try {
    const textLike = tryExtractTextLike(mime, fileName, attachment.base64Content);
    if (textLike !== undefined) {
      return truncate(textLike);
    }

    const isPptx = mime === PPTX_MIME || lowerName.endsWith(".pptx");
    const isDocx = mime === DOCX_MIME || lowerName.endsWith(".docx");
    const isXlsx = mime === XLSX_MIME || lowerName.endsWith(".xlsx");

    if (!isPptx && !isDocx && !isXlsx) {
      return "";
    }

    const bytes = base64ToBytes(attachment.base64Content);
    let text = "";
    if (isPptx) {
      text = await extractFromPptx(bytes);
    } else if (isDocx) {
      text = await extractFromDocx(bytes);
    } else if (isXlsx) {
      text = await extractFromXlsx(bytes);
    }
    return truncate(text);
  } catch (err) {
    console.warn(
      `AttachmentTextExtractor: extraction failed for "${attachment.fileName}" (${attachment.mimeType}):`,
      err
    );
    return "";
  }
}

function truncate(input: string): string {
  if (!input) return "";
  if (input.length <= MAX_EXTRACTED_CHARS) return input;
  return `${input.slice(0, MAX_EXTRACTED_CHARS)}\n…[truncated]`;
}
