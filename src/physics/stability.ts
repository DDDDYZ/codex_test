/**
 * Linear, stick-fixed longitudinal statics of a hypothetical teaching aircraft.
 * Forces use SI units and every model angle uses radians. Positions h = x/c are
 * measured aft from the leading edge of the mean aerodynamic chord (MAC).
 * Positive Cm pitches the nose up; positive elevator is trailing-edge down.
 * No fuselage, propulsion moment, compressibility, stall or dynamic response.
 */
import { DEG, G } from "./models";

export interface StabilityParameters {
  speed: number;
  density: number;
  mass: number;
  area: number;
  chord: number;
  cg: number;
  wingAc: number;
  tailArea: number;
  /** Wing aerodynamic center to tail aerodynamic center, in meters. */
  tailArm: number;
  wingLiftSlope: number;
  tailLiftSlope: number;
  tailEfficiency: number;
  downwashGradient: number;
  elevatorEffectiveness: number;
  wingZeroLift: number;
  wingAcMoment: number;
  clMax: number;
  elevatorLimit: number;
}

export const DEFAULT_STABILITY_PARAMETERS: StabilityParameters = {
  speed: 50,
  density: 1.225,
  mass: 1000,
  area: 16,
  chord: 1.5,
  cg: 0.3,
  wingAc: 0.25,
  tailArea: 3.2,
  tailArm: 4,
  wingLiftSlope: 5.2,
  tailLiftSlope: 4,
  tailEfficiency: 0.9,
  downwashGradient: 0.35,
  elevatorEffectiveness: 0.45,
  wingZeroLift: 0.22,
  wingAcMoment: -0.04,
  clMax: 1.4,
  elevatorLimit: 20 * DEG,
};

export const STABILITY_ALPHA_MIN = -8 * DEG;
export const STABILITY_ALPHA_MAX = 15 * DEG;

export const stabilityBounds: Record<
  keyof StabilityParameters,
  readonly [number, number]
> = {
  speed: [15, 100],
  density: [0.3, 1.4],
  mass: [400, 2000],
  area: [5, 30],
  chord: [0.5, 3],
  cg: [0.05, 0.8],
  wingAc: [0.2, 0.3],
  tailArea: [0, 8],
  tailArm: [1, 8],
  wingLiftSlope: [2, 8],
  tailLiftSlope: [1, 6],
  tailEfficiency: [0.3, 1],
  downwashGradient: [0, 0.9],
  elevatorEffectiveness: [0, 1],
  wingZeroLift: [0, 0.5],
  wingAcMoment: [-0.15, 0.05],
  clMax: [0.8, 2],
  elevatorLimit: [DEG, 30 * DEG],
};

export function validateStabilityParameters(p: StabilityParameters): void {
  for (const key of Object.keys(
    stabilityBounds,
  ) as (keyof StabilityParameters)[]) {
    const [min, max] = stabilityBounds[key];
    if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) {
      throw new RangeError(`${key} must be finite and within [${min}, ${max}]`);
    }
  }
}

export function tailVolumeCoefficient(p: StabilityParameters): number {
  validateStabilityParameters(p);
  return (p.tailArea * p.tailArm) / (p.area * p.chord);
}

export type StaticStability = "stable" | "neutral" | "unstable";
export function stabilityDerivatives(p: StabilityParameters) {
  validateStabilityParameters(p);
  // bt is the tail's contribution to dCL/dα, referenced to wing area.
  // Its zero-α lift is assumed zero (fixed incidence chosen accordingly).
  const tailSlope =
    ((p.tailEfficiency * p.tailLiftSlope * p.tailArea) / p.area) *
    (1 - p.downwashGradient);
  const clAlpha = p.wingLiftSlope + tailSlope;
  const tailAc = p.wingAc + p.tailArm / p.chord;
  const neutralPoint = p.wingAc + ((tailSlope / clAlpha) * p.tailArm) / p.chord;
  const staticMargin = neutralPoint - p.cg;
  const cmAlpha = -clAlpha * staticMargin;
  const clElevator =
    (p.tailEfficiency *
      p.tailLiftSlope *
      p.elevatorEffectiveness *
      p.tailArea) /
    p.area;
  const cmElevator = -clElevator * (tailAc - p.cg);
  // A change of moment reference to CG also shifts the constant wing moment.
  const cmZero = p.wingAcMoment + p.wingZeroLift * (p.cg - p.wingAc);
  const stability: StaticStability =
    Math.abs(cmAlpha) <= 1e-10
      ? "neutral"
      : cmAlpha < 0
        ? "stable"
        : "unstable";
  return {
    clAlpha,
    clZero: p.wingZeroLift,
    clElevator,
    cmZero,
    cmAlpha,
    cmElevator,
    tailAc,
    neutralPoint,
    staticMargin,
    tailSlope,
    tailVolume: tailVolumeCoefficient(p),
    stability,
  };
}

export function pitchingMoment(
  p: StabilityParameters,
  alpha: number,
  elevator = 0,
): number {
  if (![alpha, elevator].every(Number.isFinite))
    throw new RangeError("Angles must be finite radians");
  const d = stabilityDerivatives(p);
  return d.cmZero + d.cmAlpha * alpha + d.cmElevator * elevator;
}

