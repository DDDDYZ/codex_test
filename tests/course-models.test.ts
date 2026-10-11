import { describe, expect, it } from "vitest";
import katex from "katex";
import { lesson as foundationLesson } from "../src/content/curriculum";
import { performanceLessons } from "../src/content/phase2";
import { stabilityLessons } from "../src/content/phase3";
import { dynamicsLessons } from "../src/content/phase4";
import { controlLessons } from "../src/content/phase5";
import { questionBank, gradeQuestion } from "../src/content/questions";
import {
  DEFAULT_STABILITY_PARAMETERS,
  solveTrim,
  stabilityDerivatives,
} from "../src/physics/stability";
import {
  coordinateModel,
  dynamicsDefaults,
  modalSystem,
} from "../src/physics/dynamics";
import {
  initialSixDofState,
  sixDofControls,
  sixDofDefaults,
  sixDofLoads,
} from "../src/physics/sixDof";

function numeric(id: string): number {
  const q = questionBank.find((q) => q.id === id);
  if (!q || q.kind !== "numeric") throw new Error(`Missing calculation: ${id}`);
  return q.answer;
}

describe("course examples agree with the interactive models", () => {
  it("renders every derivation step without malformed formulas or control characters", () => {
    for (const lesson of [
      foundationLesson,
      ...performanceLessons,
      ...stabilityLessons,
      ...dynamicsLessons,
      ...controlLessons,
    ]) {
      for (const step of lesson.steps) {
        expect(step.formula).not.toMatch(/[\u0000-\u001f]/);
        expect(() =>
          katex.renderToString(step.formula, { throwOnError: true }),
        ).not.toThrow();
      }
    }
  });
  it("connects every question to an open course at the same level without duplicate IDs", () => {
    const lessons = [
      { id: "first-flight", level: 1 },
      ...performanceLessons.map((l) => ({ ...l, level: 2 })),
      ...stabilityLessons,
      ...dynamicsLessons,
      ...controlLessons,
    ];
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    expect(new Set(questionBank.map((q) => q.id)).size).toBe(
      questionBank.length,
    );
    for (const q of questionBank)
      expect(lessons.find((l) => l.id === q.lessonId)?.level).toBe(q.level);
    for (const l of lessons)
      expect(questionBank.some((q) => q.lessonId === l.id)).toBe(true);
    expect([...new Set(lessons.map((l) => l.level))].sort()).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
  it("keeps published neutral-point and trim calculation answers calibrated", () => {
    expect(numeric("p3-margin-neutral-point")).toBeCloseTo(
      100 * stabilityDerivatives(DEFAULT_STABILITY_PARAMETERS).neutralPoint,
      10,
    );
    expect(numeric("p3-trim-speed-demand")).toBeCloseTo(
      solveTrim({ ...DEFAULT_STABILITY_PARAMETERS, speed: 40 }).requiredCl,
      10,
    );
  });
  it("uses the same NED signs and modal time scales in exercises and experiments", () => {
    expect(numeric("p4-coordinate-front-axis")).toBeCloseTo(
      coordinateModel({ roll: 0, pitch: 30, yaw: 0 }).matrix[2][0],
      10,
    );
    expect(numeric("p5-longitudinal-decay-rate")).toBeCloseTo(
      modalSystem("longitudinal", dynamicsDefaults).eigenvalues[0].real,
      10,
    );
    expect(numeric("p5-lateral-spiral-double")).toBeCloseTo(
      Math.log(2) / dynamicsDefaults.spiralRate,
      10,
    );
    expect(numeric("p5-lateral-roll-time")).toBeCloseTo(
      1 / dynamicsDefaults.rollDecay,
      10,
    );
  });
  it("uses air-relative velocity for the published wind exercise", () => {
    const loads = sixDofLoads(
      initialSixDofState(),
      { ...sixDofDefaults, wind: [10, 0, 0] },
      sixDofControls,
    );
    expect(numeric("p6-sixdof-wind-airspeed")).toBeCloseTo(loads.speed, 10);
  });
  it("grades all six levels, including negative and zero-valued numeric answers", () => {
    for (const q of questionBank) {
      expect(gradeQuestion(q, String(q.answer))).toBe(true);
      if (q.kind === "numeric")
        expect(gradeQuestion(q, q.answer + 2 * q.tolerance + 1)).toBe(false);
    }
  });
});
