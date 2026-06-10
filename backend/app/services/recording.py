"""Screen-recording storage: pluggable local (dev) / S3 (prod) backends.

MediaRecorder webm chunks concatenated in order form a valid playable file, so
the local backend simply appends chunks to one file per attempt. S3 stores each
chunk as a numbered object and concatenates on read.
"""

import uuid
from collections.abc import Iterator
from pathlib import Path

from app.core.config import settings
from app.models.organization import Organization


def provider_of(org: Organization) -> str:
    return org.recording_provider or ""


def is_enabled(org: Organization) -> bool:
    return provider_of(org) in ("local", "s3")


# ── Local filesystem backend (dev) ───────────────────────────────────────────
def _local_path(attempt_id: uuid.UUID) -> Path:
    d = Path(settings.recording_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{attempt_id}.webm"


def _local_append(attempt_id: uuid.UUID, data: bytes) -> None:
    with open(_local_path(attempt_id), "ab") as f:
        f.write(data)


def _local_exists(attempt_id: uuid.UUID) -> bool:
    p = _local_path(attempt_id)
    return p.exists() and p.stat().st_size > 0


def _local_stream(attempt_id: uuid.UUID) -> Iterator[bytes]:
    with open(_local_path(attempt_id), "rb") as f:
        while chunk := f.read(64 * 1024):
            yield chunk


# ── S3 backend (prod) ────────────────────────────────────────────────────────
def _s3_client(org: Organization):
    import boto3  # lazy: only needed when provider == s3

    return boto3.client(
        "s3",
        region_name=org.recording_s3_region or None,
        endpoint_url=org.recording_s3_endpoint or None,
        aws_access_key_id=org.recording_s3_access_key or None,
        aws_secret_access_key=org.recording_s3_secret or None,
    )


def _s3_key(attempt_id: uuid.UUID, seq: int) -> str:
    return f"recordings/{attempt_id}/{seq:08d}.webm"


def _s3_put(org: Organization, attempt_id: uuid.UUID, seq: int, data: bytes) -> None:
    _s3_client(org).put_object(
        Bucket=org.recording_s3_bucket, Key=_s3_key(attempt_id, seq), Body=data
    )


def _s3_stream(org: Organization, attempt_id: uuid.UUID) -> Iterator[bytes]:
    client = _s3_client(org)
    resp = client.list_objects_v2(
        Bucket=org.recording_s3_bucket, Prefix=f"recordings/{attempt_id}/"
    )
    for obj in sorted(resp.get("Contents", []), key=lambda o: o["Key"]):
        body = client.get_object(Bucket=org.recording_s3_bucket, Key=obj["Key"])["Body"]
        yield body.read()


def _s3_exists(org: Organization, attempt_id: uuid.UUID) -> bool:
    resp = _s3_client(org).list_objects_v2(
        Bucket=org.recording_s3_bucket, Prefix=f"recordings/{attempt_id}/", MaxKeys=1
    )
    return resp.get("KeyCount", 0) > 0


# ── Public API (dispatch by provider) ────────────────────────────────────────
def append_chunk(org: Organization, attempt_id: uuid.UUID, seq: int, data: bytes) -> None:
    if provider_of(org) == "local":
        _local_append(attempt_id, data)
    elif provider_of(org) == "s3":
        _s3_put(org, attempt_id, seq, data)


def exists(org: Organization, attempt_id: uuid.UUID) -> bool:
    if provider_of(org) == "local":
        return _local_exists(attempt_id)
    if provider_of(org) == "s3":
        return _s3_exists(org, attempt_id)
    return False


def stream(org: Organization, attempt_id: uuid.UUID) -> Iterator[bytes]:
    if provider_of(org) == "local":
        return _local_stream(attempt_id)
    if provider_of(org) == "s3":
        return _s3_stream(org, attempt_id)
    return iter(())
