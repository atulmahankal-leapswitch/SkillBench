"""Shared schema helpers."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """A paginated list response."""

    items: list[T]
    total: int
    limit: int
    offset: int
