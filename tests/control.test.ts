import { describe, expect, it } from "vitest";
import { DEG } from "../src/physics/models";
import {
  controlDefaults,
  controllerOutput,
  initialControlState,
  responseMetrics,
  sampleControl,
  stepControl,
  validateControl,
  type ControlParameters,
  type ControlState,
} from "../src/physics/control";

function run(
  p: ControlParameters,
  seconds: number,
  initial: ControlState = initialControlState,
) {
  let state = { ...initial };
  const rows = [sampleControl(state, p)];
  for (let i = 0; i < Math.round(seconds / 0.01); i++) {
    state = stepControl(state, p);
    rows.push(sampleControl(state, p));
  }
  return { state, rows };
}
describe("hypothetical pitch plant and bounded actuator", () => {
  it("integrates the actual second-order free response against an analytic solution", () => {
    const p = {
      ...controlDefaults,
      mode: "manual" as const,
      manual: 0,
      gust: 0,
    };
    const theta0 = 5 * DEG,
      t = 2;
    const { state } = run(p, t, { ...initialControlState, theta: theta0 });
    const damped = p.naturalFrequency * Math.sqrt(1 - p.damping ** 2);
    const exact =
      theta0 *
      Math.exp(-p.damping * p.naturalFrequency * t) *
      (Math.cos(damped * t) +
        ((p.damping * p.naturalFrequency) / damped) * Math.sin(damped * t));
    expect(state.theta).toBeCloseTo(exact, 9);
  });
  it("preserves a force-balanced manual equilibrium", () => {
    const manual = 4 * DEG;
    const p = { ...controlDefaults, mode: "manual" as const, manual };
    const initial = {
      ...initialControlState,
      theta: (p.effectiveness * manual) / p.naturalFrequency ** 2,
      actuator: manual,
    };
    expect(run(p, 3, initial).state.theta).toBeCloseTo(initial.theta, 12);
  });
  it("limits both actuator position and slew rate for deliberately excessive commands", () => {
    const p = { ...controlDefaults, target: 30 * DEG, kp: 12 };
    let state = { ...initialControlState };
    for (let i = 0; i < 400; i++) {
      const next = stepControl(state, p);
      expect(Math.abs(next.actuator)).toBeLessThanOrEqual(
        p.actuatorLimit + 1e-12,
      );
      expect(Math.abs(next.actuator - state.actuator)).toBeLessThanOrEqual(
        p.actuatorRate * 0.01 + 1e-12,
      );
      state = next;
    }
  });
  it("blocks integration into saturation but allows the integral to unwind", () => {
    const p = { ...controlDefaults, target: 30 * DEG, kp: 12 };
    expect(controllerOutput(initialControlState, p).integralDerivative).toBe(0);
    const state = { ...initialControlState, theta: 31 * DEG, integral: 2 };
    const output = controllerOutput(state, p);
    expect(output.saturated).toBe(true);
    expect(output.integralDerivative).toBeLessThan(0);
  });
  it("PID removes the steady error of this plant, including a persistent pitch disturbance", () => {
    const clean = run(controlDefaults, 25);
    const disturbed = run({ ...controlDefaults, gust: 0.3 }, 25);
    expect(Math.abs(clean.state.theta - controlDefaults.target)).toBeLessThan(
      0.02 * DEG,
    );
    expect(
      Math.abs(disturbed.state.theta - controlDefaults.target),
    ).toBeLessThan(0.02 * DEG);
    const feedback = run({ ...controlDefaults, mode: "feedback" }, 25);
    expect(
      Math.abs(feedback.state.theta - controlDefaults.target),
    ).toBeGreaterThan(1 * DEG);
  });
  it("rejects invalid physical/controller inputs", () => {
    expect(() => validateControl({ ...controlDefaults, kp: NaN })).toThrow(
      RangeError,
    );
    expect(() =>
      validateControl({ ...controlDefaults, actuatorLag: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      stepControl({ ...initialControlState, theta: NaN }, controlDefaults),
    ).toThrow(RangeError);
  });
});
describe("honest observed-window step metrics", () => {
  const sample = (time: number, theta: number, target = 1) => ({
    time,
    theta,
    target,
    actuator: 0,
    error: target - theta,
  });
  it("calculates signed-direction overshoot and requires a one-second in-band dwell", () => {
    const rows = [
      sample(0, 0),
      sample(0.5, 1.2),
      sample(1, 0.99),
      sample(2, 1),
    ];
    expect(responseMetrics(rows).overshoot).toBeCloseTo(20, 10);
    expect(responseMetrics(rows).settlingTime).toBe(1);
    expect(responseMetrics(rows.slice(0, 3)).settlingTime).toBeNull();
    expect(
      responseMetrics(
        rows.map((r) => ({
          ...r,
          theta: -r.theta,
          target: -r.target,
          error: -r.error,
        })),
      ).overshoot,
    ).toBeCloseTo(20, 10);
  });
  it("withholds step metrics for disturbances, zero steps or changing targets", () => {
    expect(
      responseMetrics([sample(0, 0), sample(2, 1)], false).overshoot,
    ).toBeNull();
    expect(
      responseMetrics([sample(0, 1), sample(2, 1)]).settlingTime,
    ).toBeNull();
    expect(
      responseMetrics([sample(0, 0), sample(2, 2, 2)]).overshoot,
    ).toBeNull();
  });
});
