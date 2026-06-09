"""Candidate request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import CandidateSource, CandidateStatus


class CandidateBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    source: CandidateSource = CandidateSource.EXTERNAL
    tags: list[str] = Field(default_factory=list)
    notes: str = ""


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    source: CandidateSource | None = None
    status: CandidateStatus | None = None
    tags: list[str] | None = None
    notes: str | None = None


class AssigneeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    source: CandidateSource
    status: CandidateStatus
    tags: list[str]
    notes: str
    assignees: list[AssigneeOut]
    created_at: datetime
    updated_at: datetime


class AssignmentUpdate(BaseModel):
    """Replace the full set of assigned user IDs for a candidate."""

    user_ids: list[uuid.UUID]
