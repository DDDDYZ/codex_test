import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  gradeQuestion,
  questionBank,
  type Question,
} from "../src/content/questions";
import {
  PRACTICE_STORAGE_KEY,
  isAnswered,
  loadPracticeState,
  newPracticeAttempt,
  retryWrongAttempt,
  savePracticeState,
  scorePracticeAttempt,
  selectPracticeQuestions,
  type PracticeState,
} from "../src/storage/practice";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const numeric = questionBank.find((q) => q.kind === "numeric");
  const choice = questionBank.find((q) => q.kind === "choice");
  if (!numeric || !choice)
    throw new Error(
      "Question bank must include calculation and concept questions",
    );
  return { numeric, choice };
}
function validAnswer(q: Question) {
  return String(q.answer);
}
function savedState(): PracticeState {
  const { numeric, choice } = fixture();
  return {
    version: 1,
    selection: { mode: "all", level: 1, lessonId: "first-flight" },
    attempt: {
      questionIds: [choice.id, numeric.id],
      answers: { [choice.id]: validAnswer(choice), [numeric.id]: "12." },
      cursor: 1,
      startedAt: 1000,
    },
  };
}

describe("online practice selection and scoring", () => {
  it("selects independent level, lesson, and explicit wrong-answer sets", () => {
    const level2 = selectPracticeQuestions(
      { mode: "level", level: 2, lessonId: "" },
      {},
    );
    expect(level2.length).toBeGreaterThan(0);
    expect(level2.every((q) => q.level === 2)).toBe(true);
    const lesson = level2[0].lessonId;
    const lessonQuestions = selectPracticeQuestions(
      { mode: "lesson", level: 2, lessonId: lesson },
      {},
    );
    expect(lessonQuestions.length).toBeGreaterThan(0);
    expect(
      lessonQuestions.every((q) => q.lessonId === lesson && q.level === 2),
    ).toBe(true);
    const wrong = selectPracticeQuestions(
      { mode: "wrong", level: 1, lessonId: "" },
      { [questionBank[0].id]: false, [questionBank[1].id]: true },
    );
    expect(wrong.map((q) => q.id)).toEqual([questionBank[0].id]);
  });
  it("scores every submitted question and counts omitted answers as wrong", () => {
    const attempt = newPracticeAttempt(
      questionBank.map((q) => q.id),
      1000,
    );
    const answered = questionBank.slice(0, 2);
    attempt.answers = Object.fromEntries(
      answered.map((q) => [q.id, validAnswer(q)]),
    );
    const result = scorePracticeAttempt(attempt);
    expect(result.total).toBe(questionBank.length);
    expect(result.answered).toBe(2);
    expect(result.correct).toBe(2);
    expect(result.wrongIds.length).toBe(questionBank.length - 2);
    expect(result.results[questionBank[2].id]).toBe(false);
    expect(result.percentage).toBe(Math.round(200 / questionBank.length));
  });
  it("never treats an empty numeric answer as zero and rejects invalid numeric input", () => {
    const { numeric } = fixture();
    const zero = { ...numeric, answer: 0 };
    for (const value of [
      undefined,
      "",
      "  ",
      "NaN",
      "Infinity",
      "1 / 2",
      "12 m/s",
      "0x10",
      "1e999",
    ]) {
      expect(isAnswered(zero, value)).toBe(false);
      expect(
        scorePracticeAttempt(
          {
            ...newPracticeAttempt([zero.id], 1000),
            answers: { [zero.id]: value ?? "" },
          },
          [zero],
        ).correct,
      ).toBe(0);
    }
    expect(isAnswered(zero, "0")).toBe(true);
    expect(gradeQuestion(zero, "0")).toBe(true);
    expect(isAnswered(zero, "-1.25")).toBe(true);
  });
  it("rejects out-of-range choice answers and accepts only the correct option", () => {
    const { choice } = fixture();
    for (const value of ["", "-1", "0.5", String(choice.options.length), "NaN"])
      expect(isAnswered(choice, value)).toBe(false);
    expect(gradeQuestion(choice, choice.answer)).toBe(true);
    expect(
      gradeQuestion(choice, (choice.answer + 1) % choice.options.length),
    ).toBe(false);
  });
  it("creates a fresh retry containing only incorrect and unanswered questions", () => {
    const original = newPracticeAttempt(
      questionBank.slice(0, 3).map((q) => q.id),
      1000,
    );
    original.answers[questionBank[0].id] = validAnswer(questionBank[0]);
    original.submittedAt = 1500;
    const retry = retryWrongAttempt(original, 2000);
    expect(retry.questionIds).toEqual(
      questionBank.slice(1, 3).map((q) => q.id),
    );
    expect(retry.answers).toEqual({});
    expect(retry.cursor).toBe(0);
    expect(retry.startedAt).toBe(2000);
    expect(retry.submittedAt).toBeUndefined();
    expect(original.answers[questionBank[0].id]).toBe(
      validAnswer(questionBank[0]),
    );
  });
});

