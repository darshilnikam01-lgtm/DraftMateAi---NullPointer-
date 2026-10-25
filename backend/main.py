import base64
import json
import re
import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import db
import documents
import exporter
import langs
import llm
import verify
from prompts import build_generate_prompt
from skills_loader import load_skills, public_skill

app = FastAPI(title="DraftMate AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Prompt-Tokens", "X-Naive-Tokens"],
)

ERROR_MARKER = "[[DRAFTMATE_ERROR]]"


# --------------------------------------------------------------------- optional password protection
def _check_basic_auth(header: str) -> bool:
    if not header.lower().startswith("basic "):
        return False
    try:
        user, _, pw = base64.b64decode(header[6:]).decode("utf-8").partition(":")
    except Exception:
        return False
    return secrets.compare_digest(user.encode(), config.APP_USER.encode()) and secrets.compare_digest(
        pw.encode(), config.APP_PASSWORD.encode()
    )


@app.middleware("http")
async def basic_auth(request: Request, call_next):
    # Disabled unless APP_PASSWORD is set. /api/health stays open for platform health checks.
    if not config.APP_PASSWORD or request.method == "OPTIONS" or request.url.path == "/api/health":
        return await call_next(request)
    if _check_basic_auth(request.headers.get("authorization", "")):
        return await call_next(request)
    return Response("Authentication required", status_code=401, headers={"WWW-Authenticate": 'Basic realm="DraftMate AI"'})


# --------------------------------------------------------------------- basics
@app.get("/api/health")
def health():
    return {"status": "ok", "llm_key_set": bool(config.GEMINI_API_KEY)}


@app.get("/api/skills")
def list_skills():
    return [public_skill(s) for s in load_skills().values()]


db.init()


class DraftIn(BaseModel):
    title: str = "Untitled draft"
    custom: bool = False
    skill_id: str
    skill_name: str = ""
    params: dict = {}
    goal: str = ""
    content: str = ""
    versions: list = []


class RenameReq(BaseModel):
    title: str


@app.get("/api/drafts")
def list_drafts():
    return db.list_drafts()


@app.get("/api/drafts/{draft_id}")
def get_draft(draft_id: str):
    d = db.get_draft(draft_id)
    if not d:
        raise HTTPException(404, "Draft not found.")
    return d


@app.put("/api/drafts/{draft_id}")
def save_draft(draft_id: str, req: DraftIn):
    if len(req.content) > 2_000_000:
        raise HTTPException(413, "Draft is too large to save.")
    data = req.model_dump()
    data["title"] = data["title"].strip()[:120] or "Untitled draft"
    db.save_draft(draft_id, data)
    return {"ok": True}


@app.post("/api/drafts/{draft_id}/rename")
def rename_draft(draft_id: str, req: RenameReq):
    title = req.title.strip()[:120]
    if not title:
        raise HTTPException(400, "Title cannot be empty.")
    if not db.rename_draft(draft_id, title):
        raise HTTPException(404, "Draft not found.")
    return {"ok": True}


@app.delete("/api/drafts/{draft_id}")
def delete_draft(draft_id: str):
    db.delete_draft(draft_id)
    return {"ok": True}


@app.get("/api/languages")
def list_languages():
    return [{"code": k, "name": v} for k, v in langs.LANGS.items()]


@app.get("/api/models")
def list_models():
    return [{"id": m, "name": m} for m in config.MODELS]


# --------------------------------------------------------------------- files
@app.post("/api/upload")
async def upload(file: UploadFile = File(...), role: str = Form("reference")):
    if role not in ("reference", "template", "source"):
        raise HTTPException(400, "role must be reference, template or source")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 15 MB).")
    try:
        text = await run_in_threadpool(documents.convert_to_markdown, file.filename or "file.txt", data)
    except Exception as e:
        raise HTTPException(422, f"Could not read this file: {e}")
    if not text.strip():
        raise HTTPException(422, "No readable text found. Scanned PDFs need OCR.")
    name = file.filename or "file.txt"
    fid = documents.add_file(name, role, text)
    return {"id": fid, "name": name, "role": role, "chars": len(text), "tokens": documents.estimate_tokens(text), "status": "ready"}


class RoleReq(BaseModel):
    role: str


@app.post("/api/files/{file_id}/role")
def set_role(file_id: str, req: RoleReq):
    if req.role not in ("reference", "template", "source"):
        raise HTTPException(400, "role must be reference, template or source")
    f = documents.FILES.get(file_id)
    if not f:
        raise HTTPException(404, "Unknown file")
    f["role"] = req.role
    return {"id": file_id, "role": req.role}


@app.get("/api/files/{file_id}")
def get_file(file_id: str):
    f = documents.FILES.get(file_id)
    if not f:
        raise HTTPException(404, "Unknown file")
    return {"id": file_id, "name": f["name"], "role": f["role"], "text": f["text"]}


