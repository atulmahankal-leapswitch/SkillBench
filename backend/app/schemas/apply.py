"""Public job-application schemas (candidate self-apply, no auth)."""

from pydantic import BaseModel, EmailStr, Field


class ApplyInfo(BaseModel):
    """Branding shown on the public apply page."""

    organization_name: str
    display_name: str = ""
    logo_url: str = ""
    brand_color: str = ""


class ApplyCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    job_title: str = Field(default="", max_length=255)
