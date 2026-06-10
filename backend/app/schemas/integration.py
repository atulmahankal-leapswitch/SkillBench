"""Integration schemas (API keys + webhooks)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=list)


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    prefix: str
    scopes: list[str]
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ApiKeyCreated(ApiKeyOut):
    # Plaintext key, returned only at creation time.
    key: str


class WebhookCreate(BaseModel):
    url: str = Field(min_length=1, max_length=1024)
    events: list[str] = Field(default_factory=list)


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    events: list[str]
    active: bool
    created_at: datetime
