/**
 * Steady-flight, subsonic performance of a hypothetical teaching aircraft.
 * SI units, except bank/gamma in degrees and turnRate in degrees/s for display.
 * Constant density, fixed CD = CD0 + k CL², thrust parallel to flight path.
 * No wind, compressibility, propulsion lapse or post-stall prediction.
 */
import { DEG, G } from "./models";

export interface PerformanceParameters {
  speed: number;
  density: number;
  area: number;
  mass: number;
  cd0: number;
  k: number;
  clMax: number;
  thrust: number;
  bank: number;
}

export const performanceDefaults: PerformanceParameters = {
  speed: 50,
  density: 1.225,
  area: 16,
  mass: 1000,
  cd0: 0.025,
  k: 0.055,
  clMax: 1.4,
  thrust: 1800,
  bank: 30,
};

export const performanceBounds: Record<keyof PerformanceParameters, [number, number]> = {
  speed: [15, 120],
  density: [0.3, 1.4],
  area: [5, 30],
  mass: [400, 2000],
  cd0: [0.015, 0.08],
  k: [0.025, 0.12],
  clMax: [0.8, 2],
  thrust: [0, 8000],
  bank: [-60, 60],
};

export function validatePerformance(p: PerformanceParameters): void {
  for (const key of Object.keys(performanceBounds) as (keyof PerformanceParameters)[]) {
    const [lo, hi] = performanceBounds[key];
    if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi) {
      throw new RangeError(`${key} 超出飞行性能教学模型范围 [${lo}, ${hi}]`);
    }
  }
}

export function dynamicPressure(p: PerformanceParameters): number {
  validatePerformance(p);
  return 0.5 * p.density * p.speed ** 2;
}

export function dragPolar(cl: number, cd0: number, k: number): number {
  if (![cl, cd0, k].every(Number.isFinite) || cd0 <= 0 || k <= 0) {
    throw new RangeError("阻力极线需要有限升力系数和正的 CD₀、k。");
  }
  return cd0 + k * cl ** 2;
}

export type PerformanceStatus = "valid" | "stall" | "outside-model" | "numerical-failure";
interface FlightStatus {
  status: PerformanceStatus;
  valid: boolean;
  message: string;
}

function flightStatus(status: PerformanceStatus, message: string): FlightStatus {
  return { status, valid: status === "valid", message };
}

function base(p: PerformanceParameters) {
  const q = dynamicPressure(p);
  const weight = p.mass * G;
  const stallSpeed = Math.sqrt((2 * weight) / (p.density * p.area * p.clMax));
  return { speed: p.speed, q, weight, stallSpeed };
}

/** Analytic polar optimum; constrained* gives the reachable optimum at CL <= CLmax. */
export function optimalLiftDrag(p: PerformanceParameters) {
  const { weight } = base(p);
  const cl = Math.sqrt(p.cd0 / p.k);
  const cd = dragPolar(cl, p.cd0, p.k);
  const liftDrag = cl / cd;
  const speed = Math.sqrt((2 * weight) / (p.density * p.area * cl));
  const gamma = -Math.atan(cd / cl);
  const glideSpeed = speed * Math.sqrt(Math.cos(gamma));
  const constrainedCl = Math.min(cl, p.clMax);
  const constrainedCd = dragPolar(constrainedCl, p.cd0, p.k);
  const constrainedLiftDrag = constrainedCl / constrainedCd;
  const constrainedSpeed = Math.sqrt((2 * weight) / (p.density * p.area * constrainedCl));
  const [minSpeed, maxSpeed] = performanceBounds.speed;
  const withinLiftEnvelope = cl <= p.clMax;
  const withinSpeedRange = speed >= minSpeed && speed <= maxSpeed;
  const glideWithinSpeedRange = glideSpeed >= minSpeed && glideSpeed <= maxSpeed;
  return {
    cl, cd, liftDrag, ldMax: liftDrag, speed, glideSpeed,
    constrainedCl, constrainedLiftDrag, constrainedSpeed,
    withinLiftEnvelope, withinSpeedRange, glideWithinSpeedRange,
    attainable: withinLiftEnvelope && withinSpeedRange,
  };
}

