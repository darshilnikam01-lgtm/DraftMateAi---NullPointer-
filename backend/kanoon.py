import re

import httpx
from bs4 import BeautifulSoup

import config

CLEAN = re.compile(r"\s+")


def _text(html: str) -> str:
    return CLEAN.sub(" ", BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)).strip()


def search(q: str, n: int = 6) -> list[dict]:
    q = q.strip()[:250]
    if not q:
        return []
    try:
        with httpx.Client(timeout=12, follow_redirects=True) as c:
            if config.IK_TOKEN:
                r = c.post("https://api.indiankanoon.org/search/", params={"formInput": q, "pagenum": 0},
                           headers={"Authorization": f"Token {config.IK_TOKEN}"})
                r.raise_for_status()
                return [
                    {"title": _text(d.get("title", "")), "court": d.get("docsource", ""),
                     "snippet": _text(d.get("headline", ""))[:300], "url": f"https://indiankanoon.org/doc/{d['tid']}/"}
                    for d in r.json().get("docs", [])[:n]
                ]
            r = c.get("https://indiankanoon.org/search/", params={"formInput": q})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            out = []
            for a in soup.select("div.result_title a"):
                m = re.search(r"/(?:doc|docfragment)/(\d+)/", a.get("href", ""))
                if m:
                    out.append({"title": a.get_text(" ", strip=True), "court": "", "snippet": "",
                                "url": f"https://indiankanoon.org/doc/{m.group(1)}/"})
            return out[:n]
    except Exception:
        return []


def as_prompt_block(hits: list[dict]) -> str:
    if not hits:
        return ("## Indian Kanoon search\nNo results could be retrieved right now. Do NOT name specific cases. "
                "Describe principles in words and write [CITATION TO BE VERIFIED] where an authority is needed.")
    lines = [f"- {h['title']} | {h['court']} | {h['url']}" + (f"\n  Extract: {h['snippet']}" if h["snippet"] else "") for h in hits]
    return ("## Indian Kanoon search results (retrieved just now from the real database)\n"
            "These are the ONLY cases you may name. Cite each exactly as titled, and only for what its extract supports. "
            "If none is relevant, say so instead of naming another case.\n" + "\n".join(lines))
