import { describe, expect, it } from "vitest";
import { DEG, G } from "../src/physics/models";
import {
  climbFlight,
  coordinatedTurn,
  dragPolar,
  dynamicPressure,
  glideFlight,
  levelFlight,
  MAX_FLIGHT_PATH_DEGREES,
  optimalLiftDrag,
  performanceBounds,
  performanceCurves,
  performanceDefaults,
  validatePerformance,
} from "../src/physics/performance";

const p = performanceDefaults;

describe("steady performance inputs and level-flight benchmarks", () => {
  it("matches hand-calculated dynamic pressure and required level-flight CL", () => {
    const result = levelFlight(p);
    expect(result.valid).toBe(true);
    expect(dynamicPressure(p)).toBeCloseTo(1531.25, 10);
    expect(result.weight).toBeCloseTo(9806.65, 10);
    expect(result.cl).toBeCloseTo(0.40027142857142855, 10);
    expect(result.lift).toBeCloseTo(result.weight, 10);
    expect(result.drag).toBeCloseTo(828.392699275, 8);
    expect(result.powerRequired).toBeCloseTo(41419.63496375, 6);
  });

  it("requires less CL at greater speed while parasite and induced drag trade places", () => {
    const a = levelFlight(p);
    const b = levelFlight({ ...p, speed: p.speed * 2 });
    expect(b.q / a.q).toBeCloseTo(4, 10);
    expect(b.cl / a.cl).toBeCloseTo(0.25, 10);
    const points = performanceCurves(p);
    const first = points[0];
    const last = points.at(-1)!;
    expect(last.parasiteDrag / first.parasiteDrag).toBeCloseTo(64, 10);
    expect(last.inducedDrag / first.inducedDrag).toBeCloseTo(1 / 64, 10);
    for (const point of points) {
      expect(point.parasiteDrag + point.inducedDrag).toBeCloseTo(point.drag, 8);
      expect(point.valid).toBe(!point.stall);
    }
  });

  it("separates lift feasibility from available thrust equilibrium", () => {
    const level = levelFlight(p);
    expect(level.equilibrium).toBe(false);
    const balanced = levelFlight({ ...p, thrust: level.requiredThrust });
    expect(balanced.equilibrium).toBe(true);
    expect(balanced.excessPower).toBeCloseTo(0, 9);
    const stalled = levelFlight({ ...p, speed: 15 });
    expect(stalled.status).toBe("stall");
    expect(stalled.valid).toBe(false);
    expect(stalled.cl).toBeGreaterThan(p.clMax);
  });

  it("rejects missing, nonfinite and unsupported physical inputs", () => {
    for (const invalid of [
      { ...p, speed: 0 },
      { ...p, density: NaN },
      { ...p, mass: Infinity },
      { ...p, cd0: -1 },
      { ...p, bank: 90 },
      { ...p, k: undefined } as unknown as typeof p,
    ]) {
      expect(() => validatePerformance(invalid)).toThrow(RangeError);
    }
    expect(() => dragPolar(1, 0.025, -0.1)).toThrow(RangeError);
    expect(() => dragPolar(NaN, 0.025, 0.055)).toThrow(RangeError);
    for (const key of Object.keys(performanceBounds) as (keyof typeof p)[]) {
      expect(p[key]).toBeGreaterThanOrEqual(performanceBounds[key][0]);
      expect(p[key]).toBeLessThanOrEqual(performanceBounds[key][1]);
    }
  });
});

describe("analytic polar optimum", () => {
  it("matches CL=sqrt(CD0/k), with equal parasite and induced drag and minimum level drag", () => {
    const opt = optimalLiftDrag(p);
    expect(opt.cl).toBeCloseTo(0.674199862463242, 10);
    expect(opt.liftDrag).toBeCloseTo(13.48399724926484, 10);
    expect(opt.cd).toBeCloseTo(0.05, 10);
    const atOpt = levelFlight({ ...p, speed: opt.speed });
    expect(atOpt.drag).toBeCloseTo(2 * p.mass * G * Math.sqrt(p.cd0 * p.k), 9);
    expect(atOpt.q * p.area * p.cd0).toBeCloseTo(atOpt.drag / 2, 9);
    expect(levelFlight({ ...p, speed: opt.speed * 0.9 }).drag).toBeGreaterThan(atOpt.drag);
    expect(levelFlight({ ...p, speed: opt.speed * 1.1 }).drag).toBeGreaterThan(atOpt.drag);
  });

  it("identifies an unattainable unconstrained optimum rather than hiding CLmax", () => {
    const opt = optimalLiftDrag({ ...p, cd0: 0.08, k: 0.025, clMax: 0.8 });
    expect(opt.attainable).toBe(false);
    expect(opt.cl).toBeGreaterThan(0.8);
    expect(opt.constrainedCl).toBe(0.8);
    expect(opt.constrainedLiftDrag).toBeLessThan(opt.ldMax);
    expect(levelFlight({ ...p, cd0: 0.08, k: 0.025, clMax: 0.8, speed: opt.constrainedSpeed }).valid).toBe(true);
  });

  it("does not label an optimum outside the supported speed range attainable", () => {
    const opt = optimalLiftDrag({ ...p, mass: 2000, density: 0.3, area: 5, cd0: 0.015, k: 0.12, clMax: 2 });
    expect(opt.withinLiftEnvelope).toBe(true);
    expect(opt.withinSpeedRange).toBe(false);
    expect(opt.glideWithinSpeedRange).toBe(false);
    expect(opt.speed).toBeGreaterThan(performanceBounds.speed[1]);
    expect(opt.attainable).toBe(false);
  });
});

