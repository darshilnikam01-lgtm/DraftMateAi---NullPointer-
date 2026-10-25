"""Citation and authority verification.

Pipeline: extract citations (LLM + regex) -> look each one up in Indian Kanoon (an external source, NOT the LLM)
-> assign a status:  verified | partial | unverified   with a source link and a plain-language reason.

The LLM is only used to FIND citations in the draft. Whether a citation is real is decided by the lookup.
"""
import asyncio
import re

import httpx
from bs4 import BeautifulSoup

import config
import llm

PLACEHOLDER = "[CITATION TO BE VERIFIED]"
HEADERS = {"User-Agent": "Mozilla/5.0 (DraftMate AI hackathon prototype)"}
MAX_CITATIONS = 15

CASE_CITE_RE = re.compile(
    r"\(\s*\d{4}\s*\)\s*\d+\s*SCC\s*\d+|AIR\s*\d{4}\s*(?:SC|[A-Z][a-z]{1,10})\s*\d+|\d{4}\s*SCC\s*OnLine\s*[A-Za-z]+\s*\d+"
)
STATUTE_RE = re.compile(
    r"[Ss]ections?\s+\d+[A-Z]?(?:\(\w+\))*\s+(?:of\s+)?(?:the\s+)?[A-Z][A-Za-z&.,' ]{3,70}?(?:Act|Code|Sanhita)(?:,?\s*\d{4})?"
)
PARTY_STOP = {"state", "union", "india", "ltd", "limited", "the", "and", "others", "anr", "ors", "of", "pvt", "private", "vs", "versus", "co", "company"}


def html_to_text(html: str) -> str:
    return BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


# ---------- 1. extraction ----------
EXTRACT_PROMPT = """From the legal text below, list EVERY legal authority that is actually cited: reported cases, statutes with sections, constitutional articles.
Only include authorities that literally appear in the text. Do not add any from your own knowledge.
Return ONLY a JSON array. Each item:
{{"text": "<exact string as written in the text>", "type": "case" | "statute" | "other",
  "case_name": "<'A v. B' as written, or null>", "cite": "<reporter citation if present, else null>",
  "act": "<name of the Act if statute, else null>", "section": "<section number if statute, else null>"}}
If there are none, return [].

TEXT:
{text}"""


def extract_citations(html: str, model: str | None = None) -> list[dict]:
    text = html_to_text(html)
    items = []
    try:
        found = llm.complete_json(EXTRACT_PROMPT.format(text=text[:20000]), model, fallback=[])
        if isinstance(found, list):
            items = [i for i in found if isinstance(i, dict) and i.get("text")]
    except Exception:
        items = []  # fall back to regex only

    known = " ".join(i["text"] for i in items)
    for m in CASE_CITE_RE.finditer(text):
        if m.group(0) not in known:
            items.append({"text": m.group(0), "type": "case", "case_name": None, "cite": m.group(0)})
    for m in STATUTE_RE.finditer(text):
        if m.group(0) not in known:
            items.append({"text": m.group(0), "type": "statute", "act": None, "section": None})

    items = [i for i in items if PLACEHOLDER not in i["text"]]
    seen, out = set(), []
    for i in items:
        key = norm(i["text"])
        if key and key not in seen:
            seen.add(key)
            out.append(i)
    return out[:MAX_CITATIONS]


# ---------- 2. lookup (Indian Kanoon) ----------
async def ik_search(client: httpx.AsyncClient, q: str) -> list[dict]:
    if config.IK_TOKEN:
        r = await client.post(
            "https://api.indiankanoon.org/search/",
            params={"formInput": q, "pagenum": 0},
            headers={"Authorization": f"Token {config.IK_TOKEN}"},
        )
        r.raise_for_status()
        return [
            {"title": BeautifulSoup(d.get("title", ""), "html.parser").get_text(), "tid": str(d["tid"]),
             "url": f"https://indiankanoon.org/doc/{d['tid']}/"}
            for d in r.json().get("docs", [])[:8]
        ]
    r = await client.get("https://indiankanoon.org/search/", params={"formInput": q})
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.select("div.result_title a"):
        m = re.search(r"/(?:doc|docfragment)/(\d+)/", a.get("href", ""))
        if m:
            out.append({"title": a.get_text(" ", strip=True), "tid": m.group(1), "url": f"https://indiankanoon.org/doc/{m.group(1)}/"})
    return out[:8]


async def ik_doc_text(client: httpx.AsyncClient, tid: str) -> str:
    if config.IK_TOKEN:
        r = await client.post(f"https://api.indiankanoon.org/doc/{tid}/", headers={"Authorization": f"Token {config.IK_TOKEN}"})
        r.raise_for_status()
        return BeautifulSoup(r.json().get("doc", ""), "html.parser").get_text(" ", strip=True)
    r = await client.get(f"https://indiankanoon.org/doc/{tid}/")
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser").get_text(" ", strip=True)


