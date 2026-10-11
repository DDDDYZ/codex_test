import { describe, expect, it } from "vitest";
import { bodyToNed } from "../src/physics/models";
import {
  coordinateModel,
  DYNAMICS_STEP,
  dynamicsCsv,
  dynamicsDefaults,
  eigenvalueStability,
  exactOscillator,
  matrixVector,
  modalSystem,
  oscillatorRoots,
  simulateModal,
  stepModal,
  validateDynamics,
} from "../src/physics/dynamics";

describe("continuous reduced modal systems", () => {
  it("uses distinct SI short-period/phugoid time scales and correct modal blocks", () => {
    const system = modalSystem("longitudinal", dynamicsDefaults);
    const expectedMatrix = [
      [0, 1, 0, 0],
      [-9, -3.3, 0, 0],
      [0, 0, 0, 1],
      [0, 0, -0.0625, -0.04],
    ];
    system.matrix.forEach((row, i) =>
      row.forEach((value, j) =>
        expect(value).toBeCloseTo(expectedMatrix[i][j], 12),
      ),
    );
    expect(system.stability).toBe("stable");
    expect(system.eigenvalues[0].real).toBeCloseTo(-1.65, 12);
    expect(system.eigenvalues[0].imaginary).toBeCloseTo(
      3 * Math.sqrt(1 - 0.55 ** 2),
      12,
    );
    expect(system.eigenvalues[2].real).toBeCloseTo(-0.02, 12);
    expect(system.eigenvalues[2].imaginary).toBeCloseTo(
      0.25 * Math.sqrt(1 - 0.08 ** 2),
      12,
    );
    const oneSecond = simulateModal(system, 1).samples.at(-1)!.state;
    expect(Math.abs(oneSecond[0])).toBeLessThan(Math.abs(oneSecond[2]) / 2);
    expect(Math.abs(oneSecond[2])).toBeGreaterThan(0.048);
  });

  it("has independent lateral Dutch-roll, roll-decay and spiral trajectories", () => {
    const system = modalSystem("lateral", dynamicsDefaults);
    const result = simulateModal(system, 5).samples.at(-1)!.state;
    const [dutch, dutchRate] = exactOscillator(1.3, 0.18, 0.05, 0, 5);
    expect(result[0]).toBeCloseTo(dutch, 9);
    expect(result[1]).toBeCloseTo(dutchRate, 9);
    expect(result[2]).toBeCloseTo(0.05 * Math.exp(-1.2 * 5), 10);
    expect(result[3]).toBeCloseTo(0.05 * Math.exp(0.025 * 5), 10);
    expect(system.eigenvalues[2].real).toBe(-1.2);
    expect(system.eigenvalues[3].real).toBe(0.025);
    expect(system.stability).toBe("unstable");
    const differentDutch = modalSystem("lateral", {
      ...dynamicsDefaults,
      dutchOmega: 2.8,
      dutchZeta: 0.7,
    });
    const altered = simulateModal(differentDutch, 5).samples.at(-1)!.state;
    expect(altered[0]).not.toBeCloseTo(result[0], 5);
    expect(altered[2]).toBe(result[2]);
    expect(altered[3]).toBe(result[3]);
  });

  it("solves underdamped, undamped, critical, overdamped and negative-damping roots", () => {
    for (const zeta of [-1.5, -1, -0.2, 0, 0.2, 1, 1.5]) {
      const roots = oscillatorRoots(2, zeta);
      for (const { real: a, imaginary: b } of roots) {
        expect(a * a - b * b + 4 * zeta * a + 4).toBeCloseTo(0, 12);
        expect(2 * a * b + 4 * zeta * b).toBeCloseTo(0, 12);
      }
      expect(eigenvalueStability(roots)).toBe(
        zeta < 0 ? "unstable" : zeta === 0 ? "marginal" : "stable",
      );
    }
    expect(oscillatorRoots(3, 1)).toEqual([
      { real: -3, imaginary: 0, mode: "模态" },
      { real: -3, imaginary: -0, mode: "模态" },
    ]);
    expect(
      oscillatorRoots(2, 1.5).every((r) => r.imaginary === 0 && r.real < 0),
    ).toBe(true);
    expect(
      oscillatorRoots(2, -1.5).every((r) => r.imaginary === 0 && r.real > 0),
    ).toBe(true);
    expect(
      modalSystem("lateral", { ...dynamicsDefaults, spiralRate: -0.025 })
        .stability,
    ).toBe("stable");
    expect(
      modalSystem("lateral", { ...dynamicsDefaults, spiralRate: 0 }).stability,
    ).toBe("marginal");
  });

  it("rejects unsupported or nonfinite model inputs and inconsistent dimensions", () => {
    for (const p of [
      { ...dynamicsDefaults, shortOmega: 0 },
      { ...dynamicsDefaults, dutchZeta: NaN },
      { ...dynamicsDefaults, spiralRate: Infinity },
    ])
      expect(() => validateDynamics(p)).toThrow(RangeError);
    expect(() => oscillatorRoots(0, 0.5)).toThrow(RangeError);
    expect(() => matrixVector([[1, 0]], [1])).toThrow(RangeError);
    expect(() => matrixVector([[1]], [NaN])).toThrow(RangeError);
    const system = modalSystem("longitudinal", dynamicsDefaults);
    expect(() => simulateModal(system, -1)).toThrow(RangeError);
    expect(() => simulateModal(system, 2.005)).toThrow(RangeError);
    expect(() => simulateModal(system, 2, 0)).toThrow(RangeError);
    expect(() => simulateModal(system, 2, 0.000001)).toThrow(RangeError);
  });
});

