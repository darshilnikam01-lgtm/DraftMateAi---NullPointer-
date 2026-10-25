# DraftMate AI: step-by-step guide (setup to demo)

All the code is already in this folder. This guide tells you what to do, in order, what each file is for,
how to test every step, and what to say in the demo.

---------------------------------------------------------------------

## What exists and what is verified

| Part | Status |
|---|---|
| Backend routes that need no AI (skills, upload, MarkItDown conversion, token retrieval, export to Word, finalize check) | Tested by script |
| Citation status logic (verified / partly verified / unverified) | Tested against a FAKE Indian Kanoon, not the real site |
| Routing and the in-workspace turn logic | Tested with a FAKE LLM |
| Frontend | Compiles (`npm run build` passes). Not yet clicked through in a browser with a live backend |
| Live Gemini calls, real Indian Kanoon lookups, microphone | NOT tested. Do Step 3 and Step 4 first thing |

Treat Steps 3 to 6 as "run it and fix what the first real run shows".

---------------------------------------------------------------------

## Step 0. Team split (10 minutes)

| Person | Owns | Files |
|---|---|---|
| Backend and AI | prompts, routing, skills | `backend/main.py`, `prompts.py`, `skills/*.md` |
| Documents and verification | MarkItDown, style profile, Indian Kanoon lookup | `documents.py`, `verify.py` |
| Frontend | chat, workspace, editor, panels | `frontend/src/**` |
| Voice, export, demo | `useSpeech.js`, `exporter.py`, demo script, slides | |

If you are fewer people, one person takes each pair, in that order of priority.

## Step 1. Get a Gemini key

1. Open Google AI Studio and create an API key.
2. In AI Studio, note a currently available model name (for example one of the `gemini-2.5-*` models).
3. Never commit the key. `.env` is already git-ignored.