@app.delete("/api/files/{file_id}")
def delete_file(file_id: str):
    documents.FILES.pop(file_id, None)
    return {"ok": True}


# --------------------------------------------------------------------- routing (home screen)
class RouteReq(BaseModel):
    instruction: str
    has_draft: bool = False
    file_ids: list[str] = []
    force_skill_id: Optional[str] = None
    model: Optional[str] = None
    lang: str = "en"


ROUTE_PROMPT = """You are the router of DraftMate AI, a legal drafting tool for Indian advocates and law students.

Available skills:
{catalog}

The user has a draft open: {has_draft}. Files uploaded: {n_files}.
User message: "{message}"
{lang}

Decide whether the message is a legal drafting / review / research task (is_task = true) or ordinary conversation or a general question (is_task = false).
Return ONLY JSON:
{{
  "is_task": true or false,
  "reply": "<if is_task is false: a helpful, concise answer. Never invent legal citations. Otherwise empty>",
  "skill_id": "<id from the list; general-drafting if nothing fits>",
  "confidence": <0.0 to 1.0>,
  "params": {{ "<fact key>": "<value the user EXPLICITLY stated>" }},
  "summary": "<one short sentence: what you will do>"
}}
For params: only include facts the user actually stated. Never guess or invent values."""


def _missing(skill: dict, params: dict, n_files: int):
    m = skill["mode"]
    missing = [f for f in m["fields"] if f.get("required") and not str(params.get(f["key"], "")).strip()]
    return missing, bool(m.get("needs_file")) and n_files == 0


@app.post("/api/route")
def route(req: RouteReq):
    skills = load_skills()
    forced = skills.get(req.force_skill_id) if req.force_skill_id else None
    pool = [forced] if forced else list(skills.values())
    catalog = "\n".join(
        f"- {s['id']}: {s['description']} (facts to extract: {[f['key'] for f in s['mode']['fields']]})" for s in pool
    )

    if forced and not req.instruction.strip():
        data = {"is_task": True, "skill_id": forced["id"], "confidence": 1.0, "params": {}, "summary": f"Opening {forced['name']}."}
    else:
        data = llm.complete_json(
            ROUTE_PROMPT.format(catalog=catalog, has_draft=req.has_draft, n_files=len(req.file_ids), message=req.instruction.replace('"', "'"), lang=langs.note(req.lang)),
            req.model,
            fallback={"is_task": True, "skill_id": "general-drafting", "confidence": 0.2, "params": {}, "summary": "Working on your request."},
        )

    if not data.get("is_task", True) and not forced:
        return {"kind": "chat", "reply": data.get("reply") or "How can I help with your drafting today?"}

    skill = forced or skills.get(data.get("skill_id")) or skills["general-drafting"]
    keys = {f["key"] for f in skill["mode"]["fields"]}
    params = {k: v for k, v in (data.get("params") or {}).items() if k in keys and v not in (None, "")}
    missing, missing_file = _missing(skill, params, len(req.file_ids))
    return {
        "kind": "mode",
        "skill": public_skill(skill),
        "confidence": float(data.get("confidence") or 0),
        "summary": data.get("summary") or f"Opening {skill['name']}.",
        "params": params,
        "missing_fields": missing,
        "missing_file": missing_file,
        "mode_config": skill["mode"],
    }


# --------------------------------------------------------------------- one turn inside a mode
class ModeTurn(BaseModel):
    message: str
    skill_id: str
    params: dict = {}
    draft: str = ""
    goal: str = ""
    file_ids: list[str] = []
    model: Optional[str] = None
    lang: str = "en"


TURN_PROMPT = """You control a legal drafting workspace. Active skill: {skill}.
Current settings: {params}
Setting keys you may set: {keys}
The draft is {draft_state}.
Required settings still missing: {missing}

The user said: "{message}"
{lang}

Choose ONE action. Return ONLY JSON:
{{
  "action": "set_params" | "generate" | "edit_draft" | "verify" | "finalize" | "exit" | "answer",
  "params": {{ "<key>": "<value the user explicitly stated>" }},
  "instruction": "<for generate / edit_draft: a clear, complete instruction for the drafting model>",
  "destructive": true or false,
  "reply": "<one short, friendly sentence telling the user what you are doing, or the answer for 'answer'>"
}}
Guidance:
- set_params: user is giving or changing a setting value (for example "30 days", "my client is Anil").
- generate: draft is empty and the user wants it written.
- edit_draft: change the existing draft (tone, add or remove clauses, change numbers).
- verify: user asks to check citations.
- finalize: user says they are done, wants to finish or export.
- exit: user wants to leave this workspace.
- answer: a question about the law or the draft that changes nothing. Never invent citations.
- destructive = true if the action deletes content or overwrites most of the draft."""

DESTRUCTIVE_RE = re.compile(r"\b(delete|remove|clear|erase|scrap|start over|start again|overwrite|discard)\b", re.I)


