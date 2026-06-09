"""AI provider factory. Selects the concrete provider from AI_PROVIDER."""

from app.core.config import settings
from app.services.ai.base import AIDisabled, AIProvider


def get_provider() -> AIProvider:
    provider = (settings.ai_provider or "").lower()
    if provider == "stub":
        from app.services.ai.stub import StubProvider

        return StubProvider()
    if provider == "anthropic":
        from app.services.ai.anthropic import AnthropicProvider

        return AnthropicProvider()
    if provider == "claude_code_sdk":
        from app.services.ai.claude_code_sdk import ClaudeCodeSDKProvider

        return ClaudeCodeSDKProvider()
    if provider == "openai":
        from app.services.ai.openai import OpenAIProvider

        return OpenAIProvider()
    raise AIDisabled(f"AI provider not configured (AI_PROVIDER={provider!r})")


def is_enabled() -> bool:
    try:
        get_provider()
        return True
    except AIDisabled:
        return False


__all__ = ["AIDisabled", "AIProvider", "get_provider", "is_enabled"]
