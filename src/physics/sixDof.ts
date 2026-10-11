import { DEG, G, rk4 } from "./models";

export type Vec3 = [number, number, number];
/** Scalar-first unit quaternion [w,x,y,z], rotates body vectors into NED. */
export type Quaternion = [number, number, number, number];
export interface SixDofState {
  time: number;
  position: Vec3;
  velocity: Vec3;
  attitude: Quaternion;
  rates: Vec3;
}
/** Physical elevator positive trailing-edge DOWN (nose-down); positive aileron/right-roll, rudder/right-yaw. */
export interface SixDofControls {
  thrust: number;
  elevator: number;
  aileron: number;
  rudder: number;
}
export interface SixDofParameters {
  mass: number;
  area: number;
  span: number;
  chord: number;
  inertia: Vec3;
  density: number;
  gravity: number;
  wind: Vec3;
  aerodynamic: boolean;
  cl0: number;
  clAlpha: number;
  clMax: number;
  cd0: number;
  induced: number;
}
export const SIX_DOF_DT = 0.01;
export const sixDofDefaults: SixDofParameters = {
  mass: 1000,
  area: 16,
  span: 10,
  chord: 1.6,
  inertia: [1200, 1800, 2500],
  density: 1.225,
  gravity: G,
  wind: [0, 0, 0],
  aerodynamic: true,
  cl0: (1000 * G) / (0.5 * 1.225 * 50 ** 2 * 16),
  clAlpha: 5,
  clMax: 1.4,
  cd0: 0.025,
  induced: 0.055,
};
export const sixDofTrimThrust =
  0.5 *
  sixDofDefaults.density *
  50 ** 2 *
  sixDofDefaults.area *
  (sixDofDefaults.cd0 + sixDofDefaults.induced * sixDofDefaults.cl0 ** 2);
export const sixDofControls: SixDofControls = {
  thrust: sixDofTrimThrust,
  elevator: 0,
  aileron: 0,
  rudder: 0,
};
export function initialSixDofState(): SixDofState {
  return {
    time: 0,
    position: [0, 0, -1000],
    velocity: [50, 0, 0],
    attitude: [1, 0, 0, 0],
    rates: [0, 0, 0],
  };
}
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalizeQuaternion(q: Quaternion): Quaternion {
  const norm = Math.hypot(...q);
  if (!Number.isFinite(norm) || norm < 1e-12)
    throw new RangeError("四元数必须有限且非零");
  return q.map((v) => v / norm) as Quaternion;
}
export function quaternionMatrix(attitude: Quaternion): [Vec3, Vec3, Vec3] {
  const [w, x, y, z] = normalizeQuaternion(attitude);
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}
export const matrixVector = (r: [Vec3, Vec3, Vec3], v: Vec3): Vec3 =>
  r.map((row) => row.reduce((sum, x, i) => sum + x * v[i], 0)) as Vec3;
export const transposeVector = (r: [Vec3, Vec3, Vec3], v: Vec3): Vec3 =>
  [0, 1, 2].map((j) =>
    r.reduce((sum, row, i) => sum + row[j] * v[i], 0),
  ) as Vec3;
export function quaternionEuler(attitude: Quaternion) {
  const r = quaternionMatrix(attitude);
  return {
    roll: Math.atan2(r[2][1], r[2][2]),
    pitch: Math.asin(Math.max(-1, Math.min(1, -r[2][0]))),
    yaw: Math.atan2(r[1][0], r[0][0]),
  };
}
function validateState(s: SixDofState) {
  if (
    ![s.time, ...s.position, ...s.velocity, ...s.attitude, ...s.rates].every(
      Number.isFinite,
    )
  )
    throw new RangeError("六自由度状态必须有限");
  normalizeQuaternion(s.attitude);
}
export function validateSixDof(p: SixDofParameters, c: SixDofControls) {
  const positive = [p.mass, p.area, p.span, p.chord, ...p.inertia, p.clMax];
  const nonnegative = [p.density, p.gravity, p.cd0, p.induced];
  if (
    positive.some((v) => !Number.isFinite(v) || v <= 0) ||
    nonnegative.some((v) => !Number.isFinite(v) || v < 0) ||
    ![
      p.cl0,
      p.clAlpha,
      ...p.wind,
      c.thrust,
      c.elevator,
      c.aileron,
      c.rudder,
    ].every(Number.isFinite) ||
    p.clAlpha < 0 ||
    c.thrust < 0 ||
    c.thrust > 8000 ||
    [c.elevator, c.aileron, c.rudder].some(
      (v) => Math.abs(v) > 20 * DEG + 1e-12,
    )
  )
    throw new RangeError("参数或操纵量超出假想六自由度模型范围");
}

