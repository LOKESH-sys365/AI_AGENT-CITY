"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import Link from "next/link";
import { AGENTS, AgentId } from "@/lib/agents";

type DocumentSource = {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  created_at: string;
};
type UploadedSource = { id: number; filename: string; chunkCount: number; duplicate: boolean };
type Mode = "library" | "pdf" | "editor" | "judge";
type JudgeResult = {
  judgeBrief: string;
  worker: { agent: AgentId; output: string };
  finalReview: string;
  sources: { marker: string; id: number; filename: string; chunk: number }[];
};

const workerIds: Exclude<AgentId, "mayor">[] = ["librarian", "professor", "builder", "planner"];
const modes: { id: Mode; label: string }[] = [
  { id: "library", label: "Knowledge Library" },
  { id: "pdf", label: "PDF Maker" },
  { id: "editor", label: "Editor" },
  { id: "judge", label: "Judge" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isDocumentSource(value: unknown): value is DocumentSource {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.filename === "string" &&
    typeof value.mime_type === "string" &&
    typeof value.size_bytes === "number" &&
    typeof value.chunk_count === "number" &&
    typeof value.created_at === "string"
  );
}

function isUploadedSource(value: unknown): value is UploadedSource {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.filename === "string" &&
    typeof value.chunkCount === "number" &&
    typeof value.duplicate === "boolean"
  );
}

function isJudgeResult(value: unknown): value is JudgeResult {
  return (
    isRecord(value) &&
    typeof value.judgeBrief === "string" &&
    isRecord(value.worker) &&
    typeof value.worker.agent === "string" &&
    Object.hasOwn(AGENTS, value.worker.agent) &&
    typeof value.worker.output === "string" &&
    typeof value.finalReview === "string" &&
    Array.isArray(value.sources) &&
    value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.marker === "string" &&
        typeof source.id === "number" &&
        typeof source.filename === "string" &&
        typeof source.chunk === "number",
    )
  );
}

