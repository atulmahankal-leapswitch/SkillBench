"""Claude Code SDK (Agent SDK) provider.

Drives the `claude-agent-sdk` (which runs the Claude Code CLI). Authentication,
mirroring the reference implementation, in precedence order:
  1. an API key (passed per-call to the CLI via ClaudeAgentOptions.env), or
  2. an existing Claude login in the backend container (`claude login` →
     ~/.claude/.credentials.json).
"""

import asyncio
import os
from pathlib import Path
from typing import Any

from app.services.ai.base import AIDisabled, AIProvider, extract_json
from app.services.ai.prompts import (
    GENERATE_SYSTEM,
    SCORE_SYSTEM,
    generate_questions_prompt,
    score_text_prompt,
)

TIMEOUT_SECONDS = 120


class ClaudeCodeSDKProvider(AIProvider):
    name = "claude_code_sdk"

    def __init__(self, model: str = "", api_key: str = "") -> None:
        self.model = model
        self.api_key = api_key
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError as exc:  # pragma: no cover - optional dep
            raise AIDisabled(
                "claude-agent-sdk is not installed (add it to enable this provider)"
            ) from exc
        # Need either an API key or an in-container Claude login.
        if not (api_key or os.environ.get("ANTHROPIC_API_KEY")):
            creds = Path(os.environ.get("CLAUDE_HOME", "/root/.claude")) / ".credentials.json"
            if not creds.exists():
                raise AIDisabled(
                    "Claude Code SDK needs an API key, or run `claude login` "
                    "inside the backend container."
                )

    async def _run(self, system: str, prompt: str) -> str:
        from claude_agent_sdk import ClaudeAgentOptions, query  # type: ignore

        opts: dict[str, Any] = {
            "system_prompt": system,
            "max_turns": 1,
            "allowed_tools": [],  # plain completion, no tool use
        }
        if self.model:
            opts["model"] = self.model
        # Pass the key to the CLI subprocess only (no global env mutation).
        if self.api_key:
            opts["env"] = {"ANTHROPIC_API_KEY": self.api_key}
        options = ClaudeAgentOptions(**opts)

        chunks: list[str] = []

        async def _consume() -> None:
            async for message in query(prompt=prompt, options=options):
                blocks = getattr(message, "content", None) or []
                for block in blocks:
                    text = getattr(block, "text", None)
                    if isinstance(text, str):
                        chunks.append(text)

        await asyncio.wait_for(_consume(), timeout=TIMEOUT_SECONDS)
        return "".join(chunks)

    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        text = await self._run(GENERATE_SYSTEM, generate_questions_prompt(spec))
        parsed = extract_json(text)
        return parsed if isinstance(parsed, list) else [parsed]

    async def score_text(self, req: dict[str, Any]) -> dict:
        text = await self._run(SCORE_SYSTEM, score_text_prompt(req))
        return extract_json(text)
