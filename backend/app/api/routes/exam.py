"""Public candidate exam endpoints, authenticated by the invite token."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.exam import AnswerSubmit, ExamState, RunRequest, RunResponse
from app.services import exam as svc


class ProctorReport(BaseModel):
    type: str
    meta: dict | None = None

router = APIRouter(prefix="/exam", tags=["exam"])


@router.get("/{token}", response_model=ExamState)
async def get_state(token: str, db: AsyncSession = Depends(get_db)) -> ExamState:
    return await svc.get_state(db, token)


@router.post("/{token}/start", response_model=ExamState)
async def start(token: str, db: AsyncSession = Depends(get_db)) -> ExamState:
    return await svc.start_attempt(db, token)


@router.put("/{token}/answer")
async def save_answer(
    token: str, data: AnswerSubmit, db: AsyncSession = Depends(get_db)
) -> dict:
    return await svc.save_answer(db, token, data)


@router.post("/{token}/run", response_model=RunResponse)
async def run_code(
    token: str, data: RunRequest, db: AsyncSession = Depends(get_db)
) -> RunResponse:
    return await svc.run_code(db, token, data)


@router.post("/{token}/proctor")
async def report_proctor(
    token: str, data: ProctorReport, db: AsyncSession = Depends(get_db)
) -> dict:
    return await svc.report_proctor_event(db, token, data.type, data.meta)


@router.post("/{token}/submit", response_model=ExamState)
async def submit(token: str, db: AsyncSession = Depends(get_db)) -> ExamState:
    return await svc.submit_attempt(db, token)
