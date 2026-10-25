import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MODELS = [m.strip() for m in os.getenv("GEMINI_MODELS", DEFAULT_MODEL).split(",") if m.strip()]
if DEFAULT_MODEL not in MODELS:
    MODELS.insert(0, DEFAULT_MODEL)
IK_TOKEN = os.getenv("INDIANKANOON_TOKEN", "")

# ---- deployment settings -------------------------------------------------
# Comma-separated list of allowed browser origins. "*" is fine for local dev;
# when the app serves its own frontend (Docker), CORS is not needed at all.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
# Optional HTTP Basic Auth for the whole app. Strongly recommended on a public URL,
# otherwise anyone who finds it can spend your Gemini quota.
APP_USER = os.getenv("APP_USER", "draftmate")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
# Cap on uploaded files kept in memory (oldest are dropped first).
MAX_FILES = int(os.getenv("MAX_FILES", "200"))

FAST_MODEL = os.getenv("GEMINI_FAST_MODEL", "gemini-3.5-flash-lite")
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "").strip()
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "data", "draftmate.db"))
