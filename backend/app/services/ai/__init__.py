"""AI provider factory. Resolves per-organisation config (falling back to env)."""

from dataclasses import dataclass

from app.core.config import settings
from app.services.ai.base import AIDisabled, AIProvider

# Providers selectable in the admin UI.
AVAILABLE_PROVIDERS = ["anthropic", "claude_code_sdk", "openai", "stub"]


@dataclass
class AIConfig:
    provider: str
    model: str
    api_key: str


def resolve(org) -> AIConfig:
    """Build the effective AI config for an org (org values override env)."""
    return AIConfig(
        provider=(org.ai_provider or settings.ai_provider or "").lower(),
        model=org.ai_model or settings.ai_model,
        api_key=org.ai_api_key or "",
    )


def get_provider(cfg: AIConfig) -> AIProvider:
    p = cfg.provider
    if p == "stub":
        from app.services.ai.stub import StubProvider

        return StubProvider()
    if p == "anthropic":
        from app.services.ai.anthropic import AnthropicProvider

        return AnthropicProvider(cfg.model, cfg.api_key or settings.anthropic_api_key)
    if p == "claude_code_sdk":
        from app.services.ai.claude_code_sdk import ClaudeCodeSDKProvider

        return ClaudeCodeSDKProvider(cfg.model)
    if p == "openai":
        from app.services.ai.openai import OpenAIProvider

        return OpenAIProvider(cfg.model, cfg.api_key or settings.openai_api_key)
    raise AIDisabled(f"AI provider not configured (provider={p!r})")


def is_enabled(cfg: AIConfig) -> bool:
    try:
        get_provider(cfg)
        return True
    except AIDisabled:
        return False


__all__ = [
    "AIConfig",
    "AIDisabled",
    "AIProvider",
    "AVAILABLE_PROVIDERS",
    "get_provider",
    "is_enabled",
    "resolve",
]
