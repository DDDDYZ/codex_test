import { DEG, G, rk4 } from "./models";

/** Reduced planar point-mass flight-path model, not a rigid-body attitude/autopilot model. SI units. */
export interface AutopilotParameters {
  speedTarget: number;
  heightTarget: number;
  speedHold: boolean;
  heightHold: boolean;
  manualThrust: number;
  manualCl: number;
  windUp: number;
  gustTime: number;
}
export interface AutopilotState {
  time: number;
  speed: number;
  height: number;
  gamma: number;
  cl: number;
  thrust: number;
  speedIntegral: number;
  heightIntegral: number;
}
const mass = 1000,
  density = 1.225,
  area = 16,
  clMax = 1.4,
  thrustMax = 3500;
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
const trimCl = (mass * G) / (0.5 * density * 50 ** 2 * area);
const trimThrust =
  0.5 * density * 50 ** 2 * area * (0.025 + 0.055 * trimCl ** 2);
export const autopilotDefaults: AutopilotParameters = {
  speedTarget: 55,
  heightTarget: 1020,
  speedHold: true,
  heightHold: true,
  manualThrust: trimThrust,
  manualCl: trimCl,
  windUp: 0,
  gustTime: 3,
};
export const initialAutopilotState: AutopilotState = {
  time: 0,
  speed: 50,
  height: 1000,
  gamma: 0,
  cl: trimCl,
  thrust: trimThrust,
  speedIntegral: 0,
  heightIntegral: 0,
};
export const autopilotConstants = {
  mass,
  density,
  area,
  clMax,
  thrustMax,
  speedKp: 0.6,
  speedKi: 0.12,
  heightKp: 0.12,
  heightKi: 0.004,
  gammaKp: 1.2,
  climbLimit: 5,
};
export function validateAutopilot(p: AutopilotParameters) {
  const values: [number, number, number][] = [
    [p.speedTarget, 25, 80],
    [p.heightTarget, 800, 1200],
    [p.manualThrust, 0, thrustMax],
    [p.manualCl, -0.2, clMax],
    [p.windUp, -3, 3],
    [p.gustTime, 0, 30],
  ];
  if (
    values.some(([v, lo, hi]) => !Number.isFinite(v) || v < lo || v > hi) ||
    typeof p.speedHold !== "boolean" ||
    typeof p.heightHold !== "boolean"
  )
    throw new RangeError("参数超出简化高度/速度保持模型范围");
}
export function autopilotCommand(s: AutopilotState, p: AutopilotParameters) {
  const qS = 0.5 * density * s.speed ** 2 * area;
  const lift = qS * s.cl,
    drag = qS * (0.025 + 0.055 * s.cl ** 2);
  const speedError = p.speedTarget - s.speed,
    heightError = p.heightTarget - s.height;
  const requestedClimb = 0.12 * heightError + 0.004 * s.heightIntegral;
  const climb = clamp(requestedClimb, -5, 5);
  const requestedGamma = Math.asin(clamp(climb / Math.max(s.speed, 1), -1, 1));
  const gammaCommand = clamp(requestedGamma, -10 * DEG, 10 * DEG);
  const requestedCl = p.heightHold
    ? (mass *
        (G * Math.cos(s.gamma) + s.speed * 1.2 * (gammaCommand - s.gamma))) /
      Math.max(qS, 1)
    : p.manualCl;
  const clCommand = clamp(requestedCl, -0.2, clMax);
  const requestedThrust = p.speedHold
    ? drag +
      mass * G * Math.sin(s.gamma) +
      mass * (0.6 * speedError + 0.12 * s.speedIntegral)
    : p.manualThrust;
  const thrustCommand = clamp(requestedThrust, 0, thrustMax);
  const speedBlocked = speedError * (requestedThrust - thrustCommand) > 0;
  const heightBlocked =
    heightError * (requestedClimb - climb) > 0 ||
    heightError * (requestedGamma - gammaCommand) > 0 ||
    heightError * (requestedCl - clCommand) > 0;
  return {
    lift,
    drag,
    speedError,
    heightError,
    climb,
    gammaCommand,
    clCommand,
    thrustCommand,
    liftLimited: Math.abs(requestedCl - clCommand) > 1e-9,
    thrustLimited: Math.abs(requestedThrust - thrustCommand) > 1e-9,
    gammaLimited: Math.abs(requestedGamma - gammaCommand) > 1e-9,
    climbLimited:
      Math.abs(requestedClimb - climb) > 1e-9 ||
      Math.abs(requestedGamma - gammaCommand) > 1e-9,
    speedIntegralDot: p.speedHold && !speedBlocked ? speedError : 0,
    heightIntegralDot: p.heightHold && !heightBlocked ? heightError : 0,
  };
}
export function stepAutopilot(
  s: AutopilotState,
  p: AutopilotParameters,
): AutopilotState {
  validateAutopilot(p);
  if (!Object.values(s).every(Number.isFinite))
    throw new RangeError("保持模型状态必须有限");
  if (s.speed < 20 || s.speed > 100 || Math.abs(s.gamma) > 25 * DEG)
    throw new Error("空速或航迹角超出简化点质量模型适用范围；请重置。");
  const wind = s.time + 0.005 >= p.gustTime ? p.windUp : 0;
  const out = rk4(
    [
      s.speed,
      s.height,
      s.gamma,
      s.cl,
      s.thrust,
      s.speedIntegral,
      s.heightIntegral,
    ],
    0.01,
    (y) => {
      const stage: AutopilotState = {
        time: s.time,
        speed: y[0],
        height: y[1],
        gamma: y[2],
        cl: y[3],
        thrust: y[4],
        speedIntegral: y[5],
        heightIntegral: y[6],
      };
      const command = autopilotCommand(stage, p);
      return [
        (y[4] - command.drag) / mass - G * Math.sin(y[2]),
        y[0] * Math.sin(y[2]) + wind,
        (command.lift - mass * G * Math.cos(y[2])) / (mass * Math.max(y[0], 1)),
        (command.clCommand - y[3]) / 0.1,
        (command.thrustCommand - y[4]) / 0.3,
        command.speedIntegralDot,
        command.heightIntegralDot,
      ];
    },
  );
  const next: AutopilotState = {
    time: s.time + 0.01,
    speed: out[0],
    height: out[1],
    gamma: out[2],
    cl: clamp(out[3], -0.2, clMax),
    thrust: clamp(out[4], 0, thrustMax),
    speedIntegral: out[5],
    heightIntegral: out[6],
  };
  if (
    next.speed < 20 ||
    next.speed > 100 ||
    Math.abs(next.gamma) > 25 * DEG ||
    Math.abs(next.height) > 1e5
  )
    throw new Error("模型/数值范围超限；暂停积分。这不是实际飞机失稳判据。");
  return next;
}