## Step 2. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # edit: GEMINI_API_KEY and GEMINI_MODEL
python -m uvicorn main:app --reload --port 8000
```

Test without any AI: open http://localhost:8000/docs and try
- `GET /api/health` (shows `llm_key_set: true` once your key is in `.env`)
- `GET /api/skills` (five skills)
- `POST /api/upload` with a PDF or DOCX (returns an id and a token count)

Adding a skill live (the extensibility demo): create `backend/skills/my-skill.md` with the same front-matter as the
others, then call `GET /api/skills` again. It appears without a restart.

## Step 3. First real AI test (backend only)

In `/docs`, call `POST /api/route` with
```json
{"instruction": "Send a notice to Rahul Sharma for not paying Rs 50000 rent, 15 days"}
```
Expect `kind: "mode"`, `skill.id: "legal-notice"`, `params` containing recipient, amount, deadline, and `missing_fields`
containing `sender`. If it errors, read the message: wrong model name and missing key are the usual causes.

Then `POST /api/generate` with `{"instruction": "Draft the notice", "skill_id": "legal-notice", "params": {"sender": "Anil Verma", "recipient": "Rahul Sharma"}}`.
You should get HTML. If you see `[[DRAFTMATE_ERROR]]`, the text after it is the cause.

## Step 4. Check the verification module against the real source

```bash
cd backend && source .venv/bin/activate
python - <<'PY'
import asyncio, verify
html = "<p>See Section 138 of the Negotiable Instruments Act, 1881 and Fake Person v. Imaginary Corp (2020) 1 SCC 1.</p>"
for r in asyncio.run(verify.verify_html(html)): print(r["status"], "|", r["text"], "|", r["reason"])
PY
```
Expected: the real Act comes back verified or partly verified, the invented case comes back unverified.

If everything is "unverified" with "Source lookup failed" or "No matching judgment", the public Indian Kanoon page
layout or access rules may differ from what the code assumes. Fix `ik_search` in `verify.py` (the CSS selector
`div.result_title a`), or request an API token from Indian Kanoon and set `INDIANKANOON_TOKEN` in `.env`.
This is the most likely thing to need adjusting. Do it early.

Be honest in the demo about what verification is: a lookup against Indian Kanoon, with statute checks being a
heuristic (it confirms the Act exists and the section number appears in its text, not that the quoted wording is right).

## Step 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 in **Chrome** (voice input needs Chrome or Edge). Vite proxies `/api` to port 8000.

### How the screen behaves
1. **Home**: centred chat. Type, speak (microphone), attach files (paperclip), or open the Skills menu.
2. You write a sentence. `POST /api/route` decides: a normal answer in chat, or a task.
3. **Task**: the chat narrows to a left column and the workspace slides in on the right.
   - Top: skill switcher, model selector, token statistics, History, Leave, Finish.
   - Details row: fields extracted from your sentence. Missing required ones are outlined; the chat asks for them.
   - Quick actions come from the skill file (Firmer tone, Add interest clause, and so on).
   - Centre: the draft sheet (editable). Right: the Citation review panel.
4. Every message inside the workspace goes to `POST /api/mode/turn`, which returns one action:
   `set_params`, `generate`, `edit_draft`, `verify`, `finalize`, `exit` or `answer`.
   Destructive actions (delete, overwrite) open a confirmation dialog first. A version is saved before every change.
5. **Finish** opens a checklist (placeholders left, unverified and partly verified citations), then export
   (Word file from the backend, PDF through the browser print dialog) and returns to chat with a result card.
   The card has **Reopen**.

## Step 6. Test the whole flow (run this list)

| You do | Expected |
|---|---|
| Click an example on the home screen | Workspace opens, chat asks only for the missing client name |
| Type "my client is Anil Verma" | Field fills, draft streams in, citations are checked |
| Click a quick action such as "Firmer tone" | Confirmation dialog (it rewrites the draft), then the draft changes, a version is saved |
| Type "delete the second paragraph" | Confirmation dialog appears |
| Click the microphone, say "change the notice period to 30 days" | "Heard: ..." bar with a 2 second send window, field and draft update |
| Open History, click Restore | Older version returns, current one is saved first |
| Attach a reference notice (role: Reference style), then draft | Style guide is extracted once and cached; "Context" token figure shows below a full paste |
| Pick Contract Review, attach a contract as Source material | Source document shows beside the draft; risk table is generated |
| Add a fake case citation by hand in the editor, press "Check again" | It shows as Unverified |
| Finish | Checklist, Word download opens correctly, result card appears in chat |

## Step 7. Make the demo reliable

1. Prepare two files: a real past legal notice (reference) and a short rent agreement (for review). Keep them with the project.
2. Rehearse the full flow twice on the demo laptop, on the demo network. Gemini and Indian Kanoon both need internet.
3. Know your fallback: if the microphone fails, type the same sentence. If Indian Kanoon is slow, run the check once before the demo so the panel is already populated.
4. Do not demo the first generation cold. Run it once, then start the recording.

### Suggested 5 minute demo script
1. (30s) Problem: lawyers use many tools, and AI invents citations.
2. (60s) Say: "Draft a legal notice to Rahul Sharma for not paying 50,000 rupees rent, 15 days." Workspace opens, draft streams.
3. (45s) Show the Citation review: one verified, one partly verified, one unverified. Say plainly that the AI never decides what is real; a lookup does.
4. (45s) Voice: "Change the notice period to 30 days", then "Delete the second paragraph" and show the confirmation.
5. (30s) Reference style: attach a past notice, redraft, show the token saving in the header.
6. (30s) Add a new skill file live, refresh the Skills menu, it is there.
7. (30s) Finish, show the checklist, download the Word file, show the result card in chat.

## Step 8. What to build next (in this order)

1. Check the proposition, not only the existence: fetch the judgment text and ask the model whether it supports the sentence it is cited for, then show that as "Partly verified: case exists, proposition unconfirmed".
2. India Code lookup for statutes (current check uses Indian Kanoon only).
3. Redline view: show a diff between versions (the `diff` npm package) with additions in green, deletions struck through.
4. Persist uploads and sessions (SQLite) so a server restart does not lose them.
5. Backend speech-to-text (for example OpenWhispr or Whisper) to replace the browser Web Speech API, and optional spoken replies.
6. Real model choices: add more names to `GEMINI_MODELS` in `.env`; the dropdown reads them.

## Known limits (say these if asked)

- Uploaded files live in server memory. Restarting the backend clears them.
- Scanned PDFs have no text layer. The upload says so; OCR is not included.
- Voice input uses the browser's speech recognition (Chrome or Edge, needs internet).
- PDF export uses the browser print dialog. Word export is generated by the backend.
- Token figures are estimates (about 4 characters per token), compared against pasting every uploaded document in full.
- The model names in `.env.example` change over time. Check AI Studio for what is currently offered.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Red toast "Cannot reach the backend" | Backend not running on port 8000, or you opened the frontend from another machine |
| "GEMINI_API_KEY is missing" | `.env` not created in `backend/`, or the server was not restarted |
| "LLM error: 404 ... model" | Wrong `GEMINI_MODEL`. Pick a current name from AI Studio |
| Draft never appears, chat says drafting failed | Read the message; usually quota or model name |
| Microphone button greyed out | Not Chrome or Edge, or the page is not on localhost/https |
| Every citation "unverified" | See Step 4: Indian Kanoon selectors or access |
| `npm run dev` blank page | Open the browser console; usually the backend is down, or a Node version below 18 |
