"""Branding (white-label) schemas."""

from pydantic import BaseModel, ConfigDict, Field


class BrandingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    display_name: str
    logo_url: str
    brand_color: str


class BrandingUpdate(BaseModel):
    display_name: str = Field(default="", max_length=255)
    # A URL or an uploaded image as a data URL (capped ~500 KB).
    logo_url: str = Field(default="", max_length=700_000)
    brand_color: str = Field(default="", max_length=20)
