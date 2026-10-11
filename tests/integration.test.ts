import { it, expect, afterEach, vi } from "vitest";
import { solveRequest, experiments } from "../src/physics/experiments";
import { defaults, type aerodynamics } from "../src/physics/models";
import { loadProgress, saveProgress } from "../src/storage/progress";
afterEach(() => vi.unstubAllGlobals());
it("registered experiment endpoints solve and report invalid requests", () => {
  expect(Object.keys(experiments)).toHaveLength(3);
  expect(
    (
      solveRequest({ requestId: 7, experimentId: "lift", parameters: defaults })
        .result as ReturnType<typeof aerodynamics>
    ).lift,
  ).toBeCloseTo(14700, 8);
  expect(
    solveRequest({
      requestId: 8,
      experimentId: "forces",
      parameters: { ...defaults, density: 0 },
    }).error,
  ).toContain("RangeError");
});
it("stores and restores progress with the versioned adapter", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  const progress = {
    completed: true,
    prediction: true,
    answers: { speed: true, stall: false },
  };
  expect(saveProgress(progress)).toBe(true);
  expect(loadProgress()).toEqual(progress);
});
it("handles malformed and unavailable storage safely", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("denied");
    },
  });
  expect(loadProgress().completed).toBe(false);
  expect(
    saveProgress({ completed: false, prediction: false, answers: {} }),
  ).toBe(false);
});