export function liftCoefficient(
  p: StabilityParameters,
  alpha: number,
  elevator = 0,
): number {
  if (![alpha, elevator].every(Number.isFinite))
    throw new RangeError("Angles must be finite radians");
  const d = stabilityDerivatives(p);
  return d.clZero + d.clAlpha * alpha + d.clElevator * elevator;
}

export type TrimStatus =
  "valid" | "singular" | "stall" | "control-limit" | "outside-model";
export interface TrimResult {
  valid: boolean;
  status: TrimStatus;
  message: string;
  q: number;
  weight: number;
  requiredCl: number;
  /** Feasible angles only. An inadmissible algebraic solution is not a trim. */
  alpha: number | null;
  elevator: number | null;
  candidateAlpha: number | null;
  candidateElevator: number | null;
  liftResidual: number | null;
  momentResidual: number | null;
  determinant: number;
}

/** Solve lift equilibrium and pitching moment together; neutral ≠ singular. */
export function solveTrim(p: StabilityParameters): TrimResult {
  const d = stabilityDerivatives(p);
  const q = 0.5 * p.density * p.speed ** 2;
  const weight = p.mass * G;
  const requiredCl = weight / (q * p.area);
  const determinant = d.clAlpha * d.cmElevator - d.clElevator * d.cmAlpha;
  const base = { q, weight, requiredCl, determinant };
  const failure = (
    status: TrimStatus,
    message: string,
    candidateAlpha: number | null = null,
    candidateElevator: number | null = null,
  ): TrimResult => ({
    ...base,
    valid: false,
    status,
    message,
    alpha: null,
    elevator: null,
    candidateAlpha,
    candidateElevator,
    liftResidual: null,
    momentResidual: null,
  });
  if (requiredCl > p.clMax + 1e-10)
    return failure(
      "stall",
      "所需 CL 超过 CL,max，附着流配平不可行。模型不预测失速后的运动。",
    );
  const determinantScale = Math.max(
    1,
    Math.abs(d.clAlpha * d.cmElevator),
    Math.abs(d.clElevator * d.cmAlpha),
  );
  if (Math.abs(determinant) <= 1e-12 * determinantScale)
    return failure(
      "singular",
      "升力与力矩方程失去独立操纵能力，不能求得唯一配平解。",
    );
  const liftRhs = requiredCl - d.clZero;
  const momentRhs = -d.cmZero;
  const alpha =
    (liftRhs * d.cmElevator - d.clElevator * momentRhs) / determinant;
  const elevator = (d.clAlpha * momentRhs - d.cmAlpha * liftRhs) / determinant;
  if (![alpha, elevator].every(Number.isFinite))
    return failure("singular", "数值求解未得到有限角度。");
  if (Math.abs(elevator) > p.elevatorLimit + 1e-10)
    return failure(
      "control-limit",
      "理论所需升降舵偏角超过操纵范围，不能在当前空速配平。",
      alpha,
      elevator,
    );
  if (
    alpha < STABILITY_ALPHA_MIN - 1e-10 ||
    alpha > STABILITY_ALPHA_MAX + 1e-10
  )
    return failure(
      "outside-model",
      "理论迎角超出 −8° 至 15° 的线性模型范围。",
      alpha,
      elevator,
    );
  const cl = d.clZero + d.clAlpha * alpha + d.clElevator * elevator;
  const cm = d.cmZero + d.cmAlpha * alpha + d.cmElevator * elevator;
  return {
    ...base,
    valid: true,
    status: "valid",
    message:
      "升力与重力平衡，重心处俯仰力矩为零。仅表示纵向配平，前向推力平衡未建模。",
    alpha,
    elevator,
    candidateAlpha: alpha,
    candidateElevator: elevator,
    liftResidual: q * p.area * cl - weight,
    momentResidual: q * p.area * p.chord * cm,
  };
}

/** Untrimmed Cm(α) at fixed elevator, with explicit attached-flow validity. */
export function momentCurve(p: StabilityParameters, elevator = 0, points = 93) {
  const d = stabilityDerivatives(p);
  if (
    !Number.isFinite(elevator) ||
    Math.abs(elevator) > p.elevatorLimit + 1e-10
  )
    throw new RangeError("Elevator outside control range");
  if (!Number.isInteger(points) || points < 2 || points > 1001)
    throw new RangeError("points must be an integer from 2 to 1001");
  return Array.from({ length: points }, (_, i) => {
    const alpha =
      STABILITY_ALPHA_MIN +
      ((STABILITY_ALPHA_MAX - STABILITY_ALPHA_MIN) * i) / (points - 1);
    const cl = d.clZero + d.clAlpha * alpha + d.clElevator * elevator;
    const cm = d.cmZero + d.cmAlpha * alpha + d.cmElevator * elevator;
    const valid = Math.abs(cl) <= p.clMax + 1e-10;
    return { alpha, alphaDegrees: alpha / DEG, cl, cm, valid };
  });
}
