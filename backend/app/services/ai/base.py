"""AI provider interface and shared helpers.

Concrete providers (anthropic, claude_code_sdk, openai, stub) implement this so
the rest of the app stays vendor-agnostic. Selected via AI_PROVIDER.
"""

import json
import re
from abc import ABC, abstractmethod
from typing import Any


class AIDisabled(RuntimeError):
    """Raised when an AI feature is used but no provider is configured."""


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        """Return a list of draft question dicts for the given spec."""

    @abstractmethod
    async def score_text(self, req: dict[str, Any]) -> dict:
        """Return {'score': float, 'rationale': str} for a free-text answer."""


def extract_json(text: str) -> Any:
    """Best-effort parse of JSON from an LLM response (handles code fences)."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fall back to the first balanced array/object.
    for opener, closer in (("[", "]"), ("{", "}")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("Could not parse JSON from model output")