describe("exact steady climb and glide", () => {
  it("recovers a prescribed 5 degree climb from independently balanced forces", () => {
    const gamma = 5 * DEG;
    const weight = p.mass * G;
    const qS = 0.5 * p.density * p.speed ** 2 * p.area;
    const lift = weight * Math.cos(gamma);
    const drag = qS * p.cd0 + p.k * lift ** 2 / qS;
    const thrust = drag + weight * Math.sin(gamma);
    const result = climbFlight({ ...p, thrust });
    expect(result.valid).toBe(true);
    expect(result.gamma).toBeCloseTo(5, 10);
    expect(result.lift!).toBeCloseTo(lift, 8);
    expect(result.drag!).toBeCloseTo(drag, 8);
    expect(result.verticalSpeed!).toBeCloseTo(p.speed * Math.sin(gamma), 10);
    expect(result.forceResidual!).toBeCloseTo(0, 8);
  });

  it("is continuous at zero excess thrust and has positive default climb rate", () => {
    const level = levelFlight(p);
    const atLevel = climbFlight({ ...p, thrust: level.requiredThrust });
    expect(atLevel.valid).toBe(true);
    expect(atLevel.gamma!).toBeCloseTo(0, 10);
    expect(atLevel.verticalSpeed!).toBeCloseTo(0, 10);
    const nearLevel = climbFlight({ ...p, thrust: level.requiredThrust + 1e-7 });
    expect(nearLevel.verticalSpeed!).toBeGreaterThan(0);
    expect(nearLevel.forceResidual!).toBeCloseTo(0, 8);
    const climbing = climbFlight(p);
    expect(climbing.verticalSpeed!).toBeGreaterThan(2);
    expect(climbing.gamma!).toBeLessThan(MAX_FLIGHT_PATH_DEGREES);
  });

  it("solves unpowered force balance exactly and does not use available engine thrust", () => {
    const glide = glideFlight(p);
    expect(glide.valid).toBe(true);
    expect(glide.thrust).toBe(0);
    expect(glide.gamma!).toBeLessThan(0);
    expect(glide.verticalSpeed!).toBeLessThan(0);
    expect(glide.lift!).toBeCloseTo(glide.weight * Math.cos(glide.gammaRad!), 9);
    expect(glide.drag!).toBeCloseTo(-glide.weight * Math.sin(glide.gammaRad!), 9);
    expect(glide.glideRatio!).toBeCloseTo(glide.cl! / glide.cd!, 9);
    expect(glide.horizontalSpeed! / -glide.verticalSpeed!).toBeCloseTo(glide.glideRatio!, 9);
    expect(glideFlight({ ...p, thrust: 8000 })).toEqual(glide);
    const noThrustClimb = climbFlight({ ...p, thrust: 0 });
    expect(noThrustClimb.gamma!).toBeCloseTo(glide.gamma!, 10);
  });

  it("achieves analytic best glide L/D when exact glide speed includes cos(gamma)", () => {
    const opt = optimalLiftDrag(p);
    const glide = glideFlight({ ...p, speed: opt.glideSpeed });
    expect(glide.valid).toBe(true);
    expect(glide.cl!).toBeCloseTo(opt.cl, 10);
    expect(glide.glideRatio!).toBeCloseTo(opt.liftDrag, 10);
    expect(glide.gammaRad!).toBeCloseTo(-Math.atan(1 / opt.liftDrag), 10);
    for (const speed of [opt.glideSpeed * 0.9, opt.glideSpeed * 1.1]) {
      expect(glideFlight({ ...p, speed }).glideRatio!).toBeLessThan(glide.glideRatio!);
    }
  });

  it("marks CLmax violations and out-of-model angles without fabricating a flight path", () => {
    for (const result of [climbFlight({ ...p, speed: 15 }), glideFlight({ ...p, speed: 15 })]) {
      expect(result.status).toBe("stall");
      expect(result.valid).toBe(false);
      expect(result.gamma).toBeNull();
      expect(result.verticalSpeed).toBeNull();
      expect(result.cl).toBeNull();
      expect(result.requiredCl!).toBeGreaterThan(p.clMax);
    }
    const outside = climbFlight({ ...p, thrust: 8000 });
    expect(outside.status).toBe("outside-model");
    expect(outside.gamma).toBeNull();
    expect(outside.drag).toBeNull();
    const steepGlide = glideFlight({ ...p, speed: 120, mass: 400, area: 30, cd0: 0.08 });
    expect(steepGlide.status).toBe("outside-model");
    expect(steepGlide.glideRatio).toBeNull();
  });

  it("allows the reduced normal lift below level stall speed only when the exact path is feasible", () => {
    const speed = levelFlight(p).stallSpeed * 0.98;
    const atSpeed = { ...p, speed };
    expect(levelFlight(atSpeed).valid).toBe(false);
    const weight = p.mass * G;
    const qS = 0.5 * p.density * speed ** 2 * p.area;
    const gamma = 18 * DEG;
    const lift = weight * Math.cos(gamma);
    const drag = qS * p.cd0 + p.k * lift ** 2 / qS;
    const result = climbFlight({ ...atSpeed, thrust: drag + weight * Math.sin(gamma) });
    expect(result.valid).toBe(true);
    expect(result.gamma!).toBeCloseTo(18, 10);
    expect(result.cl!).toBeLessThan(p.clMax);
    const glide = glideFlight(atSpeed);
    expect(glide.status).toBe("stall");
    expect(glide.requiredCl!).toBeGreaterThan(p.clMax);
    expect(glide.verticalSpeed).toBeNull();
  });

  it("includes the stated 20 degree boundary and rejects a steeper required path", () => {
    const weight = p.mass * G;
    const qS = 0.5 * p.density * p.speed ** 2 * p.area;
    const requiredThrust = (angle: number) => {
      const gamma = angle * DEG;
      const lift = weight * Math.cos(gamma);
      return qS * p.cd0 + p.k * lift ** 2 / qS + weight * Math.sin(gamma);
    };
    const edge = climbFlight({ ...p, thrust: requiredThrust(MAX_FLIGHT_PATH_DEGREES) });
    expect(edge.valid).toBe(true);
    expect(edge.gamma!).toBeCloseTo(MAX_FLIGHT_PATH_DEGREES, 10);
    const outside = climbFlight({ ...p, thrust: requiredThrust(MAX_FLIGHT_PATH_DEGREES + 0.01) });
    expect(outside.status).toBe("outside-model");
    expect(outside.gamma).toBeNull();
  });
});

