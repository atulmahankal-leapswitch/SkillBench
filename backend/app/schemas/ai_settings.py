"""AI provider settings schemas (admin-configurable)."""

from pydantic import BaseModel, Field


class AISettingsOut(BaseModel):
    provider: str
    model: str
    api_key_set: bool
    api_key_masked: str = ""
    available_providers: list[str]
    # provider -> curated model list (UI dropdowns)
    models: dict[str, list[str]]
    # providers that require an API key field in the UI
    providers_needing_key: list[str]


class AISettingsUpdate(BaseModel):
    provider: str = Field(default="", max_length=40)
    model: str = Field(default="", max_length=80)
    # Only updated when a non-empty value is supplied; send "__clear__" to wipe.
    api_key: str | None = None
