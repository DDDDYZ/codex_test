import { DEG, rk4 } from "./models";

/** Hypothetical nonlinear pitch oscillator, not a model identified from aircraft derivatives. */
export interface LinearizationParameters {
  trimAngle: number;
  perturbation: number;
  omega: number;
  zeta: number;
  effectiveness: number;
}
export const LINEARIZATION_DT = 0.01;
export const linearizationDefaults: LinearizationParameters = {
  trimAngle: 0,
  perturbation: 3 * DEG,
  omega: 1.5,
  zeta: 0.4,
  effectiveness: 4,
};
export function validateLinearization(p: LinearizationParameters) {
  if (
    ![p.trimAngle, p.perturbation, p.omega, p.zeta, p.effectiveness].every(
      Number.isFinite,
    ) ||
    Math.abs(p.trimAngle) > 45 * DEG ||
    Math.abs(p.perturbation) > 35 * DEG ||
    p.omega < 0.2 ||
    p.omega > 5 ||
    p.zeta < 0 ||
    p.zeta > 2 ||
    p.effectiveness <= 0 ||
    p.effectiveness > 20
  )
    throw new RangeError(
      "线性化教学参数超出范围：配平角 ±45°、扰动 ±35°，频率与控制效能为正",
    );
}
export function nonlinearPitchDerivative(
  state: number[],
  input: number[],
  p: LinearizationParameters,
): number[] {
  validateLinearization(p);
  if (
    state.length !== 2 ||
    input.length !== 1 ||
    ![...state, ...input].every(Number.isFinite)
  )
    throw new RangeError("状态为 [θ,q]，输入为 [u]，均须有限并使用 SI / rad");
  return [
    state[1],
    -2 * p.zeta * p.omega * state[1] -
      p.omega ** 2 * Math.sin(state[0]) +
      p.effectiveness * input[0],
  ];
}
export interface NumericalJacobian {
  a: number[][];
  b: number[][];
  residual: number[];
  epsilon: number;
}
/** Differentiate the supplied vector field, not a prewritten analytic matrix. */
export function centralDifferenceJacobian(
  f: (state: number[], input: number[]) => number[],
  state: number[],
  input: number[],
  epsilon = 1e-5,
): NumericalJacobian {
  if (
    !state.length ||
    ![...state, ...input].every(Number.isFinite) ||
    !Number.isFinite(epsilon) ||
    epsilon <= 0
  )
    throw new RangeError("差分状态、输入与正差分步长必须有效");
  const evaluate = (x: number[], u: number[]) => {
    const result = f(x, u);
    if (result.length !== state.length || !result.every(Number.isFinite))
      throw new RangeError("向量场输出与状态维度不匹配或不是有限值");
    return result;
  };
  const residual = evaluate([...state], [...input]);
  const a = state.map(() => state.map(() => 0)),
    b = state.map(() => input.map(() => 0));
  for (let col = 0; col < state.length; col++) {
    const plus = [...state],
      minus = [...state];
    plus[col] += epsilon;
    minus[col] -= epsilon;
    const fp = evaluate(plus, [...input]),
      fm = evaluate(minus, [...input]);
    for (let row = 0; row < state.length; row++)
      a[row][col] = (fp[row] - fm[row]) / (2 * epsilon);
  }
  for (let col = 0; col < input.length; col++) {
    const plus = [...input],
      minus = [...input];
    plus[col] += epsilon;
    minus[col] -= epsilon;
    const fp = evaluate([...state], plus),
      fm = evaluate([...state], minus);
    for (let row = 0; row < state.length; row++)
      b[row][col] = (fp[row] - fm[row]) / (2 * epsilon);
  }
  return { a, b, residual, epsilon };
}
export interface LinearizationSample {
  time: number;
  nonlinear: number;
  linear: number;
  nonlinearRate: number;
  linearRate: number;
  error: number;
}
/** Both responses use fixed-step RK4; the linear response uses the computed numerical Jacobian. */
export function compareLinearization(
  p: LinearizationParameters,
  duration = 10,
) {
  validateLinearization(p);
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 30 ||
    Math.abs(
      duration / LINEARIZATION_DT - Math.round(duration / LINEARIZATION_DT),
    ) > 1e-8
  )
    throw new RangeError("比较时长必须为 0–30 s 内的 0.01 s 整数倍");
  const trimState = [p.trimAngle, 0],
    trimInput = [(p.omega ** 2 * Math.sin(p.trimAngle)) / p.effectiveness];
  const field = (state: number[], input: number[]) =>
    nonlinearPitchDerivative(state, input, p);
  const jacobian = centralDifferenceJacobian(field, trimState, trimInput);
  let nonlinear = [p.trimAngle + p.perturbation, 0],
    linear = [p.perturbation, 0];
  const samples: LinearizationSample[] = [];
  function addSample(index: number) {
    const deviation = nonlinear[0] - p.trimAngle;
    samples.push({
      time: index * LINEARIZATION_DT,
      nonlinear: deviation,
      linear: linear[0],
      nonlinearRate: nonlinear[1],
      linearRate: linear[1],
      error: deviation - linear[0],
    });
  }
  addSample(0);
  for (
    let index = 1;
    index <= Math.round(duration / LINEARIZATION_DT);
    index++
  ) {
    nonlinear = rk4(nonlinear, LINEARIZATION_DT, (state) =>
      field(state, trimInput),
    );
    linear = rk4(linear, LINEARIZATION_DT, (state) =>
      jacobian.a.map((row) =>
        row.reduce((sum, value, col) => sum + value * state[col], 0),
      ),
    );
    addSample(index);
  }
  return {
    samples,
    jacobian,
    trimState,
    trimInput,
    maxError: Math.max(...samples.map((sample) => Math.abs(sample.error))),
    duration,
    dt: LINEARIZATION_DT,
  };
}