@app.post("/api/mode/turn")
def mode_turn(req: ModeTurn):
    skills = load_skills()
    skill = skills.get(req.skill_id) or skills["general-drafting"]
    keys = [f["key"] for f in skill["mode"]["fields"]]
    draft_empty = not verify.html_to_text(req.draft).strip()
    missing, missing_file = _missing(skill, req.params, len(req.file_ids))

    data = llm.complete_json(
        TURN_PROMPT.format(
            skill=skill["name"], params=json.dumps(req.params), keys=keys,
            draft_state="empty" if draft_empty else "present", missing=[f["key"] for f in missing] or "none",
            message=req.message.replace('"', "'"), lang=langs.note(req.lang),
        ),
        req.model,
        fallback={"action": "answer", "reply": "Sorry, I did not catch that. Could you rephrase?"},
    )
    action = data.get("action") if data.get("action") in ("set_params", "generate", "edit_draft", "verify", "finalize", "exit", "answer") else "answer"
    params = {k: v for k, v in (data.get("params") or {}).items() if k in keys and v not in (None, "")}
    merged = {**req.params, **params}
    missing, missing_file = _missing(skill, merged, len(req.file_ids))
    instruction = data.get("instruction") or req.message
    reply = data.get("reply") or ""

    if action == "edit_draft" and draft_empty:
        action = "generate"
    if action == "set_params" and draft_empty and not missing and not missing_file:
        action, instruction = "generate", req.goal or req.message
        reply = reply or "Got it. Drafting now."
    if action == "generate" and (missing or missing_file):
        action = "set_params"
        needs = [f["label"] for f in missing] + (["an uploaded document"] if missing_file else [])
        reply = "Before I draft, I still need: " + ", ".join(needs) + "."

    destructive = bool(data.get("destructive")) or (
        not draft_empty and action in ("edit_draft", "generate") and bool(DESTRUCTIVE_RE.search(req.message))
    ) or (not draft_empty and action == "generate")

    return {"action": action, "params": params, "instruction": instruction, "destructive": destructive, "reply": reply,
            "missing_fields": missing, "missing_file": missing_file}


# --------------------------------------------------------------------- generate (streaming)
class GenerateReq(BaseModel):
    instruction: str
    skill_id: Optional[str] = None
    params: dict = {}
    file_ids: list[str] = []
    current_draft: str = ""
    model: Optional[str] = None
    speed: str = "lite"
    lang: str = "en"


@app.post("/api/generate")
def generate(req: GenerateReq):
    prompt, stats = build_generate_prompt(req)  # errors here become normal HTTP errors

    def stream():
        try:
            yield from llm.stream(prompt, req.model, speed=req.speed)
        except Exception as e:
            yield f"\n{ERROR_MARKER} {e}"

    return StreamingResponse(
        stream(), media_type="text/plain; charset=utf-8",
        headers={"X-Prompt-Tokens": str(stats["prompt_tokens"]), "X-Naive-Tokens": str(stats["naive_tokens"])},
    )


# --------------------------------------------------------------------- verification
class VerifyReq(BaseModel):
    html: str
    model: Optional[str] = None


@app.post("/api/verify")
async def verify_endpoint(req: VerifyReq):
    items = await verify.verify_html(req.html, req.model)
    counts = {s: sum(1 for i in items if i["status"] == s) for s in ("verified", "partial", "unverified")}
    return {"citations": items, "counts": counts}


class FinalizeReq(BaseModel):
    draft: str
    skill_id: str
    unverified_count: int = 0
    partial_count: int = 0


@app.post("/api/finalize-check")
def finalize_check(req: FinalizeReq):
    text = verify.html_to_text(req.draft)
    placeholders = sorted(set(re.findall(r"\[[A-Z][A-Z0-9 .,_/-]{2,}\]", text)))
    skill = load_skills().get(req.skill_id) or load_skills()["general-drafting"]
    return {
        "placeholders": placeholders,
        "unverified": req.unverified_count,
        "partial": req.partial_count,
        "ready": not placeholders and req.unverified_count == 0,
        "exports": skill["mode"]["exports"],
    }


# --------------------------------------------------------------------- export
class ExportReq(BaseModel):
    html: str
    filename: str = "draft"


@app.post("/api/export")
def export(req: ExportReq):
    data = exporter.html_to_docx(req.html)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{re.sub(r"[^A-Za-z0-9_-]", "_", req.filename)}.docx"'},
    )


# --------------------------------------------------------------------- built frontend (production / Docker)
# The Dockerfile copies the Vite build into backend/static. In local dev this folder does not exist
# and Vite serves the frontend itself.
STATIC_DIR = Path(__file__).parent / "static"
if (STATIC_DIR / "index.html").is_file():
    if (STATIC_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        root = STATIC_DIR.resolve()
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(root / "index.html")
