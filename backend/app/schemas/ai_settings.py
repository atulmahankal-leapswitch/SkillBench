"""AI provider settings schemas (admin-configurable)."""

from pydantic import BaseModel, Field


class AISettingsOut(BaseModel):
    provider: str
    model: str
    api_key_set: bool
    available_providers: list[str]


class AISettingsUpdate(BaseModel):
    provider: str = Field(default="", max_length=40)
    model: str = Field(default="", max_length=80)
    # Only updated when a non-empty value is supplied; send "__clear__" to wipe.
    api_key: str | None = None
