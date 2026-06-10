"""User & role management schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.auth import RoleOut


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    last_login_at: datetime | None
    roles: list[RoleOut]


class RoleDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    is_system: bool


class UserUpdate(BaseModel):
    role_ids: list[uuid.UUID] | None = None
    is_active: bool | None = None
