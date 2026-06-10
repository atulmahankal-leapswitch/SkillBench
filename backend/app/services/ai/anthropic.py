"""Anthropic Claude API provider (Messages API via httpx)."""

from typing import Any

import httpx

from app.services.ai.base import AIDisabled, AIProvider, extract_json
from app.services.ai.prompts import (
    GENERATE_SYSTEM,
    SCORE_SYSTEM,
    generate_questions_prompt,
    score_text_prompt,
)

API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"


class AnthropicProvider(AIProvider):
    name = "anthropic"

    def __init__(self, model: str, api_key: str) -> None:
        if not api_key:
            raise AIDisabled("Anthropic API key is not set")
        self.model = model
        self.api_key = api_key

    async def _complete(self, system: str, prompt: str, max_tokens: int = 1500) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": API_VERSION,
            "content-type": "application/json",
        }
        body = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(API_URL, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        return "".join(
            block.get("text", "") for block in data.get("content", [])
        )

    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        text = await self._complete(GENERATE_SYSTEM, generate_questions_prompt(spec))
        parsed = extract_json(text)
        return parsed if isinstance(parsed, list) else [parsed]

    async def score_text(self, req: dict[str, Any]) -> dict:
        text = await self._complete(SCORE_SYSTEM, score_text_prompt(req), max_tokens=400)
        return extract_json(text)