describe("versioned practice drafts", () => {
  it("preserves advanced-stage selections and question IDs during reload", () => {
    for (const level of [3, 4, 5, 6] as const) {
      const q = questionBank.find((q) => q.level === level)!;
      const state: PracticeState = {
        version: 1,
        selection: { mode: "lesson", level, lessonId: q.lessonId },
        attempt: newPracticeAttempt([q.id], 1000),
      };
      state.attempt!.answers[q.id] = String(q.answer);
      expect(savePracticeState(state)).toBe(true);
      expect(loadPracticeState()).toEqual(state);
      expect(scorePracticeAttempt(loadPracticeState()!.attempt!).correct).toBe(
        1,
      );
    }
  });
  it("restores unfinished answers, cursor and submitted results separately from learning progress", () => {
    const state = savedState();
    values.set(
      "fdl-progress-v1",
      JSON.stringify({ answers: { external: true } }),
    );
    expect(savePracticeState(state)).toBe(true);
    expect(loadPracticeState()).toEqual(state);
    state.attempt!.submittedAt = 2000;
    expect(savePracticeState(state)).toBe(true);
    expect(loadPracticeState()?.attempt?.submittedAt).toBe(2000);
    expect(JSON.parse(values.get("fdl-progress-v1")!).answers).toEqual({
      external: true,
    });
  });
  it("drops stale IDs, removes malformed answers and clamps a stale cursor", () => {
    const state = savedState();
    state.attempt!.questionIds.push(
      "deleted-question",
      state.attempt!.questionIds[0],
    );
    state.attempt!.answers["deleted-question"] = "0";
    state.attempt!.answers[state.attempt!.questionIds[0]] = "x".repeat(101);
    state.attempt!.cursor = 200;
    values.set(PRACTICE_STORAGE_KEY, JSON.stringify(state));
    const loaded = loadPracticeState()!;
    expect(loaded.attempt!.questionIds).toHaveLength(2);
    expect(loaded.attempt!.cursor).toBe(1);
    expect(loaded.attempt!.answers).not.toHaveProperty("deleted-question");
    expect(loaded.attempt!.answers).not.toHaveProperty(
      state.attempt!.questionIds[0],
    );
  });
  it("handles corrupt drafts, incompatible versions and storage denial", () => {
    for (const raw of [
      "{broken",
      "[]",
      JSON.stringify({ ...savedState(), version: 2 }),
      JSON.stringify({
        ...savedState(),
        attempt: { ...savedState().attempt, answers: [] },
      }),
    ]) {
      values.set(PRACTICE_STORAGE_KEY, raw);
      expect(loadPracticeState()).toBeNull();
    }
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("disabled");
      },
      setItem: () => {
        throw new Error("disabled");
      },
    });
    expect(loadPracticeState()).toBeNull();
    expect(savePracticeState(savedState())).toBe(false);
  });
});
