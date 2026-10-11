import { describe, expect, it } from "vitest";
import {
  centralDifferenceJacobian,
  compareLinearization,
  LINEARIZATION_DT,
  linearizationDefaults,
  nonlinearPitchDerivative,
  validateLinearization,
  type LinearizationParameters,
} from "../src/physics/linearization";

const radians = Math.PI / 180;
const parameters: LinearizationParameters = {
  trimAngle: 0,
  perturbation: 3 * radians,
  omega: 1.5,
  zeta: 0.4,
  effectiveness: 4,
};

function atTrim(p: LinearizationParameters, epsilon = 1e-5) {
  const input = (p.omega ** 2 * Math.sin(p.trimAngle)) / p.effectiveness;
  return centralDifferenceJacobian(
    (state, controls) => nonlinearPitchDerivative(state, controls, p),
    [p.trimAngle, 0],
    [input],
    epsilon,
  );
}

describe("nonlinear pitch field and numerical Jacobian", () => {
  it("uses radians, angular rate and the declared restoring, damping and input scales", () => {
    // At 30°, sinθ = 1/2: q̇ = −1.2×0.2 − 2.25×0.5 + 4×0.3 = −0.165 rad/s².
    const derivative = nonlinearPitchDerivative(
      [Math.PI / 6, 0.2],
      [0.3],
      parameters,
    );
    expect(derivative[0]).toBeCloseTo(0.2, 12);
    expect(derivative[1]).toBeCloseTo(-0.165, 12);
    expect(linearizationDefaults.perturbation).toBeCloseTo(Math.PI / 60, 12);
    expect(LINEARIZATION_DT).toBe(0.01);
  });

  it.each([-45, 0, 30, 45])(
    "matches independently differentiated A and B at %s° trim",
    (degrees) => {
      const p = { ...parameters, trimAngle: degrees * radians };
      const jacobian = atTrim(p);
      // θ̇ = q; ∂q̇/∂θ = −ω²cosθ; ∂q̇/∂q = −2ζω; ∂q̇/∂u = K.
      expect(jacobian.a).toHaveLength(2);
      expect(jacobian.a.every((row) => row.length === 2)).toBe(true);
      expect(jacobian.b).toHaveLength(2);
      expect(jacobian.b.every((row) => row.length === 1)).toBe(true);
      expect(jacobian.a[0][0]).toBeCloseTo(0, 12);
      expect(jacobian.a[0][1]).toBeCloseTo(1, 10);
      expect(jacobian.a[1][0]).toBeCloseTo(
        -2.25 * Math.cos(degrees * radians),
        8,
      );
      expect(jacobian.a[1][1]).toBeCloseTo(-1.2, 10);
      expect(jacobian.b[0][0]).toBeCloseTo(0, 12);
      expect(jacobian.b[1][0]).toBeCloseTo(4, 10);
      for (const residual of jacobian.residual)
        expect(residual).toBeCloseTo(0, 12);
    },
  );

  it("converges quadratically when the central-difference step is halved on the actual sine field", () => {
    const p = { ...parameters, trimAngle: 30 * radians };
    const exactSlope = (-2.25 * Math.sqrt(3)) / 2;
    const errors = [0.1, 0.05, 0.025].map((epsilon) =>
      Math.abs(atTrim(p, epsilon).a[1][0] - exactSlope),
    );
    expect(errors[0]).toBeGreaterThan(errors[1]);
    expect(errors[1]).toBeGreaterThan(errors[2]);
    // Central differencing sinθ has a leading ε² truncation term, so its error ratio is about four.
    expect(errors[0] / errors[1]).toBeGreaterThan(3.9);
    expect(errors[0] / errors[1]).toBeLessThan(4.1);
    expect(errors[1] / errors[2]).toBeGreaterThan(3.9);
    expect(errors[1] / errors[2]).toBeLessThan(4.1);
    expect(Math.abs(atTrim(p).a[1][0] - exactSlope)).toBeLessThan(1e-9);
  });

  it("changes stiffness with the operating angle while preserving damping and input effectiveness", () => {
    const origin = atTrim(parameters);
    const inclined = atTrim({ ...parameters, trimAngle: 40 * radians });
    expect(origin.a[1][0]).toBeCloseTo(-2.25, 8);
    expect(inclined.a[1][0]).toBeCloseTo(-2.25 * Math.cos(40 * radians), 8);
    expect(inclined.a[1][0] - origin.a[1][0]).toBeGreaterThan(0.5);
    expect(inclined.a[1][1]).toBeCloseTo(origin.a[1][1], 10);
    expect(inclined.b[1][0]).toBeCloseTo(origin.b[1][0], 10);
  });
});

