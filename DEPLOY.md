# Deploying DraftMate AI

The app ships as **one Docker container**: the Dockerfile builds the React frontend, then FastAPI serves both the
API and the built frontend on a single port. No CORS setup, no separate frontend host.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `GEMINI_MODEL` | no | default `gemini-3.8-flash`; use only names listed in AI Studio |
| `APP_PASSWORD` | **strongly recommended** | turns on a browser login popup (user = `APP_USER`, default `draftmate`). Without it anyone with the URL can spend your Gemini quota |
| `INDIANKANOON_TOKEN` | recommended | the official API; scraping the public site often fails from cloud servers |
| `ALLOWED_ORIGINS` | no | only if the frontend is hosted on another domain |
| `MAX_FILES` | no | uploaded files kept in memory (default 200) |

## Option A: run locally with Docker (test this first)

```bash
cp backend/.env.example backend/.env     # fill in GEMINI_API_KEY (and APP_PASSWORD)
docker compose up --build
# open http://localhost:8000
```

## Option B: Render.com

1. Push this folder to a GitHub repo (`.gitignore` already excludes `.env` and `node_modules`).
2. Render dashboard: New > Blueprint > pick the repo (it reads `render.yaml`).
3. Enter `GEMINI_API_KEY`, `APP_PASSWORD`, `INDIANKANOON_TOKEN` when asked. Deploy.
4. Use the **starter** plan or higher: the free plan sleeps and wipes in-memory uploads.

## Option C: Railway / Fly.io / any VPS

Any host that runs a Dockerfile works. Set the variables above; the container listens on `$PORT` (default 8000).
Health check URL: `/api/health` (left open even when the password is on).

## After deploying, check

1. `/api/health` returns `{"status":"ok","llm_key_set":true}`.
2. The login popup appears (if `APP_PASSWORD` is set) and the home screen loads.
3. Click an example prompt, confirm the draft streams in.
4. Run a citation check. If everything says "unverified", set `INDIANKANOON_TOKEN`.
5. Microphone needs **HTTPS** and Chrome/Edge. Render/Railway/Fly provide HTTPS automatically.

## Limits to know about

- **Single worker, in-memory uploads.** A restart or redeploy clears uploaded files. Do not raise `--workers`
  above 1 or scale to several instances until uploads move to a database.
- No per-user accounts: one shared password. Add real auth before multi-user or client-data use.
- Scanned PDFs are rejected (no OCR). Token counts are estimates.
- Draft text and uploaded documents are sent to Google's Gemini API. Check that this is acceptable for
  confidential client material.
