"""OpenAI Chat Completions provider (via httpx)."""

from typing import Any

import httpx

from app.core.config import settings
from app.services.ai.base import AIDisabled, AIProvider, extract_json
from app.services.ai.prompts import (
    GENERATE_SYSTEM,
    SCORE_SYSTEM,
    generate_questions_prompt,
    score_text_prompt,
)

API_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise AIDisabled("OPENAI_API_KEY is not set")

    async def _complete(self, system: str, prompt: str) -> str:
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        body = {
            "model": settings.ai_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(API_URL, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        text = await self._complete(GENERATE_SYSTEM, generate_questions_prompt(spec))
        parsed = extract_json(text)
        return parsed if isinstance(parsed, list) else [parsed]

    async def score_text(self, req: dict[str, Any]) -> dict:
        text = await self._complete(SCORE_SYSTEM, score_text_prompt(req))
        return extract_json(text)
