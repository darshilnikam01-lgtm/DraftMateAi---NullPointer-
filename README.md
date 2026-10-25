# DraftMate AI · Legal Drafting Studio

Chat-first legal drafting. The user says what they need (typed or spoken); the backend picks a skill from `backend/skills/`,
the screen opens a task workspace, the user customises it by chat, voice, fields or quick actions, then finishes and returns to chat.

See **STEPS.md** for the build, run and demo guide, and **DEPLOY.md** for deployment (Docker, Render).

```
backend/   FastAPI + Gemini + MarkItDown + Indian Kanoon verification + python-docx export
frontend/  React + Vite + Tailwind + TipTap + Zustand
```

Requires **Python 3.10+** (3.11 recommended; markitdown will not install on older versions) and Node 18+.

Quick start

```bash
# terminal 1
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then put your Gemini key in .env
python -m uvicorn main:app --reload --port 8000

# terminal 2
cd frontend && npm install && npm run dev      # open http://localhost:5173 in Chrome
```

Docker (one container, serves frontend + API on :8000)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```
