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


# Recording kinds: the candidate's whole screen, and their webcam.
SCREEN = "screen"
CAMERA = "camera"


# ── Local filesystem backend (dev) ───────────────────────────────────────────
def _local_path(attempt_id: uuid.UUID, kind: str) -> Path:
    d = Path(settings.recording_dir)
    d.mkdir(parents=True, exist_ok=True)
    # Screen keeps the legacy "{id}.webm" name; other kinds add a suffix.
    suffix = "" if kind == SCREEN else f".{kind}"
    return d / f"{attempt_id}{suffix}.webm"


def _local_append(attempt_id: uuid.UUID, kind: str, data: bytes) -> None:
    with open(_local_path(attempt_id, kind), "ab") as f:
        f.write(data)


def _local_exists(attempt_id: uuid.UUID, kind: str) -> bool:
    p = _local_path(attempt_id, kind)
    return p.exists() and p.stat().st_size > 0


def _local_stream(attempt_id: uuid.UUID, kind: str) -> Iterator[bytes]:
    with open(_local_path(attempt_id, kind), "rb") as f:
        while chunk := f.read(64 * 1024):
            yield chunk


# ── S3 backend (prod) ────────────────────────────────────────────────────────
def _s3_client(org: Organization):
    import boto3  # lazy: only needed when provider == s3
    from botocore.client import Config

    return boto3.client(
        "s3",
        region_name=org.recording_s3_region or "us-east-1",
        endpoint_url=org.recording_s3_endpoint or None,
        aws_access_key_id=org.recording_s3_access_key or None,
        aws_secret_access_key=org.recording_s3_secret or None,
        # Path-style works with MinIO / R2 / custom endpoints (virtual-host
        # style needs per-bucket DNS, which those don't provide).
        config=Config(s3={"addressing_style": "path"}),
    )


def _s3_key(attempt_id: uuid.UUID, kind: str, seq: int) -> str:
    # Screen keeps the legacy keyless layout; other kinds get a sub-prefix.
    if kind == SCREEN:
        return f"recordings/{attempt_id}/{seq:08d}.webm"
    return f"recordings/{attempt_id}/{kind}/{seq:08d}.webm"


def _s3_kind_of(prefix: str, key: str) -> str:
    rest = key[len(prefix):]
    return CAMERA if rest.startswith(f"{CAMERA}/") else SCREEN


def _s3_sorted_keys(org: Organization, attempt_id: uuid.UUID, kind: str) -> list[str]:
    client = _s3_client(org)
    prefix = f"recordings/{attempt_id}/"
    resp = client.list_objects_v2(Bucket=org.recording_s3_bucket, Prefix=prefix)
    keys = [
        o["Key"]
        for o in resp.get("Contents", [])
        if _s3_kind_of(prefix, o["Key"]) == kind
    ]
    return sorted(keys)


def _s3_put(
    org: Organization, attempt_id: uuid.UUID, kind: str, seq: int, data: bytes
) -> None:
    _s3_client(org).put_object(
        Bucket=org.recording_s3_bucket, Key=_s3_key(attempt_id, kind, seq), Body=data
    )


def _s3_stream(org: Organization, attempt_id: uuid.UUID, kind: str) -> Iterator[bytes]:
    client = _s3_client(org)
    for key in _s3_sorted_keys(org, attempt_id, kind):
        yield client.get_object(Bucket=org.recording_s3_bucket, Key=key)["Body"].read()


def _s3_exists(org: Organization, attempt_id: uuid.UUID, kind: str) -> bool:
    return bool(_s3_sorted_keys(org, attempt_id, kind))


# ── Public API (dispatch by provider) ────────────────────────────────────────
def append_chunk(
    org: Organization, attempt_id: uuid.UUID, kind: str, seq: int, data: bytes
) -> None:
    if provider_of(org) == "local":
        _local_append(attempt_id, kind, data)
    elif provider_of(org) == "s3":
        _s3_put(org, attempt_id, kind, seq, data)


def exists(org: Organization, attempt_id: uuid.UUID, kind: str = SCREEN) -> bool:
    if provider_of(org) == "local":
        return _local_exists(attempt_id, kind)
    if provider_of(org) == "s3":
        return _s3_exists(org, attempt_id, kind)
    return False


def stream(
    org: Organization, attempt_id: uuid.UUID, kind: str = SCREEN
) -> Iterator[bytes]:
    if provider_of(org) == "local":
        return _local_stream(attempt_id, kind)
    if provider_of(org) == "s3":
        return _s3_stream(org, attempt_id, kind)
    return iter(())


def check_connection(org: Organization) -> tuple[bool, str]:
    """Verify the configured storage works, so admins can confirm in-app
    instead of opening the (server-side) endpoint in a browser."""
    provider = provider_of(org)
    if provider == "local":
        try:
            d = Path(settings.recording_dir)
            d.mkdir(parents=True, exist_ok=True)
            probe = d / ".write-test"
            probe.write_bytes(b"ok")
            probe.unlink(missing_ok=True)
            return True, f"Local storage is writable ({settings.recording_dir})."
        except Exception as e:  # noqa: BLE001 - surface any FS error to the admin
            return False, f"Local storage not writable: {e}"
    if provider == "s3":
        if not org.recording_s3_bucket:
            return False, "No bucket configured."
        try:
            _s3_client(org).list_objects_v2(
                Bucket=org.recording_s3_bucket, MaxKeys=1
            )
            return True, f"Connected — bucket '{org.recording_s3_bucket}' is reachable."
        except Exception as e:  # noqa: BLE001 - surface the boto/botocore error
            return False, f"Connection failed: {e}"
    return False, "Recording is disabled (no provider selected)."
