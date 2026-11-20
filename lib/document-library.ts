import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import db from "./db";
import { writeCityFile } from "./fs-tools";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 500_000;
const CHUNK_SIZE = 1_600;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_DOCUMENT = 400;

export type DocumentSource = {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  created_at: string;
};

export type RetrievedChunk = {
  sourceId: number;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
};

function extension(filename: string) {
  return path.extname(filename).toLowerCase();
}

export function getDocumentMimeType(filename: string) {
  switch (extension(filename)) {
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    default:
      throw new Error("Supported document types are PDF, TXT, and Markdown (.md).");
  }
}

export async function extractDocumentText(filename: string, bytes: Uint8Array) {
  const mimeType = getDocumentMimeType(filename);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Each document must be between 1 byte and 20 MB.");
  }

  if (mimeType === "application/pdf") {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      throw new Error("This file is not a valid PDF.");
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;
    try {
      if (pdf.numPages > 200) {
        throw new Error("PDFs are limited to 200 pages per file.");
      }
      const pages: string[] = [];
      let characterCount = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent();
        const pageText = text.items
          .flatMap((item) =>
            "str" in item && typeof item.str === "string"
              ? [item.str + (item.hasEOL ? "\n" : " ")]
              : [],
          )
          .join("")
          .trim();
        characterCount += pageText.length;
        if (characterCount > MAX_EXTRACTED_CHARACTERS) {
          throw new Error("Extracted document text cannot exceed 500,000 characters.");
        }
        pages.push(pageText);
      }
      return pages.join("\n\n").trim();
    } finally {
      await pdf.destroy();
    }
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Text and Markdown uploads must use UTF-8 encoding.");
  }
  if (text.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("Extracted document text cannot exceed 500,000 characters.");
  }
  return text.replace(/^\uFEFF/, "").trim();
}

export function splitDocumentIntoChunks(text: string) {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) throw new Error("The document contains no extractable text.");

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n\n", end),
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf(" ", end),
      );
      if (boundary > start + CHUNK_SIZE / 2) end = boundary + 1;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      throw new Error("A document cannot produce more than 400 search chunks.");
    }
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function countWords(text: string) {
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function safeFilename(filename: string) {
  const parts = filename.replace(/\\/g, "/").split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .slice(-8)
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim())
    .filter(Boolean);
  return parts.join("/").slice(0, 180) || "document";
}

export async function saveKnowledgeDocument(
  cityId: number,
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
  text: string,
  cityRoot: string,
  cityRootBase: string,
) {
  const chunks = splitDocumentIntoChunks(text);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = db
    .prepare("SELECT id, filename FROM document_sources WHERE city_id = ? AND content_hash = ?")
    .get(cityId, hash) as { id: number; filename: string } | undefined;
  if (duplicate) return { id: duplicate.id, filename: duplicate.filename, chunkCount: chunks.length, duplicate: true };

  const displayName = safeFilename(filename);
  const relativePath = `knowledge/${randomUUID()}-${path.basename(displayName)}`;
  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO document_sources (city_id, filename, relative_path, mime_type, content_hash, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cityId, displayName, relativePath, mimeType, hash, bytes.byteLength);
    const sourceId = Number(result.lastInsertRowid);
    const insertChunk = db.prepare(`
      INSERT INTO document_chunks (source_id, chunk_index, content, token_count)
      VALUES (?, ?, ?, ?)
    `);
    chunks.forEach((content, index) => insertChunk.run(sourceId, index, content, countWords(content)));
    return sourceId;
  });
  const sourceId = transaction();

  try {
    await writeCityFile(relativePath, bytes, cityRoot, cityRootBase);
  } catch (error) {
    try {
      const rollback = db.prepare("DELETE FROM document_sources WHERE id = ? AND city_id = ?").run(sourceId, cityId);
      if (rollback.changes !== 1) throw new Error("The document rows could not be rolled back.");
    } catch (rollbackError) {
      throw new Error(
        `Could not write ${displayName} to the city folder: ${error instanceof Error ? error.message : "unknown error"}. ` +
          `SQLite cleanup also failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown error"}`,
      );
    }
    throw new Error(`Could not write ${displayName} to the city folder: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return { id: sourceId, filename: displayName, chunkCount: chunks.length, duplicate: false };
}

export function listKnowledgeDocuments(cityId: number) {
  return db.prepare(`
    SELECT
      source.id,
      source.filename,
      source.mime_type,
      source.size_bytes,
      source.created_at,
      COUNT(chunk.id) AS chunk_count
    FROM document_sources AS source
    LEFT JOIN document_chunks AS chunk ON chunk.source_id = source.id
    WHERE source.city_id = ?
    GROUP BY source.id
    ORDER BY source.created_at DESC, source.id DESC
  `).all(cityId) as DocumentSource[];
}

type SearchRow = {
  source_id: number;
  filename: string;
  chunk_index: number;
  content: string;
  token_count: number;
};

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "was", "were", "what", "when", "where", "which",
  "who", "why", "with",
]);

function queryTerms(query: string) {
  return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])
    .filter((term) => !stopWords.has(term)))].slice(0, 40);
}

export function retrieveRelevantChunks(cityId: number, query: string, limit = 6): RetrievedChunk[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const rows = db.prepare(`
    SELECT source.id AS source_id, source.filename, chunk.chunk_index, chunk.content, chunk.token_count
    FROM document_chunks AS chunk
    JOIN document_sources AS source ON source.id = chunk.source_id
    WHERE source.city_id = ?
    ORDER BY source.id DESC, chunk.chunk_index ASC
    LIMIT 10000
  `).all(cityId) as SearchRow[];
  if (rows.length === 0) return [];

  const documentFrequency = new Map<string, number>();
  const tokenized = rows.map((row) => {
    const words = row.content.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
    const frequencies = new Map<string, number>();
    for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    for (const term of new Set(words)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    return { row, frequencies, length: Math.max(words.length, row.token_count, 1) };
  });
  const averageLength = tokenized.reduce((sum, item) => sum + item.length, 0) / tokenized.length;
  const k1 = 1.2;
  const b = 0.75;

  return tokenized
    .map(({ row, frequencies, length }) => {
      let score = 0;
      for (const term of terms) {
        const frequency = frequencies.get(term) ?? 0;
        if (frequency === 0) continue;
        const df = documentFrequency.get(term) ?? 0;
        const inverseDocumentFrequency = Math.log(1 + (rows.length - df + 0.5) / (df + 0.5));
        score += inverseDocumentFrequency *
          (frequency * (k1 + 1)) /
          (frequency + k1 * (1 - b + b * (length / averageLength)));
      }
      return {
        sourceId: row.source_id,
        filename: row.filename,
        chunkIndex: row.chunk_index,
        content: row.content,
        score,
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
