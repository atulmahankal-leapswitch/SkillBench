"""ORM models. Import all here so Base.metadata sees every table."""

from app.models.attempt import Answer, Attempt
from app.models.candidate import Candidate, user_candidate_assignments
from app.models.organization import Organization
from app.models.question import Question
from app.models.result import QuestionResult, Result
from app.models.schedule import Invitation, Schedule
from app.models.test import Test, TestQuestion
from app.models.user import (
    Permission,
    Role,
    User,
    role_permissions,
    user_roles,
)

__all__ = [
    "Organization",
    "User",
    "Role",
    "Permission",
    "user_roles",
    "role_permissions",
    "Candidate",
    "user_candidate_assignments",
    "Question",
    "Test",
    "TestQuestion",
    "Schedule",
    "Invitation",
    "Attempt",
    "Answer",
    "Result",
    "QuestionResult",
]
