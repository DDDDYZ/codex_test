import { describe, expect, it } from "vitest";
import { DEG, G } from "../src/physics/models";
import {
  DEFAULT_STABILITY_PARAMETERS,
  liftCoefficient,
  momentCurve,
  pitchingMoment,
  solveTrim,
  stabilityDerivatives,
  tailVolumeCoefficient,
  validateStabilityParameters,
} from "../src/physics/stability";

const p = DEFAULT_STABILITY_PARAMETERS;

describe("stick-fixed longitudinal static stability", () => {
  it("matches the wing-tail neutral point and analytical moment derivative", () => {
    const d = stabilityDerivatives(p);
    const tailAlphaSlope = 0.9 * 4 * (3.2 / 16) * (1 - 0.35);
    const a = 5.2 + tailAlphaSlope;
    const expectedNp = (5.2 * 0.25 + tailAlphaSlope * (0.25 + 4 / 1.5)) / a;
    expect(d.clAlpha).toBeCloseTo(a, 12);
    expect(d.neutralPoint).toBeCloseTo(expectedNp, 12);
    expect(d.staticMargin).toBeCloseTo(expectedNp - 0.3, 12);
    expect(d.cmAlpha).toBeCloseTo(-0.9646, 12);
    expect(tailVolumeCoefficient(p)).toBeCloseTo((3.2 * 4) / (16 * 1.5), 12);
    const step = 0.0001;
    expect(
      (pitchingMoment(p, 0.1 + step, -0.04) -
        pitchingMoment(p, 0.1 - step, -0.04)) /
        (2 * step),
    ).toBeCloseTo(d.cmAlpha, 10);
  });

  it("distinguishes restoring, neutral and destabilizing moment increments", () => {
    const np = stabilityDerivatives(p).neutralPoint;
    const stable = { ...p, cg: np - 0.1 };
    const neutral = { ...p, cg: np };
    const unstable = { ...p, cg: np + 0.1 };
    expect(stabilityDerivatives(stable).stability).toBe("stable");
    expect(stabilityDerivatives(neutral).stability).toBe("neutral");
    expect(stabilityDerivatives(unstable).stability).toBe("unstable");
    expect(
      pitchingMoment(stable, DEG) - pitchingMoment(stable, 0),
    ).toBeLessThan(0);
    expect(
      pitchingMoment(neutral, DEG) - pitchingMoment(neutral, 0),
    ).toBeCloseTo(0, 12);
    expect(
      pitchingMoment(unstable, DEG) - pitchingMoment(unstable, 0),
    ).toBeGreaterThan(0);
  });

  it("shifts the neutral point aft when tail area or arm increases", () => {
    const baseline = stabilityDerivatives(p);
    for (const largerTail of [
      { ...p, tailArea: 5 },
      { ...p, tailArm: 5 },
    ]) {
      const d = stabilityDerivatives(largerTail);
      expect(d.neutralPoint).toBeGreaterThan(baseline.neutralPoint);
      expect(d.staticMargin).toBeGreaterThan(baseline.staticMargin);
      expect(d.cmAlpha).toBeLessThan(baseline.cmAlpha);
    }
    expect(stabilityDerivatives({ ...p, tailArea: 0 }).neutralPoint).toBe(
      p.wingAc,
    );
    const aft = stabilityDerivatives({ ...p, cg: p.cg + 0.05 });
    expect(aft.staticMargin).toBeCloseTo(baseline.staticMargin - 0.05, 12);
  });

  it("changes the CG moment reference by CL times the normalized displacement", () => {
    const alpha = 0.08;
    const elevator = -0.06;
    const displacement = 0.1;
    const shift =
      pitchingMoment({ ...p, cg: p.cg + displacement }, alpha, elevator) -
      pitchingMoment(p, alpha, elevator);
    expect(shift).toBeCloseTo(
      liftCoefficient(p, alpha, elevator) * displacement,
      12,
    );
  });
});