# ---------- 3. matching ----------
def party_tokens(case_name: str) -> list[set]:
    parts = re.split(r"\s+(?:v\.?|vs\.?|versus)\s+", case_name, flags=re.I)
    result = []
    for p in parts:
        toks = {w for w in re.findall(r"[a-z]{3,}", p.lower()) if w not in PARTY_STOP}
        if toks:
            result.append(toks)
    return result


def title_score(tokens: list[set], title: str) -> float:
    if not tokens:
        return 0.0
    low = title.lower()
    hits = [sum(1 for t in side if t in low) / len(side) for side in tokens]
    return sum(hits) / len(hits)


async def verify_case(client, c: dict) -> dict:
    name, cite = c.get("case_name"), c.get("cite")
    query = name or cite or c["text"]
    results = await ik_search(client, query)
    if not results:
        return {"status": "unverified", "reason": "No matching judgment found in Indian Kanoon.", "source_url": None}

    tokens = party_tokens(name) if name else []
    best, best_score = None, 0.0
    for r in results:
        s = title_score(tokens, r["title"]) if tokens else 0.0
        if s > best_score:
            best, best_score = r, s

    if tokens and best_score >= 0.99:
        if not cite:
            return {"status": "partial", "reason": "A judgment with these party names exists, but no reporter citation was given to confirm.", "source_url": best["url"]}
        text = await ik_doc_text(client, best["tid"])
        if norm(cite) in norm(text):
            return {"status": "verified", "reason": "Case found and the reporter citation appears in the judgment text.", "source_url": best["url"]}
        return {"status": "partial", "reason": "A judgment with these party names exists, but the citation could not be confirmed in its text.", "source_url": best["url"]}
    if tokens and best_score >= 0.5:
        return {"status": "partial", "reason": "Only one party name matched a judgment. Check it manually.", "source_url": best["url"]}

    if not tokens and cite:  # citation only, no case name
        for r in results[:2]:
            text = await ik_doc_text(client, r["tid"])
            if norm(cite) in norm(text):
                return {"status": "verified", "reason": "The citation appears in this judgment.", "source_url": r["url"]}
    return {"status": "unverified", "reason": "No judgment matching this name and citation was found.", "source_url": None}


async def verify_statute(client, c: dict) -> dict:
    act, section = c.get("act"), c.get("section")
    if not act:
        m = re.search(r"(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z&.,' ]{3,70}?(?:Act|Code|Sanhita)(?:,?\s*\d{4})?)", c["text"])
        act = m.group(1).strip() if m else None
    if not section:
        m = re.search(r"\d+[A-Z]?", c["text"])
        section = m.group(0) if m else None
    if not act:
        return {"status": "unverified", "reason": "Could not identify the Act being cited.", "source_url": None}

    results = await ik_search(client, act)
    act_tokens = {w for w in re.findall(r"[a-z]{3,}", act.lower()) if w not in PARTY_STOP | {"act", "code", "section"}}
    for r in results:
        title = r["title"].lower()
        if " v. " in title or " vs " in title:
            continue  # a judgment, not the Act itself
        if act_tokens and all(t in title for t in act_tokens):
            if section:
                text = await ik_doc_text(client, r["tid"])
                if re.search(rf"(?<!\d){re.escape(section)}(?![\dA-Za-z])", text):
                    return {"status": "verified", "reason": f"Act located and section {section} appears in its text.", "source_url": r["url"]}
            return {"status": "partial", "reason": "Act located, but the section number could not be confirmed in its text.", "source_url": r["url"]}
    return {"status": "unverified", "reason": "This Act could not be located in the accessible source.", "source_url": None}


async def verify_one(client, sem, idx: int, c: dict) -> dict:
    async with sem:
        base = {"id": idx, "text": c["text"], "type": c.get("type", "other")}
        try:
            if c.get("type") == "case":
                res = await verify_case(client, c)
            elif c.get("type") == "statute":
                res = await verify_statute(client, c)
            else:
                res = {"status": "unverified", "reason": "This kind of authority cannot be checked automatically. Verify manually.", "source_url": None}
        except Exception as e:
            res = {"status": "unverified", "reason": f"Source lookup failed ({type(e).__name__}). Treat as unverified.", "source_url": None}
        return {**base, **res}


async def verify_html(html: str, model: str | None = None) -> list[dict]:
    citations = await asyncio.to_thread(extract_citations, html, model)
    text = html_to_text(html)
    results = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=12, follow_redirects=True) as client:
        sem = asyncio.Semaphore(3)
        results = await asyncio.gather(*[verify_one(client, sem, i + 1, c) for i, c in enumerate(citations)])
    results = list(results)

    n_placeholders = text.count(PLACEHOLDER)
    if n_placeholders:
        results.append({
            "id": len(results) + 1, "text": f"{PLACEHOLDER} (x{n_placeholders})", "type": "placeholder", "status": "unverified",
            "reason": "The drafter was unsure of an authority here. Add the correct one and verify it manually.", "source_url": None,
        })
    return results
