/** SI throughout. All parameters are hypothetical teaching examples, not aircraft data. */
export const DEG = Math.PI / 180;
export const G = 9.80665;
export interface Parameters {
  speed: number;
  density: number;
  area: number;
  alpha: number;
  mass: number;
  thrust: number;
  pitch: number;
  roll: number;
  yaw: number;
}
export const defaults: Parameters = {
  speed: 50,
  density: 1.225,
  area: 16,
  alpha: 5,
  mass: 1000,
  thrust: 1800,
  pitch: 0,
  roll: 0,
  yaw: 0,
};
export const bounds: Record<keyof Parameters, [number, number]> = {
  speed: [10, 100],
  density: [0.3, 1.4],
  area: [5, 30],
  alpha: [-10, 30],
  mass: [400, 2000],
  thrust: [0, 8000],
  pitch: [-80, 80],
  roll: [-180, 180],
  yaw: [-180, 180],
};
export function validate(p: Parameters) {
  for (const key of Object.keys(bounds) as (keyof Parameters)[]) {
    const [lo, hi] = bounds[key];
    if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi)
      throw new RangeError(`${key} 超出教学模型范围 [${lo}, ${hi}]`);
  }
}
/** Finite-wing illustrative slope 0.08/degree; continuous post-stall decay is schematic, not predictive. */
export function liftCoefficient(alpha: number) {
  if (!Number.isFinite(alpha) || alpha < -10 || alpha > 30)
    throw new RangeError("迎角范围 −10° 至 30°");
  return alpha <= 15 ? 0.2 + 0.08 * alpha : 1.4 * Math.exp(-(alpha - 15) / 18);
}
export function aerodynamics(p: Parameters) {
  validate(p);
  const q = 0.5 * p.density * p.speed ** 2;
  const cl = liftCoefficient(p.alpha);
  const cd = 0.025 + 0.055 * cl ** 2;
  const lift = q * p.area * cl;
  const drag = q * p.area * cd;
  const weight = p.mass * G;
  return {
    q,
    cl,
    cd,
    lift,
    drag,
    weight,
    ax: (p.thrust - drag) / p.mass,
    az: (lift - weight) / p.mass,
  };
}
export type Motion = { x: number; z: number; vx: number; vz: number };
export const initialMotion: Motion = { x: 0, z: 0, vx: 0, vz: 0 };
export function rk4(
  y: number[],
  dt: number,
  f: (y: number[]) => number[],
): number[] {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1)
    throw new RangeError("积分步长必须在 (0, 0.1] s");
  const k1 = f(y);
  const k2 = f(y.map((v, i) => v + (dt * k1[i]) / 2));
  const k3 = f(y.map((v, i) => v + (dt * k2[i]) / 2));
  const k4 = f(y.map((v, i) => v + dt * k3[i]));
  const out = y.map(
    (v, i) => v + (dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) / 6,
  );
  if (out.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7))
    throw new Error("数值超出显示范围，请重置；这不代表物理失稳。");
  return out;
}
/** Frozen speed/alpha forces; planar incremental motion, z upward. Not a free-flight 6DOF solver. */
export function stepMotion(s: Motion, p: Parameters, dt = 0.02): Motion {
  const a = aerodynamics(p);
  const [x, z, vx, vz] = rk4([s.x, s.z, s.vx, s.vz], dt, (y) => [
    y[2],
    y[3],
    a.ax,
    a.az,
  ]);
  return { x, z, vx, vz };
}
/** Body x forward, y right, z down; intrinsic yaw-pitch-roll, maps body vectors to NED. */
export function bodyToNed(roll: number, pitch: number, yaw: number) {
  const [r, p, h] = [roll, pitch, yaw].map((v) => v * DEG);
  const cr = Math.cos(r),
    sr = Math.sin(r),
    cp = Math.cos(p),
    sp = Math.sin(p),
    ch = Math.cos(h),
    sh = Math.sin(h);
  return [
    [cp * ch, sr * sp * ch - cr * sh, cr * sp * ch + sr * sh],
    [cp * sh, sr * sp * sh + cr * ch, cr * sp * sh - sr * ch],
    [-sp, sr * cp, cr * cp],
  ];
}
