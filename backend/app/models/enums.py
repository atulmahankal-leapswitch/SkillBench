"""Shared string enums for core domain models."""

from enum import StrEnum


class CandidateSource(StrEnum):
    EXTERNAL = "external"  # hiring candidate
    INTERNAL = "internal"  # employee (promotion / skill check)


class CandidateStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class QuestionType(StrEnum):
    MCQ = "mcq"  # single correct option
    MULTI_SELECT = "multi_select"  # multiple correct options
    TEXT = "text"  # free-text / short answer
    CODING = "coding"  # programming question (executed in Phase 06)


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TestStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
