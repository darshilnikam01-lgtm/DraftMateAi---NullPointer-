"""Thin wrapper around the Gemini SDK (google-genai). Every LLM call in the app goes through here."""
import json
import re
import time

from fastapi import HTTPException
from google import genai
from google.genai import types

import config

_client = None


def client():
    global _client
    if _client is None:
        if not config.GEMINI_API_KEY:
            raise HTTPException(503, "GEMINI_API_KEY is missing. Add it to backend/.env and restart the server.")
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def _cfg(json_mode: bool, temperature: float, thinking: str | None = None):
    kwargs = {"temperature": temperature}
    if json_mode:
        kwargs["response_mime_type"] = "application/json"
    if thinking:
        try:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=thinking)
        except Exception:
            pass
    return types.GenerateContentConfig(**kwargs)


RETRYABLE = ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "overloaded", "high demand")


def _retryable(e: Exception) -> bool:
    return any(k in str(e) for k in RETRYABLE)


def _models_to_try(model: str | None, fast: bool) -> list[str]:
    chain = []
    if fast:
        chain += [config.FAST_MODEL, config.DEFAULT_MODEL]
    else:
        chain.append(model or config.DEFAULT_MODEL)
    if config.FALLBACK_MODEL:
        chain.append(config.FALLBACK_MODEL)
    return list(dict.fromkeys(m for m in chain if m))


def complete(prompt: str, model: str | None = None, json_mode: bool = False, temperature: float = 0.3, fast: bool = False) -> str:
    last = None
    thinking = "low" if fast else None
    for m in _models_to_try(model, fast):
        for attempt in range(2):
            try:
                r = client().models.generate_content(model=m, contents=prompt, config=_cfg(json_mode, temperature, thinking))
                return r.text or ""
            except HTTPException:
                raise
            except Exception as e:
                last = e
                if thinking and "thinking" in str(e).lower():
                    thinking = None
                    continue
                if not _retryable(e):
                    raise HTTPException(502, f"LLM error: {e}")
                time.sleep(1.5 * (attempt + 1))
    raise HTTPException(502, f"LLM error (all models busy, try again in a minute): {last}")


def complete_json(prompt: str, model: str | None = None, fallback=None):
    text = complete(prompt, model, json_mode=True, temperature=0.1, fast=True)
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
    return fallback


def stream(prompt: str, model: str | None = None, temperature: float = 0.4, speed: str = "pro"):
    lite = speed == "lite"
    thinking = "low" if lite else (config.THINKING_LEVEL or None)
    last = None
    for m in _models_to_try(model, lite):
        for attempt in range(2):
            started = False
            try:
                for chunk in client().models.generate_content_stream(model=m, contents=prompt, config=_cfg(False, temperature, thinking)):
                    if chunk.text:
                        started = True
                        yield chunk.text
                return
            except HTTPException:
                raise
            except Exception as e:
                if started:
                    raise
                last = e
                if thinking and "thinking" in str(e).lower():
                    thinking = None
                    continue
                if not _retryable(e):
                    raise
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"All models are busy, try again in a minute: {last}")
