import { bodyToNed, DEG, rk4 } from "./models";

/** SI, hypothetical reduced modal coordinates; these are not aircraft stability derivatives. */
export type DynamicsExperiment = "coordinates" | "longitudinal" | "lateral";
export type ModalExperiment = Exclude<DynamicsExperiment, "coordinates">;
export const DYNAMICS_STEP = 0.01;
export interface DynamicsParameters {
  shortOmega: number;
  shortZeta: number;
  phugoidOmega: number;
  phugoidZeta: number;
  dutchOmega: number;
  dutchZeta: number;
  rollDecay: number;
  spiralRate: number;
  amplitude: number;
}
export const dynamicsDefaults: DynamicsParameters = {
  shortOmega: 3,
  shortZeta: 0.55,
  phugoidOmega: 0.25,
  phugoidZeta: 0.08,
  dutchOmega: 1.3,
  dutchZeta: 0.18,
  rollDecay: 1.2,
  spiralRate: 0.025,
  amplitude: 0.05,
};
export const dynamicsBounds: Record<
  keyof DynamicsParameters,
  [number, number]
> = {
  shortOmega: [0.5, 6],
  shortZeta: [-1.5, 2],
  phugoidOmega: [0.05, 0.6],
  phugoidZeta: [-1.5, 2],
  dutchOmega: [0.2, 4],
  dutchZeta: [-1.5, 2],
  rollDecay: [0, 3],
  spiralRate: [-0.15, 0.15],
  amplitude: [0.005, 0.15],
};
export function validateDynamics(p: DynamicsParameters) {
  for (const key of Object.keys(
    dynamicsBounds,
  ) as (keyof DynamicsParameters)[]) {
    const [min, max] = dynamicsBounds[key];
    if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max)
      throw new RangeError(`${key} 超出教学模型范围 [${min}, ${max}]`);
  }
}
export interface Eigenvalue {
  real: number;
  imaginary: number;
  mode: string;
}
/** Roots of s²+2ζωn s+ωn²=0, including repeated and negative-damping cases. */
export function oscillatorRoots(
  omega: number,
  zeta: number,
  mode = "模态",
): Eigenvalue[] {
  if (!Number.isFinite(omega) || omega <= 0 || !Number.isFinite(zeta))
    throw new RangeError("ωn 必须为正且 ζ 必须为有限数");
  const center = -zeta * omega;
  if (Math.abs(zeta) <= 1) {
    const imaginary = omega * Math.sqrt(Math.max(0, 1 - zeta * zeta));
    return [
      { real: center, imaginary, mode },
      { real: center, imaginary: -imaginary, mode },
    ];
  }
  const spread = omega * Math.sqrt(zeta * zeta - 1);
  return [
    { real: center + spread, imaginary: 0, mode },
    { real: center - spread, imaginary: 0, mode },
  ];
}
export type ModalStability = "stable" | "marginal" | "unstable";
/** Classification concerns this block diagonal continuous model, independently of numerical guards. */
export function eigenvalueStability(roots: Eigenvalue[]): ModalStability {
  if (
    !roots.length ||
    roots.some((r) => !Number.isFinite(r.real) || !Number.isFinite(r.imaginary))
  )
    throw new RangeError("特征值必须为有限数");
  if (roots.some((root) => root.real > 0)) return "unstable";
  return roots.every((root) => root.real < 0) ? "stable" : "marginal";
}
export interface ModalSystem {
  experiment: ModalExperiment;
  matrix: number[][];
  initial: number[];
  stateNames: string[];
  stateUnits: string[];
  eigenvalues: Eigenvalue[];
  stability: ModalStability;
}
export function modalSystem(
  experiment: ModalExperiment,
  p: DynamicsParameters,
): ModalSystem {
  validateDynamics(p);
  const oscillatorBlock = (omega: number, zeta: number) => [
    [0, 1],
    [-(omega ** 2), -2 * zeta * omega],
  ];
  const first =
    experiment === "longitudinal"
      ? oscillatorBlock(p.shortOmega, p.shortZeta)
      : oscillatorBlock(p.dutchOmega, p.dutchZeta);
  const second = oscillatorBlock(p.phugoidOmega, p.phugoidZeta);
  const matrix =
    experiment === "longitudinal"
      ? [
          [...first[0], 0, 0],
          [...first[1], 0, 0],
          [0, 0, ...second[0]],
          [0, 0, ...second[1]],
        ]
      : [
          [...first[0], 0, 0],
          [...first[1], 0, 0],
          [0, 0, -p.rollDecay, 0],
          [0, 0, 0, p.spiralRate],
        ];
  const eigenvalues =
    experiment === "longitudinal"
      ? [
          ...oscillatorRoots(p.shortOmega, p.shortZeta, "短周期"),
          ...oscillatorRoots(p.phugoidOmega, p.phugoidZeta, "长周期"),
        ]
      : [
          ...oscillatorRoots(p.dutchOmega, p.dutchZeta, "荷兰滚"),
          { real: -p.rollDecay, imaginary: 0, mode: "滚转衰减" },
          { real: p.spiralRate, imaginary: 0, mode: "螺旋" },
        ];
  return {
    experiment,
    matrix,
    initial:
      experiment === "longitudinal"
        ? [p.amplitude, 0, p.amplitude, 0]
        : [p.amplitude, 0, p.amplitude, p.amplitude],
    stateNames:
      experiment === "longitudinal"
        ? ["ηSP", "η̇SP", "ηPH", "η̇PH"]
        : ["ηDR", "η̇DR", "pR", "φS"],
    stateUnits:
      experiment === "longitudinal"
        ? ["rad", "rad/s", "rad", "rad/s"]
        : ["rad", "rad/s", "rad/s", "rad"],
    eigenvalues,
    stability: eigenvalueStability(eigenvalues),
  };
}
export function matrixVector(matrix: number[][], state: number[]) {
  if (
    matrix.length !== state.length ||
    matrix.some((row) => row.length !== state.length) ||
    state.some((v) => !Number.isFinite(v)) ||
    matrix.some((row) => row.some((v) => !Number.isFinite(v)))
  )
    throw new RangeError("矩阵维度与有限状态向量不匹配");
  return matrix.map((row) =>
    row.reduce((sum, value, i) => sum + value * state[i], 0),
  );
}
export function stepModal(
  system: ModalSystem,
  state: number[],
  dt = DYNAMICS_STEP,
) {
  return rk4(state, dt, (x) => matrixVector(system.matrix, x));
}
export interface DynamicsSample {
  t: number;
  state: number[];
}
export interface DynamicsTrajectory {
  samples: DynamicsSample[];
  termination: "complete" | "display-guard";
  message: string | null;
  dt: number;
}
/** Fixed RK4 steps only. Output timestamps are derived from integer step indices. */
export function simulateModal(
  system: ModalSystem,
  duration: number,
  dt = DYNAMICS_STEP,
): DynamicsTrajectory {
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 120 ||
    !Number.isFinite(dt) ||
    dt <= 0 ||
    dt > 0.1
  )
    throw new RangeError("时程为 0–120 s，固定步长为 (0, 0.1] s");
  const steps = Math.round(duration / dt);
  if (Math.abs(steps * dt - duration) > 1e-8 || steps > 120_000)
    throw new RangeError("时程必须是固定步长的整数倍，且不超过 120000 步");
  let state = [...system.initial];
  matrixVector(system.matrix, state);
  const samples: DynamicsSample[] = [{ t: 0, state: [...state] }];
  for (let index = 1; index <= steps; index++) {
    try {
      state = stepModal(system, state, dt);
      if (state.some((v) => Math.abs(v) > 1e4))
        throw new Error("数值超过教学图表的幅值范围");
    } catch (error) {
      return {
        samples,
        termination: "display-guard",
        dt,
        message: `${error instanceof Error ? error.message : "积分终止"}。物理稳定性仍由连续系统特征值判断。`,
      };
    }
    samples.push({ t: index * dt, state: [...state] });
  }
  return { samples, termination: "complete", message: null, dt };
}
/** Independent analytic benchmark, not used to generate the RK4 trajectory. */
export function exactOscillator(
  omega: number,
  zeta: number,
  displacement: number,
  velocity: number,
  t: number,
): [number, number] {
  oscillatorRoots(omega, zeta);
  if (![displacement, velocity, t].every(Number.isFinite) || t < 0)
    throw new RangeError("初态和时间必须有效");
  const a = -zeta * omega;
  const b = velocity - a * displacement;
  if (Math.abs(zeta) === 1) {
    const exponential = Math.exp(a * t);
    return [
      exponential * (displacement + b * t),
      exponential * (a * (displacement + b * t) + b),
    ];
  }
  if (Math.abs(zeta) < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const c = Math.cos(wd * t),
      s = Math.sin(wd * t),
      exp = Math.exp(a * t);
    const x = displacement * c + (b / wd) * s;
    return [exp * x, exp * (a * x - displacement * wd * s + b * c)];
  }
  const spread = omega * Math.sqrt(zeta * zeta - 1);
  const r1 = a + spread,
    r2 = a - spread;
  const c1 = (velocity - r2 * displacement) / (r1 - r2),
    c2 = displacement - c1;
  return [
    c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t),
    r1 * c1 * Math.exp(r1 * t) + r2 * c2 * Math.exp(r2 * t),
  ];
}
export function dynamicsCsv(
  system: ModalSystem,
  trajectory: DynamicsTrajectory,
) {
  const columns = [
    "time_s",
    ...system.stateNames.map(
      (name, i) => `${name}_${system.stateUnits[i].replace("/", "_")}`,
    ),
  ];
  return [
    "# Hypothetical decoupled reduced modal model; SI; RK4 fixed step; not aircraft data",
    `# experiment=${system.experiment}; dt_s=${trajectory.dt}; termination=${trajectory.termination}; continuous_stability=${system.stability}`,
    ...system.matrix.map((row, i) => `# A_row_${i + 1}=${row.join(";")}`),
    columns.join(","),
    ...trajectory.samples.map((sample) =>
      [sample.t.toFixed(6), ...sample.state.map((v) => v.toPrecision(12))].join(
        ",",
      ),
    ),
  ].join("\n");
}
export interface CoordinateState {
  roll: number;
  pitch: number;
  yaw: number;
}
export function coordinateModel(angles: CoordinateState) {
  if (
    ![angles.roll, angles.pitch, angles.yaw].every(Number.isFinite) ||
    Math.abs(angles.roll) > 180 ||
    Math.abs(angles.pitch) > 90 ||
    Math.abs(angles.yaw) > 180
  )
    throw new RangeError("Euler 角范围：滚转/航向 ±180°，俯仰 ±90°");
  const matrix = bodyToNed(angles.roll, angles.pitch, angles.yaw);
  const [r, p, h] = [angles.roll, angles.pitch, angles.yaw].map(
    (angle) => (angle * DEG) / 2,
  );
  const [cr, sr, cp, sp, ch, sh] = [
    Math.cos(r),
    Math.sin(r),
    Math.cos(p),
    Math.sin(p),
    Math.cos(h),
    Math.sin(h),
  ];
  const quaternion = [
    cr * cp * ch + sr * sp * sh,
    sr * cp * ch - cr * sp * sh,
    cr * sp * ch + sr * cp * sh,
    cr * cp * sh - sr * sp * ch,
  ];
  const orthogonalityError = Math.max(
    ...matrix.flatMap((row, i) =>
      matrix.map((other, j) =>
        Math.abs(
          row.reduce((sum, v, k) => sum + v * other[k], 0) - (i === j ? 1 : 0),
        ),
      ),
    ),
  );
  const determinant =
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
  return {
    matrix,
    quaternion,
    determinant,
    orthogonalityError,
    eulerSingular: Math.abs(Math.cos(angles.pitch * DEG)) < 1e-8,
  };
}