describe("nonlinear versus linear fixed-step perturbation responses", () => {
  it("starts both systems at the same perturbation and matches the independent linear solution", () => {
    const p = { ...parameters, trimAngle: 30 * radians };
    const result = compareLinearization(p, 10);
    expect(result.dt).toBe(0.01);
    expect(result.duration).toBe(10);
    expect(result.samples).toHaveLength(1001);
    expect(result.samples[0].nonlinear).toBeCloseTo(3 * radians, 12);
    expect(result.samples[0].linear).toBeCloseTo(3 * radians, 12);
    expect(result.samples[0].nonlinearRate).toBe(0);
    expect(result.samples[0].linearRate).toBe(0);
    expect(result.samples[0].error).toBeCloseTo(0, 12);
    expect(result.trimState).toEqual([p.trimAngle, 0]);
    expect(result.trimInput[0]).toBeCloseTo((2.25 * 0.5) / 4, 12);

    // δθ̈ + 1.2δθ̇ + (2.25cos30°)δθ = 0, with δθ̇(0) = 0.
    const decay = 0.6;
    const stiffness = (2.25 * Math.sqrt(3)) / 2;
    const frequency = Math.sqrt(stiffness - decay ** 2);
    for (const time of [0, 1, 2, 5, 10]) {
      const sample = result.samples[time * 100];
      const envelope = p.perturbation * Math.exp(-decay * time);
      const expectedAngle =
        envelope *
        (Math.cos(frequency * time) +
          (decay / frequency) * Math.sin(frequency * time));
      const expectedRate =
        ((-envelope * stiffness) / frequency) * Math.sin(frequency * time);
      expect(sample.time).toBe(time);
      expect(sample.linear).toBeCloseTo(expectedAngle, 8);
      expect(sample.linearRate).toBeCloseTo(expectedRate, 8);
    }
    for (const [index, sample] of result.samples.entries()) {
      expect(sample.time).toBeCloseTo(index * 0.01, 12);
      expect(Object.values(sample).every(Number.isFinite)).toBe(true);
    }
  });

  it("has close small-perturbation trajectories and substantially larger error at large perturbation", () => {
    const p = { ...parameters, trimAngle: 30 * radians };
    const small = compareLinearization(p, 10);
    const large = compareLinearization(
      { ...p, perturbation: 35 * radians },
      10,
    );
    expect(small.maxError).toBeGreaterThan(0);
    expect(small.maxError).toBeLessThan(0.02 * p.perturbation);
    expect(large.maxError).toBeGreaterThan(20 * small.maxError);
    expect(large.maxError).toBeGreaterThan(0.01);
    expect(large.samples[0].nonlinear).toBeCloseTo(35 * radians, 12);
    expect(large.samples[0].linear).toBeCloseTo(35 * radians, 12);
    expect(
      large.samples.every((sample) =>
        Object.values(sample).every(Number.isFinite),
      ),
    ).toBe(true);
  });

  it("preserves a nonzero trim and zero perturbation throughout the ten-second integration", () => {
    const p = {
      ...parameters,
      trimAngle: -40 * radians,
      perturbation: 0,
      effectiveness: 7.3,
    };
    const result = compareLinearization(p, 10);
    expect(result.trimInput[0]).toBeCloseTo(
      (2.25 * Math.sin(-40 * radians)) / 7.3,
      12,
    );
    for (const residual of result.jacobian.residual)
      expect(residual).toBeCloseTo(0, 12);
    for (const sample of result.samples) {
      expect(sample.nonlinear).toBeCloseTo(0, 12);
      expect(sample.linear).toBe(0);
      expect(sample.nonlinearRate).toBeCloseTo(0, 12);
      expect(sample.linearRate).toBe(0);
      expect(sample.error).toBeCloseTo(0, 12);
    }
    expect(result.maxError).toBeLessThan(1e-12);
  });
});

