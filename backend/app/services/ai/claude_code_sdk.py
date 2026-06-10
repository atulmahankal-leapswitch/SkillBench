"""Claude Code SDK (Agent SDK) provider.

Uses the agentic `claude_agent_sdk` for multi-step generation/grading. The SDK
is an optional dependency; import lazily so the app runs without it installed.
"""

from typing import Any

from app.services.ai.base import AIDisabled, AIProvider, extract_json
from app.services.ai.prompts import (
    GENERATE_SYSTEM,
    SCORE_SYSTEM,
    generate_questions_prompt,
    score_text_prompt,
)


class ClaudeCodeSDKProvider(AIProvider):
    name = "claude_code_sdk"

    def __init__(self, model: str = "") -> None:
        self.model = model
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError as exc:  # pragma: no cover - optional dep
            raise AIDisabled(
                "claude-agent-sdk is not installed (add it to enable this provider)"
            ) from exc

    async def _run(self, system: str, prompt: str) -> str:
        from claude_agent_sdk import ClaudeAgentOptions, query  # type: ignore

        options = ClaudeAgentOptions(system_prompt=system)
        chunks: list[str] = []
        async for message in query(prompt=prompt, options=options):
            text = getattr(message, "text", None)
            if text:
                chunks.append(text)
        return "".join(chunks)

    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        text = await self._run(GENERATE_SYSTEM, generate_questions_prompt(spec))
        parsed = extract_json(text)
        return parsed if isinstance(parsed, list) else [parsed]

    async def score_text(self, req: dict[str, Any]) -> dict:
        text = await self._run(SCORE_SYSTEM, score_text_prompt(req))
        return extract_json(text)