export interface SixDofLoads {
  force: Vec3;
  moment: Vec3;
  speed: number;
  alpha: number;
  beta: number;
  cl: number;
  lift: number;
  drag: number;
  applicable: boolean;
  reason: string | null;
}
/** Approximate attached-flow coefficients, fixed density, diagonal inertia; no real-aircraft data. */
export function sixDofLoads(
  s: SixDofState,
  p: SixDofParameters,
  c: SixDofControls,
): SixDofLoads {
  validateState(s);
  validateSixDof(p, c);
  const windBody = transposeVector(quaternionMatrix(s.attitude), p.wind);
  const air = s.velocity.map((v, i) => v - windBody[i]) as Vec3;
  const speed = Math.hypot(...air);
  const alpha = speed < 1e-8 ? 0 : Math.atan2(air[2], air[0]);
  const beta =
    speed < 1e-8 ? 0 : Math.asin(Math.max(-1, Math.min(1, air[1] / speed)));
  const cl = p.cl0 + p.clAlpha * alpha;
  if (!p.aerodynamic)
    return {
      force: [c.thrust, 0, 0],
      moment: [0, 0, 0],
      speed,
      alpha,
      beta,
      cl,
      lift: 0,
      drag: 0,
      applicable: true,
      reason: null,
    };
  const reason =
    speed < 5
      ? "空速低于 5 m/s，附着流教学模型不适用"
      : speed > 150
        ? "空速超过 150 m/s，低速教学模型不适用"
        : Math.abs(cl) > p.clMax
          ? "|CL| 超过 CLmax，进入未建模的失速区"
          : Math.abs(alpha) > 15 * DEG
            ? "|迎角| 超过 15°，附着流近似不适用"
            : Math.abs(beta) > 20 * DEG
              ? "|侧滑角| 超过 20°，小侧滑系数近似不适用"
              : null;
  const qS = 0.5 * p.density * speed ** 2 * p.area;
  const lift = qS * cl,
    drag = qS * (p.cd0 + p.induced * cl ** 2),
    side = qS * (-0.7 * beta);
  const ca = Math.cos(alpha),
    sa = Math.sin(alpha),
    cb = Math.cos(beta),
    sb = Math.sin(beta);
  // Wind basis x=(ca cb,sb,sa cb), y=(-ca sb,cb,-sa sb), z=(-sa,0,ca).
  const force: Vec3 = [
    c.thrust - drag * ca * cb - side * ca * sb + lift * sa,
    -drag * sb + side * cb,
    -drag * sa * cb - side * sa * sb - lift * ca,
  ];
  const inv2V = speed >= 1 ? 1 / (2 * speed) : 0;
  const [rollRate, pitchRate, yawRate] = s.rates;
  const moment: Vec3 = [
    qS *
      p.span *
      (-0.12 * beta - 0.5 * p.span * rollRate * inv2V + 0.12 * c.aileron),
    qS *
      p.chord *
      (-0.8 * alpha - 12 * p.chord * pitchRate * inv2V - c.elevator),
    qS *
      p.span *
      (0.18 * beta - 0.25 * p.span * yawRate * inv2V + 0.1 * c.rudder),
  ];
  return {
    force,
    moment,
    speed,
    alpha,
    beta,
    cl,
    lift,
    drag,
    applicable: reason === null,
    reason,
  };
}
export class SixDofDomainError extends Error {
  constructor(reason: string) {
    super(`${reason}；暂停积分。该模型不能预测失速后的运动。`);
    this.name = "SixDofDomainError";
  }
}
function unpack(y: number[], time: number): SixDofState {
  return {
    time,
    position: y.slice(0, 3) as Vec3,
    velocity: y.slice(3, 6) as Vec3,
    attitude: y.slice(6, 10) as Quaternion,
    rates: y.slice(10, 13) as Vec3,
  };
}
export function sixDofDerivative(
  s: SixDofState,
  p: SixDofParameters,
  c: SixDofControls,
): number[] {
  const loads = sixDofLoads(s, p, c);
  if (!loads.applicable) throw new SixDofDomainError(loads.reason!);
  const r = quaternionMatrix(s.attitude),
    positionDot = matrixVector(r, s.velocity);
  const bodyGravity = transposeVector(r, [0, 0, p.gravity]),
    rotatingVelocity = cross(s.rates, s.velocity);
  const velocityDot = loads.force.map(
    (force, i) => force / p.mass - rotatingVelocity[i] + bodyGravity[i],
  );
  const momentum = s.rates.map((v, i) => p.inertia[i] * v) as Vec3,
    gyroscopic = cross(s.rates, momentum);
  const ratesDot = loads.moment.map(
    (moment, i) => (moment - gyroscopic[i]) / p.inertia[i],
  );
  const [w, x, y, z] = s.attitude,
    [a, b, d] = s.rates;
  const quaternionDot = [
    -x * a - y * b - z * d,
    w * a + y * d - z * b,
    w * b + z * a - x * d,
    w * d + x * b - y * a,
  ].map((v) => 0.5 * v);
  return [...positionDot, ...velocityDot, ...quaternionDot, ...ratesDot];
}
export function stepSixDof(
  s: SixDofState,
  p: SixDofParameters,
  c: SixDofControls,
): SixDofState {
  validateState(s);
  validateSixDof(p, c);
  let result: number[];
  try {
    result = rk4(
      [...s.position, ...s.velocity, ...s.attitude, ...s.rates],
      SIX_DOF_DT,
      (y) => sixDofDerivative(unpack(y, s.time), p, c),
    );
  } catch (error) {
    if (error instanceof SixDofDomainError || error instanceof RangeError)
      throw error;
    throw new Error(
      "数值计算超限；请重置。数值保护停止不等于真实飞机物理失稳。",
    );
  }
  const next = unpack(result, s.time + SIX_DOF_DT);
  next.attitude = normalizeQuaternion(next.attitude);
  if (
    Math.hypot(...next.velocity) > 500 ||
    Math.hypot(...next.rates) > 20 ||
    Math.hypot(...next.position) > 1e6
  )
    throw new Error(
      "数值/教学显示范围超限；请重置。该保护不是真实飞机失稳判据。",
    );
  const loads = sixDofLoads(next, p, c);
  if (!loads.applicable) throw new SixDofDomainError(loads.reason!);
  return next;
}
