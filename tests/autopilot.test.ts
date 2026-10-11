import { describe, expect, it } from "vitest";
import { DEG } from "../src/physics/models";
import {
  autopilotCommand,
  autopilotDefaults,
  initialAutopilotState,
  stepAutopilot,
  type AutopilotParameters,
} from "../src/physics/autopilot";
function run(p: AutopilotParameters, seconds: number) {
  let s = { ...initialAutopilotState };
  for (let i = 0; i < seconds * 100; i++) s = stepAutopilot(s, p);
  return s;
}
describe("reduced planar speed and altitude cascade", () => {
  it("preserves an exact level equilibrium with both holds disabled", () => {
    const end = run(
      { ...autopilotDefaults, speedHold: false, heightHold: false },
      10,
    );
    expect(end.speed).toBeCloseTo(50, 9);
    expect(end.height).toBeCloseTo(1000, 9);
    expect(end.gamma).toBeCloseTo(0, 9);
  });
  it("has the correct lift and thrust signs and uses actual point-mass dynamics", () => {
    const s = { ...initialAutopilotState };
    const positive = stepAutopilot(s, {
      ...autopilotDefaults,
      speedHold: false,
      heightHold: false,
      manualCl: 0.6,
      manualThrust: 1500,
    });
    expect(positive.speed).toBeGreaterThan(s.speed);
    expect(positive.gamma).toBeGreaterThan(s.gamma);
    expect(positive.height).toBeGreaterThan(s.height);
  });
  it("tracks commanded speed/altitude without directly prescribing either state", () => {
    const end = run(autopilotDefaults, 120);
    expect(end.speed).toBeCloseTo(autopilotDefaults.speedTarget, 2);
    expect(Math.abs(end.height - autopilotDefaults.heightTarget)).toBeLessThan(
      0.25,
    );
  });
  it("rejects a persistent vertical wind through altitude integral action", () => {
    const end = run({ ...autopilotDefaults, windUp: 1.5 }, 180);
    expect(Math.abs(end.height - autopilotDefaults.heightTarget)).toBeLessThan(
      0.25,
    );
    expect(end.gamma).toBeLessThan(0);
    expect(end.speed).toBeCloseTo(autopilotDefaults.speedTarget, 2);
    expect(end.speed * Math.sin(end.gamma) + 1.5).toBeCloseTo(0, 2);
  });
  it("bounds commands and blocks further windup when demand exceeds available actuation", () => {
    const p = { ...autopilotDefaults, speedTarget: 80, heightTarget: 1200 };
    const cmd = autopilotCommand(initialAutopilotState, p);
    expect(cmd.thrustLimited).toBe(true);
    expect(cmd.climbLimited).toBe(true);
    expect(cmd.thrustCommand).toBe(3500);
    expect(cmd.climb).toBe(5);
    expect(cmd.speedIntegralDot).toBe(0);
    expect(cmd.heightIntegralDot).toBe(0);
    expect(() =>
      stepAutopilot(initialAutopilotState, { ...p, speedTarget: NaN }),
    ).toThrow(RangeError);
  });
  it("blocks height windup at the flight-path-angle limit before climb or lift caps engage", () => {
    const state = { ...initialAutopilotState, speed: 27, gamma: 10 * DEG };
    const command = autopilotCommand(state, {
      ...autopilotDefaults,
      heightTarget: 1040,
    });
    expect(command.climb).toBeCloseTo(4.8, 10);
    expect(command.liftLimited).toBe(false);
    expect(command.gammaLimited).toBe(true);
    expect(command.climbLimited).toBe(true);
    expect(command.heightIntegralDot).toBe(0);
  });
});
