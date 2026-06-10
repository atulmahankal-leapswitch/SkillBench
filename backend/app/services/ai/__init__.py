"""AI provider factory. Resolves per-organisation config (falling back to env)."""

from dataclasses import dataclass

from app.core.config import settings
from app.services.ai.base import AIDisabled, AIProvider

# Providers selectable in the admin UI.
AVAILABLE_PROVIDERS = ["anthropic", "claude_code_sdk", "openai", "stub"]

# Curated model lists per provider (UI dropdowns; avoids typos).
PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": [
        "claude-opus-4-8",
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    ],
    "claude_code_sdk": [
        "claude-opus-4-8",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    ],
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    "stub": [],
}

# Providers that require an API key (others use host auth / none).
PROVIDERS_NEEDING_KEY = ["anthropic", "openai"]


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

        return ClaudeCodeSDKProvider(cfg.model, cfg.api_key or settings.anthropic_api_key)
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
    "PROVIDER_MODELS",
    "PROVIDERS_NEEDING_KEY",
    "get_provider",
    "is_enabled",
    "resolve",
]