/** Required forces for steady level flight; available thrust need not equal required thrust. */
export function levelFlight(p: PerformanceParameters) {
  const b = base(p);
  const cl = b.weight / (b.q * p.area);
  const cd = dragPolar(cl, p.cd0, p.k);
  const drag = b.q * p.area * cd;
  const excessThrust = p.thrust - drag;
  const stalled = cl > p.clMax + 1e-12;
  return {
    ...b,
    ...flightStatus(stalled ? "stall" : "valid", stalled
      ? "所需 CL 超过 CLmax：该速度无法维持稳态平飞；以下阻力是极线外推参考值。"
      : "升力可平衡重量；仅当可用推力等于所需推力时，速度也保持不变。"),
    cl, cd, lift: b.weight, drag,
    liftDrag: cl / cd,
    requiredThrust: drag,
    powerRequired: drag * p.speed,
    excessThrust,
    excessPower: excessThrust * p.speed,
    equilibrium: !stalled && Math.abs(excessThrust) <= 1e-6 * Math.max(b.weight, 1),
  };
}

export const MAX_FLIGHT_PATH_DEGREES = 20;

export interface SteadyPathFlight extends FlightStatus {
  speed: number;
  q: number;
  weight: number;
  stallSpeed: number;
  thrust: number;
  /** All solution fields are null when a physically valid solution is unavailable. */
  gamma: number | null;
  gammaRad: number | null;
  verticalSpeed: number | null;
  horizontalSpeed: number | null;
  cl: number | null;
  cd: number | null;
  lift: number | null;
  drag: number | null;
  forceResidual: number | null;
  requiredCl: number | null;
}

function emptyPath(p: PerformanceParameters, thrust: number, status: PerformanceStatus, message: string, requiredCl: number | null = null): SteadyPathFlight {
  return {
    ...base(p), ...flightStatus(status, message), thrust,
    gamma: null, gammaRad: null, verticalSpeed: null, horizontalSpeed: null,
    cl: null, cd: null, lift: null, drag: null, forceResidual: null, requiredCl,
  };
}

function pathAtSine(p: PerformanceParameters, thrust: number, sine: number): SteadyPathFlight {
  const b = base(p);
  if (!Number.isFinite(sine)) {
    return emptyPath(p, thrust, "numerical-failure", "求解产生了非有限数值；此结果不可用于物理解读。");
  }
  if (Math.abs(sine) > Math.sin(MAX_FLIGHT_PATH_DEGREES * DEG) + 1e-12) {
    return emptyPath(p, thrust, "outside-model", `稳态航迹角超出 ±${MAX_FLIGHT_PATH_DEGREES}° 的教学模型范围。`);
  }
  const gammaRad = Math.asin(sine);
  const lift = b.weight * Math.cos(gammaRad);
  const cl = lift / (b.q * p.area);
  if (cl > p.clMax + 1e-12) {
    return emptyPath(p, thrust, "stall", "所需 CL 超过 CLmax，无法得到有效的稳态航迹；模型不预测失速后的运动。", cl);
  }
  const cd = dragPolar(cl, p.cd0, p.k);
  const drag = b.q * p.area * cd;
  const forceResidual = thrust - drag - b.weight * sine;
  if (!Number.isFinite(forceResidual) || Math.abs(forceResidual) > 1e-8 * b.weight) {
    return emptyPath(p, thrust, "numerical-failure", "稳态求解未满足沿航迹的力平衡，请调整参数或重置。");
  }
  return {
    ...b,
    stallSpeed: Math.sqrt((2 * lift) / (p.density * p.area * p.clMax)),
    ...flightStatus("valid", sine > 1e-10 ? "存在有效稳态爬升解。" : sine < -1e-10 ? "存在有效稳态下降解。" : "存在有效稳态平飞解。"),
    thrust, gamma: gammaRad / DEG, gammaRad,
    verticalSpeed: p.speed * sine,
    horizontalSpeed: p.speed * Math.cos(gammaRad),
    cl, cd, lift, drag, forceResidual, requiredCl: cl,
  };
}

function pathEnvelope(p: PerformanceParameters, thrust: number): SteadyPathFlight | null {
  const b = base(p);
  const minRequiredCl = b.weight * Math.cos(MAX_FLIGHT_PATH_DEGREES * DEG) / (b.q * p.area);
  return minRequiredCl > p.clMax + 1e-12
    ? emptyPath(p, thrust, "stall", `在 ±${MAX_FLIGHT_PATH_DEGREES}° 航迹范围内所需 CL 均超过 CLmax，无法维持稳态飞行。`, minRequiredCl)
    : null;
}

