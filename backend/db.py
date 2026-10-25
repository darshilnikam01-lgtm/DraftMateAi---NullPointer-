import json
import os
import sqlite3
import time

import config


def _conn():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS drafts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                renamed INTEGER NOT NULL DEFAULT 0,
                skill_id TEXT NOT NULL,
                skill_name TEXT NOT NULL DEFAULT '',
                params TEXT NOT NULL DEFAULT '{}',
                goal TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                versions TEXT NOT NULL DEFAULT '[]',
                updated_at REAL NOT NULL
            )"""
        )


def list_drafts():
    with _conn() as c:
        rows = c.execute("SELECT id, title, skill_id, skill_name, updated_at FROM drafts ORDER BY updated_at DESC").fetchall()
    return [dict(r) for r in rows]


def get_draft(draft_id):
    with _conn() as c:
        r = c.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["params"] = json.loads(d["params"])
    d["versions"] = json.loads(d["versions"])
    return d


def save_draft(draft_id, d):
    with _conn() as c:
        row = c.execute("SELECT renamed, title FROM drafts WHERE id = ?", (draft_id,)).fetchone()
        renamed = 1 if (row and row["renamed"]) or d["custom"] else 0
        title = row["title"] if row and row["renamed"] and not d["custom"] else d["title"]
        c.execute(
            """INSERT INTO drafts (id, title, renamed, skill_id, skill_name, params, goal, content, versions, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, renamed=excluded.renamed, skill_id=excluded.skill_id,
                 skill_name=excluded.skill_name, params=excluded.params, goal=excluded.goal, content=excluded.content,
                 versions=excluded.versions, updated_at=excluded.updated_at""",
            (draft_id, title, renamed, d["skill_id"], d["skill_name"], json.dumps(d["params"]), d["goal"],
             d["content"], json.dumps(d["versions"]), time.time()),
        )


def rename_draft(draft_id, title):
    with _conn() as c:
        cur = c.execute("UPDATE drafts SET title = ?, renamed = 1 WHERE id = ?", (title, draft_id))
        return cur.rowcount > 0


def delete_draft(draft_id):
    with _conn() as c:
        c.execute("DELETE FROM drafts WHERE id = ?", (draft_id,))
