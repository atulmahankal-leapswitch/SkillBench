"""Google OAuth (SSO) settings schemas."""

from pydantic import BaseModel, Field


class SSOSettingsOut(BaseModel):
    google_client_id: str
    # Secret is write-only; only report whether one is stored.
    google_client_secret_set: bool
    # Restrict Google sign-in to this email domain ("" = any allowed domain).
    google_domain: str
    # App-global redirect URI to register in the Google Cloud console.
    redirect_uri: str


class SSOSettingsUpdate(BaseModel):
    google_client_id: str = Field(default="", max_length=255)
    # "__clear__" clears the secret; "" leaves it unchanged.
    google_client_secret: str | None = Field(default=None, max_length=255)
    google_domain: str = Field(default="", max_length=255)
