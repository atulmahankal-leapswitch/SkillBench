"""Judge0 client + coding-grading fallback (no live Judge0 required)."""

import pytest

from app.services import judge0
from app.services.grading import grade_coding


def test_language_map_has_common_languages():
    langs = judge0.supported_languages()
    for expected in ["python", "javascript", "java", "cpp", "go"]:
        assert expected in langs


def test_disabled_by_default():
    # JUDGE0_ENABLED defaults to false in the test environment.
    assert judge0.is_enabled() is False


@pytest.mark.asyncio
async def test_run_raises_when_disabled():
    with pytest.raises(judge0.Judge0Disabled):
        await judge0.run(language="python", source_code="print(1)")


class _Q:
    """Minimal stand-in for a coding Question."""

    id = "00000000-0000-0000-0000-000000000001"
    payload = {"test_cases": [{"input": "", "expected": "1", "hidden": True}]}


@pytest.mark.asyncio
async def test_coding_falls_back_to_review_when_disabled():
    qr = await grade_coding(_Q(), {"code": "print(1)", "language": "python"}, 5.0)
    assert qr.needs_review is True
    assert float(qr.points_awarded) == 0.0
    assert qr.is_correct is None