describe("fixed-step RK4 validation against independent analytic responses", () => {
  it("agrees with analytic displacement and velocity for every damping regime", () => {
    for (const zeta of [-1.5, -1, -0.3, 0, 0.7, 1, 1.5]) {
      const system = modalSystem("longitudinal", {
        ...dynamicsDefaults,
        shortOmega: 2,
        shortZeta: zeta,
      });
      const actual = simulateModal(system, 1).samples.at(-1)!.state;
      const expected = exactOscillator(2, zeta, 0.05, 0, 1);
      expect(Math.abs(actual[0] - expected[0])).toBeLessThan(
        1e-6 * Math.max(1, Math.abs(expected[0])),
      );
      expect(Math.abs(actual[1] - expected[1])).toBeLessThan(
        1e-6 * Math.max(1, Math.abs(expected[1])),
      );
    }
    const criticallyDamped = exactOscillator(2, 1, 0.05, 0, 1);
    expect(criticallyDamped[0]).toBeCloseTo(0.05 * 3 * Math.exp(-2), 12);
    expect(criticallyDamped[1]).toBeCloseTo(-0.2 * Math.exp(-2), 12);
    const undamped = exactOscillator(2, 0, 0.05, 0, 1);
    expect(undamped[0]).toBeCloseTo(0.05 * Math.cos(2), 12);
    expect(undamped[1]).toBeCloseTo(-0.1 * Math.sin(2), 12);
  });

  it("has fourth-order convergence rather than only a visually plausible trajectory", () => {
    const system = modalSystem("longitudinal", {
      ...dynamicsDefaults,
      shortOmega: 3,
      shortZeta: 0.2,
    });
    const expected = exactOscillator(3, 0.2, 0.05, 0, 2);
    const error = (dt: number) => {
      const actual = simulateModal(system, 2, dt).samples.at(-1)!.state;
      return Math.hypot(actual[0] - expected[0], actual[1] - expected[1]);
    };
    expect(error(0.04) / error(0.02)).toBeGreaterThan(14);
    expect(error(0.04) / error(0.02)).toBeLessThan(18);
    expect(error(0.02) / error(0.01)).toBeGreaterThan(14);
    expect(error(0.01)).toBeLessThan(1e-8);
  });

  it("preserves the ODE derivative to first order and uses integer-index timestamps", () => {
    const system = modalSystem("longitudinal", dynamicsDefaults);
    const derivative = matrixVector(system.matrix, system.initial);
    const h = 1e-6;
    const next = stepModal(system, system.initial, h);
    next.forEach((v, i) =>
      expect((v - system.initial[i]) / h).toBeCloseTo(derivative[i], 5),
    );
    const trajectory = simulateModal(system, 2);
    expect(trajectory.dt).toBe(DYNAMICS_STEP);
    expect(trajectory.samples).toHaveLength(201);
    expect(trajectory.samples.at(-1)!.t).toBe(2);
    trajectory.samples.forEach((sample, i) =>
      expect(sample.t).toBe(i * DYNAMICS_STEP),
    );
  });

  it("separates physical instability from a display guard and exports the computed states", () => {
    const system = modalSystem("longitudinal", {
      ...dynamicsDefaults,
      shortOmega: 6,
      shortZeta: -1.5,
    });
    const trajectory = simulateModal(system, 120);
    expect(system.stability).toBe("unstable");
    expect(trajectory.termination).toBe("display-guard");
    expect(trajectory.samples.at(-1)!.t).toBeLessThan(120);
    expect(
      trajectory.samples.every((s) => s.state.every(Number.isFinite)),
    ).toBe(true);
    expect(trajectory.message).toContain("特征值");
    const csv = dynamicsCsv(system, trajectory);
    expect(csv).toContain(
      "dt_s=0.01; termination=display-guard; continuous_stability=unstable",
    );
    expect(csv).toContain("# A_row_1=0;1;0;0");
    expect(csv).toContain("time_s,ηSP_rad,η̇SP_rad_s,ηPH_rad,η̇PH_rad_s");
    expect(
      csv.split("\n").filter((line) => !line.startsWith("#")),
    ).toHaveLength(trajectory.samples.length + 1);
    const finiteUnstable = simulateModal(
      modalSystem("lateral", dynamicsDefaults),
      5,
    );
    expect(finiteUnstable.termination).toBe("complete");
  });
});

