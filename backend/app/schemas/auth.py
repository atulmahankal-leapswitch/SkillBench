"""Auth-related response schemas."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    primary_domain: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    avatar_url: str
    organization: OrganizationOut
    roles: list[RoleOut]
    permissions: list[str]


class MeResponse(BaseModel):
    user: UserOut
