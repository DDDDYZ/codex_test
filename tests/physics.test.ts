import { describe, it, expect } from "vitest";
import {
  aerodynamics,
  defaults,
  G,
  liftCoefficient,
  stepMotion,
  initialMotion,
  bodyToNed,
  rk4,
} from "../src/physics/models";
describe("aerodynamics benchmarks", () => {
  it("matches hand-calculated lift and V² scaling", () => {
    const a = aerodynamics(defaults);
    expect(a.q).toBeCloseTo(1531.25);
    expect(a.cl).toBeCloseTo(0.6);
    expect(a.lift).toBeCloseTo(14700);
    expect(aerodynamics({ ...defaults, speed: 100 }).lift / a.lift).toBeCloseTo(
      4,
    );
  });
  it("is continuous at stall and decays afterwards", () => {
    expect(liftCoefficient(15)).toBeCloseTo(1.4);
    expect(liftCoefficient(15.000001)).toBeCloseTo(1.4, 5);
    expect(liftCoefficient(25)).toBeLessThan(liftCoefficient(15));
  });
  it("supports exact four-force equilibrium", () => {
    const a = aerodynamics(defaults);
    const b = aerodynamics({ ...defaults, mass: a.lift / G, thrust: a.drag });
    expect(b.ax).toBeCloseTo(0);
    expect(b.az).toBeCloseTo(0);
  });
  it("rejects nonphysical and nonfinite inputs", () => {
    expect(() => aerodynamics({ ...defaults, mass: 0 })).toThrow();
    expect(() => aerodynamics({ ...defaults, speed: NaN })).toThrow();
  });
});
describe("numerical integration", () => {
  it("matches constant acceleration analytic trajectory after 2 seconds", () => {
    let s = initialMotion;
    for (let i = 0; i < 100; i++) s = stepMotion(s, defaults);
    const a = aerodynamics(defaults);
    expect(s.x).toBeCloseTo(0.5 * a.ax * 4, 9);
    expect(s.z).toBeCloseTo(0.5 * a.az * 4, 9);
    expect(s.vz).toBeCloseTo(a.az * 2, 9);
  });
  it("RK4 converges for y prime = y", () => {
    let y = [1];
    for (let i = 0; i < 100; i++) y = rk4(y, 0.01, (x) => x);
    expect(y[0]).toBeCloseTo(Math.E, 7);
  });
  it("rejects invalid step", () =>
    expect(() => rk4([0], 0, (y) => y)).toThrow());
});
describe("body-to-NED attitude", () => {
  it("is identity at zero attitude", () =>
    expect(bodyToNed(0, 0, 0)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [-0, 0, 1],
    ]));
  it("positive pitch points nose upward", () =>
    expect(bodyToNed(0, 30, 0)[2][0]).toBeCloseTo(-0.5));
  it("positive yaw points forward axis east", () =>
    expect(bodyToNed(0, 0, 90)[1][0]).toBeCloseTo(1));
  it("is orthonormal for combined angles", () => {
    const m = bodyToNed(20, 30, 40);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        expect(m[i].reduce((s, v, k) => s + v * m[j][k], 0)).toBeCloseTo(
          i === j ? 1 : 0,
          12,
        );
  });
});
