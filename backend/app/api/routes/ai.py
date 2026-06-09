"""AI-assisted feature endpoints (admin)."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http

from app.api.deps import require_permission
from app.models.user import User
from app.schemas.ai import (
    GeneratedQuestion,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    ScoreTextRequest,
    ScoreTextResponse,
)
from app.services import ai

router = APIRouter(prefix="/ai", tags=["ai"])


def _provider():
    try:
        return ai.get_provider()
    except ai.AIDisabled as exc:
        raise HTTPException(http.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(
    data: GenerateQuestionsRequest,
    user: User = Depends(require_permission("question:write")),
) -> GenerateQuestionsResponse:
    provider = _provider()
    try:
        raw = await provider.generate_questions(data.model_dump())
    except Exception as exc:  # noqa: BLE001 - surface a clean 502 on AI failure
        raise HTTPException(http.HTTP_502_BAD_GATEWAY, f"AI error: {exc}") from exc
    return GenerateQuestionsResponse(
        provider=provider.name,
        questions=[GeneratedQuestion(**q) for q in raw],
    )


@router.post("/score-text", response_model=ScoreTextResponse)
async def score_text(
    data: ScoreTextRequest,
    user: User = Depends(require_permission("result:write")),
) -> ScoreTextResponse:
    provider = _provider()
    try:
        result = await provider.score_text(data.model_dump())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(http.HTTP_502_BAD_GATEWAY, f"AI error: {exc}") from exc
    return ScoreTextResponse(
        provider=provider.name,
        score=float(result.get("score", 0)),
        rationale=str(result.get("rationale", "")),
    )
