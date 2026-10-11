import { describe, expect, it } from "vitest";
import { DEG, G } from "../src/physics/models";
import {
  initialSixDofState,
  matrixVector,
  normalizeQuaternion,
  quaternionEuler,
  quaternionMatrix,
  sixDofControls,
  sixDofDefaults,
  sixDofDerivative,
  sixDofLoads,
  stepSixDof,
  type SixDofParameters,
  type SixDofState,
  type Vec3,
} from "../src/physics/sixDof";

const ballistic = { ...sixDofDefaults, aerodynamic: false };
const noControls = { thrust: 0, elevator: 0, aileron: 0, rudder: 0 };
function run(
  state: SixDofState,
  p: SixDofParameters,
  seconds: number,
  controls = noControls,
) {
  let next = state;
  for (let i = 0; i < Math.round(seconds / 0.01); i++)
    next = stepSixDof(next, p, controls);
  return next;
}
describe("body-frame rigid-body six-degree-of-freedom dynamics", () => {
  it("matches analytical no-aero free fall in NED, including downward-positive altitude", () => {
    const start = {
      ...initialSixDofState(),
      position: [0, 0, 0] as Vec3,
      velocity: [0, 0, 0] as Vec3,
    };
    const end = run(start, ballistic, 2);
    expect(end.position[2]).toBeCloseTo(0.5 * G * 4, 9);
    expect(end.velocity[2]).toBeCloseTo(G * 2, 9);
    expect(end.position[0]).toBe(0);
  });
  it("preserves inertial linear momentum while body velocity rotates", () => {
    const start = { ...initialSixDofState(), rates: [0.2, -0.15, 0.1] as Vec3 };
    const end = run(start, { ...ballistic, gravity: 0 }, 5);
    const inertial = matrixVector(quaternionMatrix(end.attitude), end.velocity);
    expect(inertial[0]).toBeCloseTo(50, 6);
    expect(inertial[1]).toBeCloseTo(0, 6);
    expect(inertial[2]).toBeCloseTo(0, 6);
    expect(end.position[0]).toBeCloseTo(250, 6);
    expect(end.position[1]).toBeCloseTo(0, 6);
    expect(end.position[2]).toBeCloseTo(-1000, 6);
  });
  it("conserves torque-free angular momentum and rotational energy with unequal inertias", () => {
    const start = { ...initialSixDofState(), rates: [0.7, 0.4, 0.3] as Vec3 };
    const p = { ...ballistic, gravity: 0 };
    const momentum = (s: SixDofState) =>
      matrixVector(
        quaternionMatrix(s.attitude),
        s.rates.map((v, i) => v * p.inertia[i]) as Vec3,
      );
    const energy = (s: SixDofState) =>
      s.rates.reduce((sum, v, i) => sum + 0.5 * p.inertia[i] * v ** 2, 0);
    const end = run(start, p, 5);
    momentum(end).forEach((v, i) =>
      expect(v).toBeCloseTo(momentum(start)[i], 5),
    );
    expect(energy(end)).toBeCloseTo(energy(start), 6);
    expect(Math.hypot(...end.attitude)).toBeCloseTo(1, 13);
  });
  it("matches scalar-first quaternion kinematics for constant roll", () => {
    const start = { ...initialSixDofState(), rates: [0.2, 0, 0] as Vec3 };
    const end = run(start, { ...ballistic, gravity: 0 }, 3);
    expect(end.attitude[0]).toBeCloseTo(Math.cos(0.3), 10);
    expect(end.attitude[1]).toBeCloseTo(Math.sin(0.3), 10);
    expect(quaternionEuler(end.attitude).roll).toBeCloseTo(0.6, 10);
  });
});
describe("hypothetical attached-flow forces and trim", () => {
  it("maintains the default exact zero-alpha trim rather than imposing attitude after a step", () => {
    const start = initialSixDofState();
    const derivative = sixDofDerivative(start, sixDofDefaults, sixDofControls);
    derivative.slice(3).forEach((v) => expect(v).toBeCloseTo(0, 10));
    const end = run(start, sixDofDefaults, 10, sixDofControls);
    expect(end.position[0]).toBeCloseTo(500, 8);
    expect(end.position[2]).toBeCloseTo(-1000, 8);
    expect(end.velocity[0]).toBeCloseTo(50, 8);
    expect(Math.hypot(...end.rates)).toBeLessThan(1e-10);
    expect(sixDofLoads(start, sixDofDefaults, sixDofControls).lift).toBeCloseTo(
      sixDofDefaults.mass * G,
      9,
    );
  });
  it("uses physical elevator-positive trailing-edge-down and positive right-roll/right-yaw commands", () => {
    for (const [key, index] of [
      ["elevator", 1],
      ["aileron", 0],
      ["rudder", 2],
    ] as const) {
      const end = stepSixDof(initialSixDofState(), sixDofDefaults, {
        ...sixDofControls,
        [key]: 2 * DEG,
      });
      if (key === "elevator") {
        expect(end.rates[index]).toBeLessThan(0);
        expect(end.attitude[index + 1]).toBeLessThan(0);
      } else {
        expect(end.rates[index]).toBeGreaterThan(0);
        expect(end.attitude[index + 1]).toBeGreaterThan(0);
      }
    }
  });
  it("transforms lift perpendicular to air velocity and drag opposite it, also at sideslip", () => {
    const s = { ...initialSixDofState(), velocity: [49, 2, 3] as Vec3 };
    const a = sixDofLoads(s, sixDofDefaults, noControls);
    const power = a.force.reduce((sum, v, i) => sum + v * s.velocity[i], 0);
    expect(power).toBeCloseTo(-a.drag * a.speed, 7);
    expect(a.force[2]).toBeLessThan(0);
  });
  it("uses air-relative velocity and flags near-zero speed/unsupported stall without NaN", () => {
    const s = { ...initialSixDofState(), velocity: [60, 0, 0] as Vec3 };
    const windy = sixDofLoads(
      s,
      { ...sixDofDefaults, wind: [10, 0, 0] },
      sixDofControls,
    );
    expect(windy.speed).toBe(50);
    expect(windy.lift).toBeCloseTo(
      sixDofLoads(initialSixDofState(), sixDofDefaults, sixDofControls).lift,
      10,
    );
    const stopped = { ...initialSixDofState(), velocity: [0, 0, 0] as Vec3 };
    expect(sixDofLoads(stopped, sixDofDefaults, noControls).applicable).toBe(
      false,
    );
    expect(() => stepSixDof(stopped, sixDofDefaults, noControls)).toThrow(
      /空速/,
    );
    const stalled = { ...initialSixDofState(), velocity: [50, 0, 14] as Vec3 };
    expect(sixDofLoads(stalled, sixDofDefaults, noControls).applicable).toBe(
      false,
    );
    expect(() => stepSixDof(stalled, sixDofDefaults, noControls)).toThrow(
      /失速/,
    );
    expect(() => normalizeQuaternion([0, 0, 0, 0])).toThrow(RangeError);
  });
});
