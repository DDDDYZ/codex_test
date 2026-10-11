import { gradeQuestion, questionBank, type LearningLevel, type Question } from "../content/questions";

export const PRACTICE_STORAGE_KEY = "fdl-practice-v1";
export type PracticeMode = "all" | "level" | "lesson" | "wrong";
export interface PracticeSelection {
  mode: PracticeMode;
  level: LearningLevel;
  lessonId: string;
}
export interface PracticeAttempt {
  questionIds: string[];
  answers: Record<string, string>;
  cursor: number;
  startedAt: number;
  submittedAt?: number;
}
export interface PracticeState {
  version: 1;
  selection: PracticeSelection;
  attempt: PracticeAttempt | null;
}
export interface PracticeScore {
  total: number;
  answered: number;
  correct: number;
  percentage: number;
  results: Record<string, boolean>;
  wrongIds: string[];
}

export function selectPracticeQuestions(
  selection: PracticeSelection,
  mastery: Record<string, boolean>,
  bank: readonly Question[] = questionBank,
): Question[] {
  return bank.filter((q) => {
    switch (selection.mode) {
      case "level": return q.level === selection.level;
      case "lesson": return q.level === selection.level && q.lessonId === selection.lessonId;
      case "wrong": return mastery[q.id] === false;
      default: return true;
    }
  });
}

export function isAnswered(question: Question, value: string | undefined): boolean {
  if (value === undefined || !value.trim()) return false;
  if (question.kind === "choice") {
    const option = Number(value);
    return /^\d+$/.test(value) && Number.isInteger(option) && option >= 0 && option < question.options.length;
  }
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) && Number.isFinite(Number(value));
}

export function scorePracticeAttempt(attempt: PracticeAttempt, bank: readonly Question[] = questionBank): PracticeScore {
  const lookup = new Map(bank.map((q) => [q.id, q]));
  const questions = [...new Set(attempt.questionIds)].flatMap((id) => {
    const q = lookup.get(id);
    return q ? [q] : [];
  });
  const results: Record<string, boolean> = {};
  const wrongIds: string[] = [];
  let answered = 0;
  let correct = 0;
  for (const q of questions) {
    const value = attempt.answers[q.id];
    const valid = isAnswered(q, value);
    if (valid) answered++;
    const passed = valid && gradeQuestion(q, value);
    results[q.id] = passed;
    if (passed) correct++;
    else wrongIds.push(q.id);
  }
  return {
    total: questions.length,
    answered,
    correct,
    percentage: questions.length ? Math.round(correct / questions.length * 100) : 0,
    results,
    wrongIds,
  };
}

export function newPracticeAttempt(questionIds: readonly string[], now = Date.now()): PracticeAttempt {
  return { questionIds: [...new Set(questionIds)], answers: {}, cursor: 0, startedAt: now };
}

export function retryWrongAttempt(attempt: PracticeAttempt, now = Date.now(), bank: readonly Question[] = questionBank): PracticeAttempt {
  return newPracticeAttempt(scorePracticeAttempt(attempt, bank).wrongIds, now);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadPracticeState(): PracticeState | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "null");
    if (!record(raw) || raw.version !== 1 || !record(raw.selection)) return null;
    const { mode, level, lessonId } = raw.selection;
    if (!(["all", "level", "lesson", "wrong"] as unknown[]).includes(mode) || (typeof level !== "number" || ![1,2,3,4,5,6].includes(level)) || typeof lessonId !== "string") return null;
    const selection: PracticeSelection = { mode: mode as PracticeMode, level:level as LearningLevel, lessonId };
    if (raw.attempt === null) return { version: 1, selection, attempt: null };
    if (!record(raw.attempt)) return null;
    const attempt = raw.attempt;
    if (!Array.isArray(attempt.questionIds) || !record(attempt.answers) || !Number.isInteger(attempt.cursor) || typeof attempt.startedAt !== "number" || !Number.isFinite(attempt.startedAt) || attempt.startedAt <= 0) return null;
    if (attempt.submittedAt !== undefined && (typeof attempt.submittedAt !== "number" || !Number.isFinite(attempt.submittedAt) || attempt.submittedAt < attempt.startedAt)) return null;
    const validIds = new Set(questionBank.map((q) => q.id));
    const questionIds = [...new Set(attempt.questionIds.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
    if (!questionIds.length) return null;
    const answers = Object.fromEntries(Object.entries(attempt.answers).filter(([id, value]) => questionIds.includes(id) && typeof value === "string" && value.length <= 100)) as Record<string, string>;
    return {
      version: 1,
      selection,
      attempt: {
        questionIds,
        answers,
        cursor: Math.max(0, Math.min(attempt.cursor as number, questionIds.length - 1)),
        startedAt: attempt.startedAt,
        ...(typeof attempt.submittedAt === "number" ? { submittedAt: attempt.submittedAt } : {}),
      },
    };
  } catch {
    return null;
  }
}

export function savePracticeState(state: PracticeState): boolean {
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
