import { afterEach, it, expect, vi } from "vitest";
import { loadProgress, saveProgress } from "../src/storage/progress";
afterEach(() => vi.unstubAllGlobals());
it("preserves existing Phase 1 mastery when Phase 2 tracking is added", () => {
  let text = JSON.stringify({
    completed: true,
    prediction: true,
    answers: { balance: true, speed: false, experiment: true },
  });
  vi.stubGlobal("localStorage", {
    getItem: () => text,
    setItem: (_key: string, value: string) => {
      text = value;
    },
  });
  const old = loadProgress();
  expect(old.completed).toBe(true);
  const upgraded = {
    ...old,
    completedLessons: ["first-flight", "polar"],
    predictions: { polar: true },
    answers: { ...old.answers, "perf-polar": true },
  };
  expect(saveProgress(upgraded)).toBe(true);
  expect(loadProgress()).toEqual(upgraded);
});
it("sanitizes corrupted extension fields without dropping older progress", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        completed: true,
        prediction: false,
        answers: { balance: true, speed: "invalid" },
        completedLessons: ["polar", "polar", null],
        predictions: { polar: true, turn: "invalid" },
      }),
  });
  expect(loadProgress()).toEqual({
    completed: true,
    prediction: false,
    answers: { balance: true },
    completedLessons: ["polar"],
    predictions: { polar: true },
  });
});
