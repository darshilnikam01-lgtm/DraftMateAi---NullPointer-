"""Builds the generation prompt and reports how many tokens the optimisations saved."""
import documents
import kanoon
import langs
from skills_loader import load_skills

SYSTEM = """You are DraftMate AI, a drafting assistant for Indian advocates, law students and legal researchers.
Rules you must always follow:
1. Never invent case names, citations, section numbers or quotations. If you are unsure of an authority, write [CITATION TO BE VERIFIED].
2. For any fact you were not given (names, dates, amounts, addresses), use a placeholder in [BRACKETED CAPITALS]. Never fabricate facts.
3. Output ONLY an HTML fragment using h1, h2, h3, p, ol, ul, li, strong, em, table, tr, th, td. No markdown, no code fences, no commentary before or after.
4. When editing an existing draft, preserve its substantive meaning and everything the user did not ask to change, and return the COMPLETE updated document."""


def build_generate_prompt(req) -> tuple[str, dict]:
    skills = load_skills()
    skill = skills.get(req.skill_id) or skills["general-drafting"]
    mode = skill["mode"]

    parts = [SYSTEM, f"## Skill: {skill['name']}\n{skill['instructions']}"]
    naive = len(SYSTEM) + len(skill["instructions"])  # what a naive "paste everything" prompt would cost

    note = langs.note(getattr(req, "lang", "en"))
    if note:
        parts.append(f"## Language\n{note}")

    if mode.get("ik_search") and req.instruction.strip():
        parts.append(kanoon.as_prompt_block(kanoon.search(req.instruction)))

    facts = {k: v for k, v in (req.params or {}).items() if v}
    if facts:
        parts.append("## Facts provided by the user (use exactly as given)\n" + "\n".join(f"- {k}: {v}" for k, v in facts.items()))

    for fid in req.file_ids:
        f = documents.FILES.get(fid)
        if not f:
            continue
        naive += len(f["text"])
        if f["role"] == "reference":
            style = documents.style_profile(fid, req.model)
            parts.append(
                f"## Style guide extracted from the user's reference document '{f['name']}'\n"
                f"Match this tone, structure and formatting. Do NOT reuse its facts or content.\n{style}"
            )
        elif f["role"] == "template":
            parts.append(f"## Template '{f['name']}' (keep its structure and clause order)\n{f['text'][:12000]}")
        else:
            if mode.get("context_mode") == "full":
                text = f["text"][:30000]
            else:
                text = documents.retrieve(req.instruction, f["text"], max_chars=6000)
            parts.append(f"## Source material '{f['name']}'\n{text}")

    if req.current_draft.strip():
        naive += len(req.current_draft)
        parts.append(f"## Current draft (HTML)\n{req.current_draft}")

    naive += len(req.instruction)
    parts.append(f"## User instruction\n{req.instruction}")
    prompt = "\n\n".join(parts)

    stats = {"prompt_tokens": documents.estimate_tokens(prompt), "naive_tokens": documents.estimate_tokens(" " * naive)}
    return prompt, stats