/**
 * Exact steady force balance for the fixed polar, not the small-angle ROC approximation.
 * Put s = sin(gamma), A = k W²/(qS), B = qS CD0. Then A s² - W s + T - A - B = 0.
 * Choose the lower-angle branch continuously connected to level flight.
 */
export function climbFlight(p: PerformanceParameters): SteadyPathFlight {
  const b = base(p);
  const envelope = pathEnvelope(p, p.thrust);
  if (envelope) return envelope;
  const a = p.k * b.weight ** 2 / (b.q * p.area);
  const c = p.thrust - a - b.q * p.area * p.cd0;
  const discriminant = b.weight ** 2 - 4 * a * c;
  if (discriminant < 0) {
    return emptyPath(p, p.thrust, "outside-model", "该推力和速度下不存在本模型的稳态力平衡解。");
  }
  // Rationalized root avoids cancellation around the level-flight solution c = 0.
  const sine = (2 * c) / (b.weight + Math.sqrt(discriminant));
  return pathAtSine(p, p.thrust, sine);
}

/** Exact unpowered steady glide. Parameter thrust is intentionally ignored. */
export function glideFlight(p: PerformanceParameters): SteadyPathFlight & { glideRatio: number | null } {
  const b = base(p);
  const envelope = pathEnvelope(p, 0);
  if (envelope) return { ...envelope, glideRatio: null };
  const a = p.k * b.weight ** 2 / (b.q * p.area);
  const total = a + b.q * p.area * p.cd0;
  const sine = (-2 * total) / (b.weight + Math.sqrt(b.weight ** 2 + 4 * a * total));
  const result = pathAtSine(p, 0, sine);
  return {
    ...result,
    message: result.valid ? "无动力稳态滑翔；下沉是重量沿航迹分量平衡阻力的结果。" : result.message,
    glideRatio: result.valid && result.gammaRad !== null ? 1 / Math.tan(-result.gammaRad) : null,
  };
}

/** Still-air, steady coordinated level turn. Positive bank/rate is a right turn. */
export function coordinatedTurn(p: PerformanceParameters) {
  const b = base(p);
  const bankRad = p.bank * DEG;
  const loadFactor = 1 / Math.cos(bankRad);
  const lift = loadFactor * b.weight;
  const cl = lift / (b.q * p.area);
  const cd = dragPolar(cl, p.cd0, p.k);
  const drag = b.q * p.area * cd;
  const turnRateRad = (G * Math.tan(bankRad)) / p.speed;
  const straight = Math.abs(bankRad) < 1e-12;
  const stalled = cl > p.clMax + 1e-12;
  return {
    ...b,
    stallSpeed: b.stallSpeed * Math.sqrt(loadFactor),
    ...flightStatus(stalled ? "stall" : "valid", stalled
      ? "转弯所需 CL 超过 CLmax：无法保持该定常水平转弯；半径和角速度仅表示指令几何。"
      : "升力的垂直分量平衡重量，水平分量提供向心力；需匹配所需推力。"),
    cl, cd, lift, drag, loadFactor,
    radius: straight ? null : p.speed ** 2 / (G * Math.abs(Math.tan(bankRad))),
    turnRate: turnRateRad / DEG,
    turnRateRad,
    period: straight ? null : 2 * Math.PI / Math.abs(turnRateRad),
    requiredThrust: drag,
    powerRequired: drag * p.speed,
  };
}

/** Uniform speed sweep within supported inputs. A stalled point is explicitly flagged. */
export function performanceCurves(p: PerformanceParameters) {
  validatePerformance(p);
  const [minSpeed, maxSpeed] = performanceBounds.speed;
  return Array.from({ length: 85 }, (_, i) => {
    const speed = minSpeed + (maxSpeed - minSpeed) * i / 84;
    const atSpeed = { ...p, speed };
    const level = levelFlight(atSpeed);
    const parasiteDrag = level.q * p.area * p.cd0;
    const inducedDrag = level.q * p.area * p.k * level.cl ** 2;
    return {
      speed, cl: level.cl, drag: level.drag, parasiteDrag, inducedDrag,
      powerRequired: level.powerRequired,
      thrustAvailable: p.thrust,
      excessPower: level.excessPower,
      stall: level.status === "stall", valid: level.valid,
    };
  });
}
