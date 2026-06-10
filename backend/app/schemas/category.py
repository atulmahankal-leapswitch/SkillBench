"""Category schemas."""

import uuid

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None


class CategoryRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    # Available (non-deleted) question counts by difficulty.
    counts: dict[str, int] = Field(default_factory=dict)
