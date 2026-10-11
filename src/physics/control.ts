import { DEG, rk4 } from "./models";

/** Hypothetical pitch-only plant. Actuator u is a virtual nose-UP command, not physical elevator delta_e.
 * Physical trailing-edge-down elevator would map as delta_e = -u. Calculations use radians. */
export type ControlMode = "manual" | "pid" | "feedback";
export interface ControlParameters {
  mode: ControlMode;
  target: number;
  manual: number;
  naturalFrequency: number;
  damping: number;
  effectiveness: number;
  kp: number;
  ki: number;
  kd: number;
  actuatorLimit: number;
  actuatorRate: number;
  actuatorLag: number;
  gust: number;
  gustTime: number;
}
export interface ControlState {
  time: number;
  theta: number;
  rate: number;
  integral: number;
  actuator: number;
}
export const CONTROL_DT = 0.01;
export const controlDefaults: ControlParameters = {
  mode: "pid",
  target: 10 * DEG,
  manual: 0,
  naturalFrequency: 1.5,
  damping: 0.55,
  effectiveness: 4,
  kp: 2.8,
  ki: 0.9,
  kd: 0.9,
  actuatorLimit: 20 * DEG,
  actuatorRate: 60 * DEG,
  actuatorLag: 0.05,
  gust: 0,
  gustTime: 3,
};
export const initialControlState: ControlState = {
  time: 0,
  theta: 0,
  rate: 0,
  integral: 0,
  actuator: 0,
};
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function validateControl(p: ControlParameters) {
  if (!["manual", "pid", "feedback"].includes(p.mode))
    throw new RangeError("未知控制模式");
  const bounds: Record<
    Exclude<keyof ControlParameters, "mode">,
    [number, number]
  > = {
    target: [-30 * DEG, 30 * DEG],
    manual: [-30 * DEG, 30 * DEG],
    naturalFrequency: [0.2, 5],
    damping: [0, 2],
    effectiveness: [0.1, 20],
    kp: [0, 12],
    ki: [0, 8],
    kd: [0, 8],
    actuatorLimit: [1 * DEG, 30 * DEG],
    actuatorRate: [1 * DEG, 180 * DEG],
    actuatorLag: [0.02, 0.5],
    gust: [-2, 2],
    gustTime: [0, 30],
  };
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const [lo, hi] = bounds[key];
    if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi)
      throw new RangeError(`${key} 超出假想控制模型范围`);
  }
}

export function controllerOutput(s: ControlState, p: ControlParameters) {
  const error = p.target - s.theta;
  const requested =
    p.mode === "manual"
      ? p.manual
      : p.kp * error -
        p.kd * s.rate +
        (p.mode === "pid" ? p.ki * s.integral : 0);
  const limited = clamp(requested, -p.actuatorLimit, p.actuatorLimit);
  const actuatorDerivative = clamp(
    (limited - s.actuator) / p.actuatorLag,
    -p.actuatorRate,
    p.actuatorRate,
  );
  const saturated = Math.abs(requested) > p.actuatorLimit + 1e-10;
  // Conditional integration: permit unwinding, prevent pushing further into position saturation.
  const blocked = saturated && error * (requested - limited) > 0;
  return {
    error,
    requested,
    limited,
    saturated,
    rateLimited:
      Math.abs((limited - s.actuator) / p.actuatorLag) > p.actuatorRate,
    actuatorDerivative,
    integralDerivative: p.mode === "pid" && p.ki > 0 && !blocked ? error : 0,
  };
}

export function stepControl(
  s: ControlState,
  p: ControlParameters,
): ControlState {
  validateControl(p);
  if (Object.values(s).some((v) => !Number.isFinite(v)))
    throw new RangeError("控制状态必须有限");
  // Disturbance steps align to the fixed-step grid. The single step ending at gustTime uses the old load.
  const gust = s.time + CONTROL_DT / 2 >= p.gustTime ? p.gust : 0;
  const out = rk4(
    [s.theta, s.rate, s.integral, s.actuator],
    CONTROL_DT,
    (y) => {
      const stage = {
        ...s,
        theta: y[0],
        rate: y[1],
        integral: y[2],
        actuator: y[3],
      };
      const command = controllerOutput(stage, p);
      return [
        y[1],
        -2 * p.damping * p.naturalFrequency * y[1] -
          p.naturalFrequency ** 2 * y[0] +
          p.effectiveness * y[3] +
          gust,
        command.integralDerivative,
        command.actuatorDerivative,
      ];
    },
  );
  if (Math.abs(out[0]) > Math.PI || Math.abs(out[1]) > 20)
    throw new Error(
      "数值/教学显示范围超限；暂停积分，请重置。这不是实际飞机失稳判据。",
    );
  return {
    time: s.time + CONTROL_DT,
    theta: out[0],
    rate: out[1],
    integral: out[2],
    actuator: clamp(out[3], -p.actuatorLimit, p.actuatorLimit),
  };
}

export interface ControlSample {
  time: number;
  theta: number;
  target: number;
  actuator: number;
  error: number;
}
export function sampleControl(
  s: ControlState,
  p: ControlParameters,
): ControlSample {
  return {
    time: s.time,
    theta: s.theta,
    target: p.target,
    actuator: s.actuator,
    error: p.target - s.theta,
  };
}

/** Observed-window metrics for a single constant setpoint step; null means not established. */
export function responseMetrics(rows: ControlSample[], cleanStep = true) {
  const first = rows[0],
    last = rows.at(-1);
  if (!first || !last)
    return { error: null, rmsError: null, overshoot: null, settlingTime: null };
  const error = last.target - last.theta;
  const rmsError = Math.sqrt(
    rows.reduce((sum, row) => sum + row.error ** 2, 0) / rows.length,
  );
  const amplitude = first.target - first.theta;
  const valid =
    cleanStep &&
    Math.abs(amplitude) > 1e-6 &&
    rows.every((r) => Math.abs(r.target - first.target) < 1e-10);
  if (!valid) return { error, rmsError, overshoot: null, settlingTime: null };
  const direction = Math.sign(amplitude);
  const overshoot =
    (100 *
      Math.max(
        0,
        ...rows.map((row) => direction * (row.theta - first.target)),
      )) /
    Math.abs(amplitude);
  const tolerance = 0.02 * Math.abs(amplitude);
  let lastOutside = -1;
  rows.forEach((row, i) => {
    if (Math.abs(row.theta - first.target) > tolerance) lastOutside = i;
  });
  const settledRow = rows[lastOutside + 1];
  const settlingTime =
    settledRow && last.time - settledRow.time >= 1 - 1e-9
      ? settledRow.time - first.time
      : null;
  return { error, rmsError, overshoot, settlingTime };
}
