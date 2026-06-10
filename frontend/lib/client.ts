"use client";

// Browser-side API client. All requests include cookies for the session.
import { browserApiBase } from "./api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${browserApiBase}/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : JSON.stringify(data?.detail ?? data);
    throw new ApiError(res.status, detail || res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: (path: string) => request<void>("DELETE", path),
};

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

// ── Domain types (mirror backend schemas) ───────────────────────────────────
export type CandidateStage =
  | "applied"
  | "screening"
  | "assessment"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type Candidate = {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  source: "external" | "internal";
  stage: CandidateStage;
  status: "active" | "archived";
  tags: string[];
  notes: string;
  assignees: { id: string; email: string; full_name: string }[];
  schedule_count: number;
  created_at: string;
  updated_at: string;
};

export type QuestionType = "mcq" | "multi_select" | "text" | "coding";
export type Difficulty = "easy" | "medium" | "hard";

export type Category = {
  id: string;
  name: string;
  description: string;
  counts: { easy: number; medium: number; hard: number; total: number };
};

export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  payload: Record<string, unknown>;
  difficulty: Difficulty;
  points: number;
  tags: string[];
  categories: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
};

export type BlueprintRow = {
  category_id: string;
  category_name: string;
  difficulty: Difficulty;
  count: number;
};

export type TestSummary = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  pass_mark: number;
  status: "draft" | "active" | "archived";
  question_count: number;
  created_at: string;
  updated_at: string;
};

export type TestQuestion = {
  id: string;
  position: number;
  weight: number | null;
  question: Question;
};

export type Test = Omit<TestSummary, "question_count"> & {
  settings: Record<string, unknown>;
  questions: TestQuestion[];
  blueprint: BlueprintRow[];
};

export type ResultSummary = {
  attempt_id: string;
  candidate_name: string;
  candidate_email: string;
  test_title: string;
  attempt_status: string;
  total_points: number;
  max_points: number;
  percent: number;
  passed: boolean;
  needs_review: boolean;
  submitted_at: string | null;
};

export type QuestionResult = {
  id: string;
  question_id: string;
  points_awarded: number;
  max_points: number;
  is_correct: boolean | null;
  needs_review: boolean;
  feedback: string;
  prompt: string;
  type: string;
  difficulty: string;
  category: string;
  response: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type ResultDetail = {
  attempt_id: string;
  candidate_name: string;
  candidate_email: string;
  test_title: string;
  pass_mark: number;
  attempt_status: string;
  total_points: number;
  max_points: number;
  percent: number;
  passed: boolean;
  needs_review: boolean;
  submitted_at: string | null;
  graded_at: string | null;
  questions: QuestionResult[];
};

export type ScheduleStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";

export type Schedule = {
  id: string;
  status: ScheduleStatus;
  start_at: string;
  end_at: string;
  candidate: { id: string; full_name: string; email: string };
  test: { id: string; title: string; duration_minutes: number };
  invitation: {
    token: string;
    expires_at: string;
    sent_at: string | null;
    revoked_at: string | null;
  } | null;
  created_at: string;
};
