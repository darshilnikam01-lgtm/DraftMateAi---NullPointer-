"""Document pipeline: file -> Markdown (MarkItDown), chunking, cheap retrieval, cached style profile."""
import math
import os
import re
import tempfile
import uuid
from pathlib import Path

from markitdown import MarkItDown

import config
import llm

_md = MarkItDown()
FILES: dict[str, dict] = {}  # file_id -> {name, role, text, style}   (in memory is fine for a prototype)

STOP = set("the and for that with this from have been shall will your their there which would about into upon under such".split())


def estimate_tokens(s: str) -> int:
    return max(1, len(s) // 4)  # rough: ~4 characters per token


def convert_to_markdown(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix or ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        if suffix.lower() in (".txt", ".md"):
            return data.decode("utf-8", errors="ignore")
        return _md.convert(path).text_content
    finally:
        os.remove(path)


def add_file(filename: str, role: str, text: str) -> str:
    fid = uuid.uuid4().hex[:12]
    while len(FILES) >= config.MAX_FILES:  # keep memory bounded on a long-running server
        FILES.pop(next(iter(FILES)))
    FILES[fid] = {"name": filename, "role": role, "text": text, "style": None}
    return fid


def chunk(text: str, size: int = 900) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        if cur and len(cur) + len(p) > size:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


def retrieve(query: str, text: str, max_chars: int = 6000) -> str:
    """Keep the first chunk (title/parties) plus the chunks that best match the query, in original order."""
    if len(text) <= max_chars:
        return text
    words = {w for w in re.findall(r"[a-zA-Z]{4,}", query.lower()) if w not in STOP}
    chunks = chunk(text)
    scored = []
    for i, c in enumerate(chunks):
        low = c.lower()
        score = sum(1 for w in words if w in low) / math.sqrt(len(c) + 1)
        scored.append((score, i))
    chosen, used = {0}, len(chunks[0])
    for score, i in sorted(scored, reverse=True):
        if i in chosen:
            continue
        if used + len(chunks[i]) > max_chars:
            continue
        chosen.add(i)
        used += len(chunks[i])
    return "\n\n".join(chunks[i] for i in sorted(chosen))


STYLE_PROMPT = """Study the DRAFTING STYLE of the legal document below. Ignore its facts, names, amounts and dates.
Write a compact style guide (max 220 words) covering:
- Tone and register
- Overall structure and order of sections
- Numbering and heading conventions
- Stock phrases and preferred terminology (list up to 8 exact phrases)
- Formatting habits (capitalisation, bold, date format, signature block)
- Typical clause patterns
Use short bullet points. Do not copy any party names or figures.

DOCUMENT:
{doc}"""


def style_profile(file_id: str, model: str | None = None) -> str:
    f = FILES[file_id]
    if not f.get("style"):
        f["style"] = llm.complete(STYLE_PROMPT.format(doc=f["text"][:12000]), model, temperature=0.2, fast=True)
    return f["style"]
