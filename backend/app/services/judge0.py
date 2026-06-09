"""Judge0 client for sandboxed code execution.

Enabled via JUDGE0_ENABLED + a reachable JUDGE0_URL (see compose.judge0.yml).
When disabled, callers should fall back (coding questions stay needs_review).
"""

from dataclasses import dataclass

import httpx

from app.core.config import settings

# Common Judge0 CE language ids.
LANGUAGES: dict[str, int] = {
    "python": 71,
    "javascript": 63,
    "typescript": 74,
    "java": 62,
    "c": 50,
    "cpp": 54,
    "csharp": 51,
    "go": 60,
    "ruby": 72,
    "rust": 73,
    "php": 68,
    "kotlin": 78,
    "swift": 83,
    "bash": 46,
}

# Judge0 status id 3 == Accepted (output matched expected, when provided).
STATUS_ACCEPTED = 3


class Judge0Disabled(RuntimeError):
    """Raised when code execution is requested but Judge0 is not enabled."""


@dataclass
class RunResult:
    passed: bool
    status: str
    stdout: str
    stderr: str
    time: str | None


def is_enabled() -> bool:
    return settings.judge0_enabled


def supported_languages() -> list[str]:
    return sorted(LANGUAGES.keys())


async def run(
    *, language: str, source_code: str, stdin: str = "", expected_output: str | None = None
) -> RunResult:
    """Execute a single submission (synchronously via Judge0 wait=true)."""
    if not settings.judge0_enabled:
        raise Judge0Disabled("Judge0 is not enabled")
    language_id = LANGUAGES.get(language)
    if language_id is None:
        raise ValueError(f"Unsupported language: {language}")

    payload: dict = {"language_id": language_id, "source_code": source_code, "stdin": stdin}
    if expected_output is not None:
        payload["expected_output"] = expected_output

    headers = {}
    if settings.judge0_auth_token:
        headers["X-Auth-Token"] = settings.judge0_auth_token

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.judge0_url}/submissions",
            params={"base64_encoded": "false", "wait": "true"},
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    status = data.get("status", {}) or {}
    status_id = status.get("id")
    # When expected_output is given, "passed" means Accepted; otherwise it ran.
    if expected_output is not None:
        passed = status_id == STATUS_ACCEPTED
    else:
        passed = status_id in (STATUS_ACCEPTED, None) and not data.get("stderr")
    return RunResult(
        passed=passed,
        status=status.get("description", "unknown"),
        stdout=data.get("stdout") or "",
        stderr=(data.get("stderr") or "") + (data.get("compile_output") or ""),
        time=data.get("time"),
    )
