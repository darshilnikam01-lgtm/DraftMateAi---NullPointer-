"""Skills are plain Markdown files in /skills. Adding a file = adding a skill. No code changes.
The folder is re-read on every call, so new skills appear live without restarting the server."""
from pathlib import Path

import yaml

SKILLS_DIR = Path(__file__).parent / "skills"

FALLBACK = {
    "id": "general-drafting",
    "name": "General Drafting",
    "category": "Drafting",
    "description": "Any other drafting or editing request.",
    "instructions": "Follow the user's instruction. Never invent citations.",
    "mode": {},
}


def _normalise(info: dict, stem: str) -> dict:
    info.setdefault("id", stem)
    info.setdefault("name", stem)
    info.setdefault("category", "General")
    info.setdefault("description", "")
    m = info.get("mode") or {}
    m.setdefault("layout", "editor")  # editor | review (source document beside the draft)
    m.setdefault("panels", ["verification"])
    m.setdefault("fields", [])
    m.setdefault("quick_actions", [])
    m.setdefault("exports", ["docx", "pdf"])
    m.setdefault("context_mode", "retrieve")  # retrieve (relevant chunks) | full (whole document)
    m.setdefault("needs_file", False)
    info["mode"] = m
    return info


def load_skills() -> dict:
    skills = {}
    for p in sorted(SKILLS_DIR.glob("*.md")):
        raw = p.read_text(encoding="utf-8")
        if not raw.startswith("---"):
            continue
        _, meta, body = raw.split("---", 2)
        info = _normalise(yaml.safe_load(meta) or {}, p.stem)
        info["instructions"] = body.strip()
        skills[info["id"]] = info
    if "general-drafting" not in skills:
        skills["general-drafting"] = _normalise(dict(FALLBACK), "general-drafting")
    return skills


def public_skill(s: dict) -> dict:
    return {k: s[k] for k in ("id", "name", "category", "description")}