describe("coordinated level turns", () => {
  it("at 60 degrees doubles load factor and multiplies stall speed by sqrt(2)", () => {
    const level = levelFlight(p);
    const turn = coordinatedTurn({ ...p, bank: 60 });
    expect(turn.valid).toBe(true);
    expect(turn.loadFactor).toBeCloseTo(2, 10);
    expect(turn.cl / level.cl).toBeCloseTo(2, 10);
    expect(turn.stallSpeed / level.stallSpeed).toBeCloseTo(Math.SQRT2, 10);
    expect(turn.lift * Math.cos(60 * DEG)).toBeCloseTo(turn.weight, 9);
    expect(turn.lift * Math.sin(60 * DEG)).toBeCloseTo(p.mass * p.speed ** 2 / turn.radius!, 8);
    expect(turn.turnRateRad).toBeCloseTo(p.speed / turn.radius!, 10);
  });

  it("handles straight flight and turn direction without infinity or NaN", () => {
    const straight = coordinatedTurn({ ...p, bank: 0 });
    expect(straight.radius).toBeNull();
    expect(straight.period).toBeNull();
    expect(straight.turnRate).toBe(0);
    expect(straight.loadFactor).toBe(1);
    expect(straight.drag).toBeCloseTo(levelFlight(p).drag, 10);
    const right = coordinatedTurn({ ...p, bank: 30 });
    const left = coordinatedTurn({ ...p, bank: -30 });
    expect(left.radius).toBeCloseTo(right.radius!, 10);
    expect(left.turnRate).toBeCloseTo(-right.turnRate, 10);
    expect(left.period).toBeCloseTo(right.period!, 10);
  });

  it("flags a turn that stalls even when the same speed allows level flight", () => {
    const speed = levelFlight(p).stallSpeed * 1.1;
    expect(levelFlight({ ...p, speed }).valid).toBe(true);
    const turn = coordinatedTurn({ ...p, speed, bank: 60 });
    expect(turn.valid).toBe(false);
    expect(turn.status).toBe("stall");
  });
});