describe("linearization parameter and dimension safeguards", () => {
  it("accepts stated limits and rejects nonfinite or unsupported parameters", () => {
    expect(() =>
      validateLinearization({
        ...parameters,
        trimAngle: 45 * radians,
        perturbation: 35 * radians,
        omega: 5,
        zeta: 2,
        effectiveness: 20,
      }),
    ).not.toThrow();
    expect(() =>
      validateLinearization({
        ...parameters,
        trimAngle: -45 * radians,
        perturbation: -35 * radians,
        omega: 0.2,
        zeta: 0,
      }),
    ).not.toThrow();
    const outside = [
      { trimAngle: 45.1 * radians },
      { trimAngle: -45.1 * radians },
      { perturbation: 35.1 * radians },
      { perturbation: -35.1 * radians },
      { omega: 0.19 },
      { omega: 5.01 },
      { zeta: -0.01 },
      { zeta: 2.01 },
      { effectiveness: 0 },
      { effectiveness: 20.01 },
    ];
    for (const change of outside) {
      expect(() => validateLinearization({ ...parameters, ...change })).toThrow(
        RangeError,
      );
    }
    for (const key of Object.keys(
      parameters,
    ) as (keyof LinearizationParameters)[]) {
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(() =>
          validateLinearization({ ...parameters, [key]: value }),
        ).toThrow(RangeError);
      }
    }
  });

  it("rejects inconsistent state/input dimensions, invalid differences and invalid vector-field outputs", () => {
    for (const [state, input] of [
      [[0], [0]],
      [[0, 0, 0], [0]],
      [[0, 0], []],
      [
        [0, 0],
        [0, 0],
      ],
      [[NaN, 0], [0]],
      [[0, Infinity], [0]],
      [[0, 0], [Infinity]],
    ]) {
      expect(() => nonlinearPitchDerivative(state, input, parameters)).toThrow(
        RangeError,
      );
    }
    const field = (state: number[], input: number[]) =>
      nonlinearPitchDerivative(state, input, parameters);
    for (const epsilon of [0, -1e-5, NaN, Infinity]) {
      expect(() =>
        centralDifferenceJacobian(field, [0, 0], [0], epsilon),
      ).toThrow(RangeError);
    }
    expect(() => centralDifferenceJacobian(field, [], [0])).toThrow(RangeError);
    expect(() => centralDifferenceJacobian(field, [0, Infinity], [0])).toThrow(
      RangeError,
    );
    expect(() => centralDifferenceJacobian(field, [0, 0], [NaN])).toThrow(
      RangeError,
    );
    for (const invalidField of [
      () => [0],
      () => [0, 0, 0],
      () => [NaN, 0],
      () => [0, Infinity],
    ]) {
      expect(() =>
        centralDifferenceJacobian(invalidField, [0, 0], [0]),
      ).toThrow(RangeError);
    }
  });

  it("requires bounded durations on the fixed 0.01-second grid, including valid zero duration", () => {
    for (const duration of [-0.01, 30.01, 0.015, NaN, Infinity]) {
      expect(() => compareLinearization(parameters, duration)).toThrow(
        RangeError,
      );
    }
    const initialOnly = compareLinearization(parameters, 0);
    expect(initialOnly.samples).toHaveLength(1);
    expect(initialOnly.samples[0].time).toBe(0);
    expect(initialOnly.samples[0].nonlinear).toBeCloseTo(
      parameters.perturbation,
      12,
    );
    expect(initialOnly.samples[0].linear).toBe(parameters.perturbation);
  });
});