describe("coupled lift and pitching moment equilibrium", () => {
  it("satisfies both equations and preserves radians at the default trim", () => {
    const t = solveTrim(p);
    expect(t.status).toBe("valid");
    expect(t.alpha! / DEG).toBeCloseTo(2.068887841920369, 6);
    expect(t.elevator! / DEG).toBeCloseTo(-4.313785020579735, 6);
    expect(
      liftCoefficient(p, t.alpha!, t.elevator!) * t.q * p.area,
    ).toBeCloseTo(p.mass * G, 8);
    expect(pitchingMoment(p, t.alpha!, t.elevator!)).toBeCloseTo(0, 12);
    expect(t.liftResidual).toBeCloseTo(0, 8);
    expect(t.momentResidual).toBeCloseTo(0, 8);
  });

  it("permits unique trim at neutral or unstable slope without declaring dynamic stability", () => {
    const np = stabilityDerivatives(p).neutralPoint;
    for (const cg of [np, np + 0.1]) {
      const params = { ...p, cg };
      const t = solveTrim(params);
      expect(t.valid).toBe(true);
      expect(Math.abs(t.determinant)).toBeGreaterThan(1);
      expect(liftCoefficient(params, t.alpha!, t.elevator!)).toBeCloseTo(
        t.requiredCl,
        12,
      );
      expect(pitchingMoment(params, t.alpha!, t.elevator!)).toBeCloseTo(0, 12);
    }
  });

  it("increases required CL and changes both trim controls when speed decreases", () => {
    const fast = solveTrim(p);
    const slow = solveTrim({ ...p, speed: 40 });
    expect(slow.valid).toBe(true);
    expect(slow.requiredCl / fast.requiredCl).toBeCloseTo((50 / 40) ** 2, 12);
    expect(slow.alpha!).toBeGreaterThan(fast.alpha!);
    expect(slow.elevator!).toBeLessThan(fast.elevator!);
    expect(slow.liftResidual).toBeCloseTo(0, 8);
    expect(slow.momentResidual).toBeCloseTo(0, 8);
  });

  it("reports missing independent control authority rather than inventing a trim", () => {
    for (const params of [
      { ...p, tailArea: 0 },
      { ...p, elevatorEffectiveness: 0 },
    ]) {
      const t = solveTrim(params);
      expect(t.status).toBe("singular");
      expect(t.valid).toBe(false);
      expect(t.alpha).toBeNull();
      expect(t.elevator).toBeNull();
      expect(t.liftResidual).toBeNull();
    }
  });

  it("rejects stall, insufficient elevator and out-of-envelope alpha separately", () => {
    const stalled = solveTrim({ ...p, speed: 15 });
    expect(stalled.status).toBe("stall");
    expect(stalled.requiredCl).toBeGreaterThan(p.clMax);
    expect(stalled.alpha).toBeNull();
    const limited = solveTrim({ ...p, elevatorLimit: DEG });
    expect(limited.status).toBe("control-limit");
    expect(Math.abs(limited.candidateElevator!)).toBeGreaterThan(DEG);
    expect(limited.elevator).toBeNull();
    const outside = solveTrim({
      ...p,
      cg: stabilityDerivatives(p).neutralPoint,
      speed: 24,
      clMax: 2,
    });
    expect(outside.status).toBe("outside-model");
    expect(outside.candidateAlpha!).toBeGreaterThan(15 * DEG);
    expect(outside.alpha).toBeNull();
  });
});

describe("model envelope and scientific curve data", () => {
  it("rejects nonfinite parameters and invalid angle/point requests", () => {
    expect(() => validateStabilityParameters({ ...p, cg: NaN })).toThrow(
      RangeError,
    );
    expect(() => solveTrim({ ...p, density: 0 })).toThrow(RangeError);
    expect(() => pitchingMoment(p, Infinity)).toThrow(RangeError);
    expect(() => momentCurve(p, p.elevatorLimit + DEG)).toThrow(RangeError);
    expect(() => momentCurve(p, 0, 1)).toThrow(RangeError);
    expect(() => momentCurve(p, 0, 2.5)).toThrow(RangeError);
  });

  it("samples physical radians with explicit degree labels and CL validity", () => {
    const rows = momentCurve(p, 0, 24);
    expect(rows[0].alphaDegrees).toBeCloseTo(-8, 12);
    expect(rows.at(-1)!.alphaDegrees).toBeCloseTo(15, 12);
    for (const row of rows) {
      expect(row.alphaDegrees * DEG).toBeCloseTo(row.alpha, 12);
      expect(row.cm).toBeCloseTo(pitchingMoment(p, row.alpha), 12);
      expect(row.valid).toBe(Math.abs(row.cl) <= p.clMax + 1e-10);
    }
    expect(rows.some((r) => !r.valid)).toBe(true);
    expect(rows.some((r) => r.valid)).toBe(true);
  });
});
