"""Screen-recording storage settings schemas."""

from pydantic import BaseModel, Field


class RecordingSettingsOut(BaseModel):
    provider: str  # "" | "local" | "s3"
    s3_bucket: str = ""
    s3_region: str = ""
    s3_endpoint: str = ""
    s3_access_key_set: bool = False
    s3_secret_set: bool = False


class RecordingSettingsUpdate(BaseModel):
    provider: str = Field(default="", max_length=20)
    s3_bucket: str = Field(default="", max_length=255)
    s3_region: str = Field(default="", max_length=64)
    s3_endpoint: str = Field(default="", max_length=512)
    # Only updated when non-empty; send "__clear__" to wipe.
    s3_access_key: str | None = None
    s3_secret: str | None = None