describe("body-to-NED rotation and equivalent quaternion", () => {
  it("matches the forward-axis pitch sign and exact Euler convention", () => {
    const result = coordinateModel({ roll: 0, pitch: 30, yaw: 0 });
    expect(result.matrix[0][0]).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(result.matrix[1][0]).toBe(0);
    expect(result.matrix[2][0]).toBeCloseTo(-0.5, 12);
    expect(coordinateModel({ roll: 45, pitch: 30, yaw: 60 }).matrix).toEqual(
      bodyToNed(45, 30, 60),
    );
  });

  it("preserves orientation, lengths and inner products even at Euler singularities", () => {
    for (const angles of [
      { roll: 35, pitch: -28, yaw: 124 },
      { roll: -180, pitch: 90, yaw: 180 },
      { roll: 0, pitch: -90, yaw: 0 },
    ]) {
      const result = coordinateModel(angles);
      expect(result.orthogonalityError).toBeLessThan(1e-14);
      expect(result.determinant).toBeCloseTo(1, 12);
      expect(Math.hypot(...result.quaternion)).toBeCloseTo(1, 12);
      const vector = [12, -3, 7];
      const transformed = matrixVector(result.matrix, vector);
      expect(Math.hypot(...transformed)).toBeCloseTo(Math.hypot(...vector), 12);
      expect(result.eulerSingular).toBe(Math.abs(angles.pitch) === 90);
    }
  });

  it("constructs a quaternion whose rotation matrix matches bodyToNed, not just a unit norm", () => {
    const result = coordinateModel({ roll: -31, pitch: 68, yaw: 113 });
    const [w, x, y, z] = result.quaternion;
    const matrix = [
      [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ];
    matrix.forEach((row, i) =>
      row.forEach((value, j) =>
        expect(value).toBeCloseTo(result.matrix[i][j], 12),
      ),
    );
    expect(() => coordinateModel({ roll: 0, pitch: 91, yaw: 0 })).toThrow(
      RangeError,
    );
    expect(() => coordinateModel({ roll: NaN, pitch: 0, yaw: 0 })).toThrow(
      RangeError,
    );
    expect(() => coordinateModel({ roll: 0, pitch: 0 } as never)).toThrow(
      RangeError,
    );
  });
});