function renderMarkdown(content: string): ReactNode[] {
  return content.split(/\r?\n/).map((line, index) => {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      return heading[1].length <= 2
        ? <h2 key={index}>{heading[2]}</h2>
        : <h3 key={index}>{heading[2]}</h3>;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return <p className="document-list-item" key={index}>{line.replace(/^\s*[-*]\s+/, "")}</p>;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      return <p className="document-list-item" key={index}>{line.trim()}</p>;
    }
    if (line.startsWith(">")) return <blockquote key={index}>{line.slice(1).trim()}</blockquote>;
    return line.trim()
      ? <p key={index}>{line}</p>
      : <div className="document-line-gap" key={index} />;
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentStudio({
  cityId,
  enabledAgents,
}: {
  cityId: number;
  enabledAgents: AgentId[];
}) {
  const [mode, setMode] = useState<Mode>("library");
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [libraryMessage, setLibraryMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);
  const [assistBusy, setAssistBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [task, setTask] = useState("");
  const [targetAgent, setTargetAgent] = useState<Exclude<AgentId, "mayor">>(
    enabledAgents.find((agent): agent is Exclude<AgentId, "mayor"> => agent !== "mayor" && workerIds.includes(agent as Exclude<AgentId, "mayor">)) ?? "professor",
  );
  const [judgeBusy, setJudgeBusy] = useState(false);
  const [judgeTakingLong, setJudgeTakingLong] = useState(false);
  const [judgeError, setJudgeError] = useState("");
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const availableWorkers = workerIds.filter((agent) => enabledAgents.includes(agent));

  useEffect(() => {
    if (!judgeBusy) {
      setJudgeTakingLong(false);
      return;
    }
    const timer = window.setTimeout(() => setJudgeTakingLong(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [judgeBusy]);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?cityId=${cityId}`);
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "Could not load the knowledge library."));
      if (!isRecord(result) || !Array.isArray(result.documents) || !result.documents.every(isDocumentSource)) {
        throw new Error("The server returned an invalid document list.");
      }
      setDocuments(result.documents);
      setLibraryError("");
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Could not load the knowledge library.");
    }
  }, [cityId]);

  useEffect(() => {
    void loadDocuments();
    folderInput.current?.setAttribute("webkitdirectory", "");
    folderInput.current?.setAttribute("directory", "");
  }, [loadDocuments]);

  async function uploadSelectedFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || uploading) return;

    setUploading(true);
    setLibraryError("");
    setLibraryMessage("");
    try {
      const formData = new FormData();
      formData.set("cityId", String(cityId));
      for (const file of files) {
        formData.append("files", file);
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        formData.append("labels", relativePath || file.name);
      }
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const result: unknown = await response.json();
      if (!response.ok && response.status !== 422) {
        throw new Error(readError(result, "Could not upload the selected files."));
      }
      if (
        !isRecord(result) ||
        !Array.isArray(result.uploaded) ||
        !result.uploaded.every(isUploadedSource) ||
        !Array.isArray(result.failed) ||
        !result.failed.every(
          (file) => isRecord(file) && typeof file.filename === "string" && typeof file.error === "string",
        )
      ) {
        throw new Error("The server returned an invalid upload result.");
      }
      const uploadedCount = result.uploaded.length;
      const duplicates = result.uploaded.filter((file) => file.duplicate).length;
      const failedFiles = result.failed;
      setLibraryMessage(
        `${uploadedCount - duplicates} added; ${duplicates} already indexed; ${failedFiles.length} failed.`,
      );
      if (failedFiles.length > 0) {
        setLibraryError(
          failedFiles.map((file) => `${file.filename}: ${file.error}`).join("\n"),
        );
      }
      if (Array.isArray(result.documents) && result.documents.every(isDocumentSource)) {
        setDocuments(result.documents);
      } else {
        await loadDocuments();
      }
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Could not upload the selected files.");
    } finally {
      setUploading(false);
    }
  }

  async function generateDocument() {
    if (!instruction.trim() || assistBusy) return;
    if (mode === "editor" && !draft.trim()) {
      setDocumentError("Paste a draft for the Editor to revise.");
      return;
    }

    setAssistBusy(true);
    setDocumentError("");
    try {
      const response = await fetch("/api/documents/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          mode: mode === "pdf" ? "create" : "edit",
          instruction: instruction.trim(),
          ...(mode === "editor" ? { draft } : {}),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "The local document model failed."));
      if (!isRecord(result) || typeof result.text !== "string" || !result.text.trim()) {
        throw new Error("The document model returned an invalid draft.");
      }
      setDraft(result.text);
      if (!title.trim()) setTitle(mode === "pdf" ? "New document" : "Edited document");
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "The local document model failed.");
    } finally {
      setAssistBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft.trim() || !title.trim() || saveBusy) return;
    setSaveBusy(true);
    setDocumentError("");
    try {
      const response = await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, title: title.trim(), content: draft }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "Could not save this document."));
      if (!isRecord(result) || typeof result.message !== "string") {
        throw new Error("The server returned an invalid save result.");
      }
      setLibraryMessage(result.message);
      await loadDocuments();
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Could not save this document.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function loadSourceDocument() {
    if (!selectedDocumentId || loadingSource) return;
    setLoadingSource(true);
    setDocumentError("");
    try {
      const response = await fetch(`/api/documents/${selectedDocumentId}?cityId=${cityId}`);
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "Could not open this library document."));
      if (!isRecord(result) || typeof result.filename !== "string" || typeof result.text !== "string") {
        throw new Error("The server returned an invalid source document.");
      }
      setDraft(result.text);
      setTitle(result.filename.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, "") ?? "Edited document");
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Could not open this library document.");
    } finally {
      setLoadingSource(false);
    }
  }

  async function runJudge() {
    if (!task.trim() || judgeBusy || availableWorkers.length === 0 || !enabledAgents.includes("mayor")) return;
    setJudgeBusy(true);
    setJudgeError("");
    setJudgeResult(null);
    try {
      const response = await fetch("/api/documents/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, task: task.trim(), agent: targetAgent }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "The Judge workflow failed."));
      if (!isJudgeResult(result)) throw new Error("The Judge workflow returned an invalid result.");
      setJudgeResult(result);
    } catch (error) {
      setJudgeError(error instanceof Error ? error.message : "The Judge workflow failed.");
    } finally {
      setJudgeBusy(false);
    }
  }

  return (
    <div className="document-studio">
      <nav className="document-tabs" aria-label="Document modes">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? "selected" : ""}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="document-library" aria-labelledby="knowledge-library-heading">
        <div className="document-section-heading">
          <div>
            <h2 id="knowledge-library-heading">Judge’s knowledge library</h2>
            <p>Upload files or a folder. Text is extracted locally, split into overlapping chunks, and indexed in SQLite.</p>
          </div>
          <div className="document-upload-actions">
            <button type="button" onClick={() => filesInput.current?.click()} disabled={uploading}>
              {uploading ? "Processing…" : "Choose files"}
            </button>
            <button type="button" onClick={() => folderInput.current?.click()} disabled={uploading}>
              Choose folder
            </button>
          </div>
        </div>
        <input ref={filesInput} className="visually-hidden" type="file" multiple accept=".pdf,.txt,.md" aria-hidden="true" tabIndex={-1} onChange={(event) => void uploadSelectedFiles(event)} />
        <input ref={folderInput} className="visually-hidden" type="file" multiple accept=".pdf,.txt,.md" aria-hidden="true" tabIndex={-1} onChange={(event) => void uploadSelectedFiles(event)} />
        <p className="document-note">PDF, TXT, and Markdown only · 20 MB per file · 50 MB per batch · inference uses your configured Ollama endpoint.</p>
        {libraryMessage && <p className="document-success" role="status">{libraryMessage}</p>}
        {libraryError && <p className="document-error" role="alert">{libraryError}</p>}
        {documents.length === 0 ? (
          <p className="document-empty">No sources yet. Add a document before asking Judge to use your context.</p>
        ) : (
          <ul className="document-source-list">
            {documents.map((document) => (
              <li key={document.id}>
                <span className="document-source-name">{document.filename}</span>
                <span>{formatBytes(document.size_bytes)} · {document.chunk_count} chunks</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mode === "pdf" && (
        <section className="document-mode-panel" aria-labelledby="pdf-maker-heading">
          <h2 id="pdf-maker-heading">PDF Maker</h2>
          <p>Create a document with your local Ollama model, edit the draft, then use your browser’s Print → Save as PDF.</p>
          <label>
            Document title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Project proposal" />
          </label>
          <label>
            What should the document contain?
            <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={6000} rows={4} placeholder="Describe the purpose, audience, tone, and key sections." />
          </label>
          <div className="document-actions">
            <button type="button" onClick={() => void generateDocument()} disabled={assistBusy || !instruction.trim()}>
              {assistBusy ? "Creating locally…" : "Create draft"}
            </button>
            {draft && <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>}
            {draft && <button type="button" onClick={() => void saveDraft()} disabled={saveBusy || !title.trim()}>{saveBusy ? "Saving…" : "Save Markdown to city"}</button>}
          </div>
          {documentError && <p className="document-error" role="alert">{documentError}</p>}
          {draft && (
            <label>
              Edit your draft
              <textarea className="document-draft-editor" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500_000} rows={18} />
            </label>
          )}
        </section>
      )}

      {mode === "editor" && (
        <section className="document-mode-panel" aria-labelledby="editor-heading">
          <h2 id="editor-heading">Editor</h2>
          <p>Open a library source or paste a draft, then describe the changes. The Editor uses your selected local Ollama model and returns editable Markdown.</p>
          <label>
            Open from Judge’s library
            <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
              <option value="">Choose a source document</option>
              {documents.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
            </select>
          </label>
          <div className="document-actions">
            <button type="button" onClick={() => void loadSourceDocument()} disabled={!selectedDocumentId || loadingSource}>
              {loadingSource ? "Opening…" : "Load source into editor"}
            </button>
          </div>
          <label>
            Document title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Meeting notes" />
          </label>
          <label>
            Editing instruction
            <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={6000} rows={3} placeholder="Make it concise, correct grammar, and keep the original facts." />
          </label>
          <label>
            Draft
            <textarea className="document-draft-editor" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={30_000} rows={12} placeholder="Paste text to edit." />
          </label>
          <div className="document-actions">
            <button type="button" onClick={() => void generateDocument()} disabled={assistBusy || !instruction.trim() || !draft.trim()}>
              {assistBusy ? "Editing locally…" : "Revise draft"}
            </button>
            {draft && <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>}
            {draft && <button type="button" onClick={() => void saveDraft()} disabled={saveBusy || !title.trim()}>{saveBusy ? "Saving…" : "Save Markdown to city"}</button>}
          </div>
          {documentError && <p className="document-error" role="alert">{documentError}</p>}
        </section>
      )}

      {mode === "judge" && (
        <section className="document-mode-panel" aria-labelledby="judge-heading" aria-busy={judgeBusy}>
          <h2 id="judge-heading">Judge → Worker → Mayor</h2>
          <p>Judge retrieves relevant chunks, prepares a cited brief, and passes it to a worker. Mayor reviews the worker’s result against the retrieved evidence.</p>
          {documents.length === 0 && <p className="document-error">Upload knowledge sources before running Judge.</p>}
          {!enabledAgents.includes("mayor") && <p className="document-error">Enable Mayor in Settings for final review.</p>}
          {availableWorkers.length === 0 && <p className="document-error">Enable at least one worker agent in Settings.</p>}
          <label>
            Send the context to
            <select value={targetAgent} onChange={(event) => {
              const value = event.target.value;
              if (workerIds.includes(value as Exclude<AgentId, "mayor">)) {
                setTargetAgent(value as Exclude<AgentId, "mayor">);
              }
            }}>
              {availableWorkers.map((agentId) => <option key={agentId} value={agentId}>{AGENTS[agentId].name}</option>)}
            </select>
          </label>
          <label>
            Task for Judge
            <textarea value={task} onChange={(event) => setTask(event.target.value)} maxLength={4000} rows={4} placeholder="Ask a question or describe a task that should use your uploaded documents." />
          </label>
          <div className="document-actions">
            <button type="button" onClick={() => void runJudge()} disabled={judgeBusy || !task.trim() || documents.length === 0 || !enabledAgents.includes("mayor") || availableWorkers.length === 0}>
              {judgeBusy ? "Judge and agents are working locally…" : "Run Judge workflow"}
            </button>
          </div>
          {judgeBusy && (
            <div className="judge-loading" role="status" aria-live="polite" aria-atomic="true">
              <div className="judge-loading-heading">
                <span className="judge-loading-spinner" aria-hidden="true" />
                <div>
                  <strong>{judgeTakingLong ? "Still working after 12 seconds" : "Preparing your evidence-based answer"}</strong>
                  <p>
                    {judgeTakingLong
                      ? "Local Ollama generation can take longer depending on the model and your computer. The page will keep waiting for the result."
                      : `Judge is preparing context for ${AGENTS[targetAgent].name}; Mayor will review the final answer.`}
                  </p>
                </div>
              </div>
              <div className="judge-loading-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className="judge-loading-flow">Judge retrieval <span>→</span> {AGENTS[targetAgent].name} <span>→</span> Mayor review</p>
            </div>
          )}
          {judgeError && <p className="document-error" role="alert">{judgeError}</p>}
          {judgeResult && (
            <div className="judge-result">
              <section>
                <h3>Mayor’s final review</h3>
                <div className="judge-output">{judgeResult.finalReview}</div>
              </section>
              <details>
                <summary>Judge brief and {AGENTS[judgeResult.worker.agent].name} report</summary>
                <h3>Judge’s brief</h3>
                <div className="judge-output">{judgeResult.judgeBrief}</div>
                <h3>{AGENTS[judgeResult.worker.agent].name} report</h3>
                <div className="judge-output">{judgeResult.worker.output}</div>
              </details>
              <div>
                <h3>Retrieved sources</h3>
                <ul className="judge-source-list">
                  {judgeResult.sources.map((source) => (
                    <li key={`${source.marker}-${source.id}-${source.chunk}`}>
                      <strong>[{source.marker}]</strong> {source.filename}, chunk {source.chunk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {(mode === "pdf" || mode === "editor") && draft.trim() && (
        <article className="document-preview">
          <h1>{title.trim() || "Untitled document"}</h1>
          <div className="document-rendered-content">{renderMarkdown(draft)}</div>
        </article>
      )}
      <footer className="document-footer">
        <Link href={`/city/${cityId}`}>Return to the city</Link>
        <span>Files and chunks remain in this city; inference uses your configured Ollama endpoint.</span>
      </footer>
    </div>
  );
}
