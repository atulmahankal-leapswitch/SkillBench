"""RBAC catalog: the canonical permissions and the default system roles.

This is the single source of truth. The initial migration seeds the database
from these definitions, and runtime code references the same codes.
"""

# ── Permissions: "<resource>:<action>" ──────────────────────────────────────
PERMISSIONS: dict[str, str] = {
    "candidate:read": "View candidates",
    "candidate:write": "Create / edit / delete candidates",
    "question:read": "View questions",
    "question:write": "Create / edit / delete questions",
    "test:read": "View tests",
    "test:write": "Create / edit / delete tests",
    "schedule:read": "View schedules and invitations",
    "schedule:write": "Schedule tests and manage invitations",
    "result:read": "View attempts and results",
    "result:write": "Grade / override results",
    "user:manage": "Manage organisation users",
    "role:manage": "Manage roles and permissions",
    "settings:manage": "Manage organisation settings and integrations",
}

ALL_PERMISSIONS: list[str] = list(PERMISSIONS.keys())

_READ_ONLY = [p for p in ALL_PERMISSIONS if p.endswith(":read")]

_RECRUITER = [
    "candidate:read",
    "candidate:write",
    "question:read",
    "question:write",
    "test:read",
    "test:write",
    "schedule:read",
    "schedule:write",
    "result:read",
    "result:write",
]

# ── Default system roles: name -> (description, permission codes) ────────────
SYSTEM_ROLES: dict[str, tuple[str, list[str]]] = {
    "Owner": ("Full access; cannot be removed.", ALL_PERMISSIONS),
    "Admin": ("Full access to all features.", ALL_PERMISSIONS),
    "Recruiter": (
        "Manage candidates, questions, tests, schedules and results.",
        _RECRUITER,
    ),
    "Viewer": ("Read-only access.", _READ_ONLY),
}

# Role granted to the first user of a new organisation.
DEFAULT_FIRST_USER_ROLE = "Owner"
# Role granted to subsequent users (admins promote as needed).
DEFAULT_NEW_USER_ROLE = "Viewer"
