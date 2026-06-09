"""Schedule & invitation schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import ScheduleStatus


class ScheduleCreate(BaseModel):
    test_id: uuid.UUID
    candidate_id: uuid.UUID
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def _window_valid(self) -> "ScheduleCreate":
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class CandidateRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    email: str


class TestRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    duration_minutes: int


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    token: str
    expires_at: datetime
    sent_at: datetime | None
    revoked_at: datetime | None


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: ScheduleStatus
    start_at: datetime
    end_at: datetime
    candidate: CandidateRef
    test: TestRef
    invitation: InvitationOut | None
    created_at: datetime


# Public (candidate-facing) view returned when validating an invite token.
class InvitationInfo(BaseModel):
    candidate_name: str
    test_title: str
    duration_minutes: int
    start_at: datetime
    end_at: datetime
    status: ScheduleStatus
    # Whether the candidate may start right now.
    can_start: bool
