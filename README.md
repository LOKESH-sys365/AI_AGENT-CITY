# Agent City (free, local with Ollama)

A Next.js app where local AI agents manage a folder on your laptop.

## Run
1. Make sure Ollama is running and the model exists: `ollama list` (needs llama3.2:3b)
2. `npm install`
3. If `.env.local` does not exist, copy `.env.example` to `.env.local` (Windows: `copy .env.example .env.local`).
4. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env.local`. Set `GITHUB_TOKEN` to a fine-grained GitHub token if you want GitHub tools.
5. Enable the Google Calendar API and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI for the Google OAuth client.
6. Run `npm run dev` and open http://localhost:3000. You will be redirected to the sign-in page.

Agents only see the folder set in `CITY_ROOT` (default `~/AgentCity`, which is C:\Users\<you>\AgentCity on Windows).
They can list, read, write, create folders and move files. They cannot delete, and moves never overwrite.

## Tips for small models
- Talk to one building at a time first (Library, Campus...). Town Hall delegation is harder for a 3B model.
- Give short, single-step requests.
- A bigger model (for example qwen2.5:7b) can be set with OLLAMA_MODEL.

## Database
The SQLite database is initialized at `data/city.db` when `lib/db.ts` is imported. It contains tables for users, cities, agent outputs, and runs. Google sign-ins are saved to the users table.

## Sign-in
Authentication uses Auth.js with Google. The `/dashboard` and `/city` pages redirect logged-out users to `/login`; the chat API requires a signed-in session.

## Google Calendar and GitHub tools
Agent City hosts a local MCP service for integrations; no separate MCP process is required. The Planner receives Calendar tools to read, create, and update events in the signed-in user's primary calendar. The Builder receives GitHub tools to read repository issues and pull requests, create/update issues, and read/create/update comments. These tools do not delete events/issues/comments or push code.

Google sign-in requests Calendar event access. After configuring the app, sign out and sign in again to grant it. The refresh token is encrypted with `AUTH_SECRET` and stored in the local SQLite database. Keep `AUTH_SECRET` stable so the token remains decryptable.

Set `GITHUB_TOKEN` in `.env.local` and restart the app. Use a fine-grained token limited to the intended repositories, with **Metadata: read**, **Issues: read/write**, and **Pull requests: read**. Do not grant Contents or code-push permissions. `.env.local` and `data/` are ignored by Git.

## Cities
The dashboard lists only the signed-in user's cities. **Build city** creates a city record and a unique subfolder inside `CITY_ROOT`. Agent chat requests must include an owned `cityId`; the agent loop and every file tool are scoped to that city's folder.

## Scheduled jobs
Create and manage weekly jobs from a city's page. Jobs use the selected weekday, local time, and IANA time zone (the form defaults to Sunday at 01:50 in `Asia/Kolkata`) and are saved in `data/city.db`. No jobs are created automatically. The local scheduler checks for due jobs while the Node.js Agent City server is running; it does not run when the server is stopped. A scheduled agent can read and modify files in its city folder, and its final output is saved to SQLite and that city's `outputs/` folder. Use **Run now** to execute a job immediately, or pause/delete it from the same page. Scheduled jobs do not create Calendar events by default.

## Settings
Open **Settings** from the dashboard or a city page to choose your local Ollama model, CITY_ROOT, and which agents are enabled. Settings are saved per Google account in SQLite; environment values in `.env.local` provide the initial model and root defaults. Disabled agents cannot be chatted with, delegated to, or run by schedules. CITY_ROOT is locked while your account has cities so their folders cannot be orphaned; set it before building cities if you need a custom location. The selected model must already be installed in Ollama.

## A2A agent access
Agent City exposes an inbound A2A v1.0 JSON-RPC endpoint at `/api/a2a` and a public Agent Card at `/.well-known/agent-card.json`. This lets external A2A clients discover Agent City and submit tasks to an enabled agent in one of the caller's cities. It does not make Agent City discover or call arbitrary remote agents.

In production, set `A2A_PUBLIC_URL` to the public HTTPS origin before starting the server. Keep the server behind HTTPS; do not expose the A2A endpoint over plain HTTP on a public network. Local development uses `http://localhost:3000`.

Every A2A request must use `Authorization: Bearer <Google ID token>`. The token audience must match `AUTH_GOOGLE_ID`, and its Google account must have signed into Agent City at least once. An Auth.js browser session cookie is not accepted. The A2A client must obtain the ID token through a Google OpenID Connect flow for the same OAuth client; ID tokens are short-lived and should not be stored or logged by clients.

For `SendMessage`, include routing information in the user message's metadata:

```json
{
  "agentCity": {
    "cityId": 1,
    "agentId": "librarian"
  }
}
```

`agentId` must be one of `mayor`, `librarian`, `professor`, `builder`, or `planner`; the city must belong to the authenticated user and the agent must be enabled in that user's Settings. Requests currently accept `text/plain` content. Agent tasks and lifecycle state are stored in the same local `data/city.db`; completed agent outputs continue to be saved to SQLite and the city's `outputs/` folder. There is no separate backend service.

## Document Studio
Open **Documents** from a city page to use the PDF Maker, Editor, and Judge workflow. The PDF Maker and Editor call the selected Ollama model without Google or MCP integrations. You can revise the Markdown draft, save it into the city knowledge library, and use **Print / Save as PDF** in the browser to export a PDF.

Upload individual files or a folder of PDF, TXT, and Markdown files. Files are stored under that city's `knowledge/` folder; their extracted text is split into overlapping chunks and indexed in `document_sources` and `document_chunks` in `data/city.db`. Uploads are limited to 20 MB per file, 50 MB per batch, and 200 pages per PDF. Scanned/image-only PDFs are not OCR'd. Re-uploading identical file bytes is deduplicated.

The Judge workflow retrieves the six most relevant passages from that city's library and builds a cited context brief directly from them, then sends the task and evidence to an enabled worker and asks Mayor for a final evidence-based review. This avoids an extra, serial Ollama call for a separate Judge summary. The Mayor review has no tools, and the workflow does not connect Google Calendar or GitHub MCP integrations. Enable Mayor and at least one worker in Settings. Worker and Mayor outputs are saved like other agent outputs. Source files and chunks are stored on the Agent City host; inference goes to the configured `OLLAMA_URL` (which defaults to local Ollama). There is no separate backend service.
