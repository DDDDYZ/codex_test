import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEG } from "../physics/models";
import {
  compareLinearization,
  linearizationDefaults,
} from "../physics/linearization";
import { Formula } from "./Formula";
import "../linearization.css";

const matrixLatex = (matrix: number[][]) =>
  `\\begin{bmatrix}${matrix.map((row) => row.map((v) => (Math.abs(v) < 1e-10 ? "0" : v.toFixed(5))).join("&")).join("\\\\")}\\end{bmatrix}`;
export default function LinearizationDemo() {
  const [trimDegrees, setTrimDegrees] = useState(0);
  const [perturbationDegrees, setPerturbationDegrees] = useState(3);
  const result = useMemo(
    () =>
      compareLinearization({
        ...linearizationDefaults,
        trimAngle: trimDegrees * DEG,
        perturbation: perturbationDegrees * DEG,
      }),
    [trimDegrees, perturbationDegrees],
  );
  const rows = useMemo(
    () =>
      result.samples
        .filter((_, i) => i % 2 === 0)
        .map((s) => ({
          time: s.time,
          nonlinear: s.nonlinear / DEG,
          linear: s.linear / DEG,
          error: s.error / DEG,
        })),
    [result],
  );
  return (
    <div className="dyn-card linearization-demo">
      <div className="lin-heading">
        <div>
          <h3>亲自线性化一个非线性方程</h3>
          <p>
            假想俯仰振子：恢复项使用 sin θ。此实验实际计算数值
            Jacobian，并积分同一配平点附近的非线性和线性扰动响应。
          </p>
        </div>
        <span className="lin-tag">局部教学模型</span>
      </div>
      <Formula value="\dot\theta=q,\qquad\dot q=-2\zeta\omega_nq-\omega_n^2\sin\theta+Ku" />
      <p className="dyn-caption">
        ωn = 1.5 rad/s，ζ = 0.4，K = 4 s⁻²；u 是正向增加俯仰角加速度的虚拟输入
        [rad]，这里没有舵面执行器或限幅。θ 是角状态，q
        为其变化率；模型没有空速、气动力导数或完整飞机耦合。
      </p>
      <div className="lin-controls">
        <label htmlFor="lin-trim">
          配平角 θ₀ <strong>{trimDegrees}°</strong>
          <input
            id="lin-trim"
            aria-label="线性化配平角"
            type="range"
            min={-45}
            max={45}
            step={1}
            value={trimDegrees}
            onChange={(e) => setTrimDegrees(Number(e.target.value))}
          />
          <span>
            −45°<span>+45°</span>
          </span>
        </label>
        <label htmlFor="lin-perturbation">
          初始角扰动 δθ(0) <strong>{perturbationDegrees}°</strong>
          <input
            id="lin-perturbation"
            aria-label="线性化初始角扰动"
            type="range"
            min={1}
            max={35}
            step={1}
            value={perturbationDegrees}
            onChange={(e) => setPerturbationDegrees(Number(e.target.value))}
          />
          <span>
            1°<span>35°</span>
          </span>
        </label>
      </div>
      <div className="lin-presets">
        <button onClick={() => setPerturbationDegrees(3)}>小扰动 3°</button>
        <button onClick={() => setPerturbationDegrees(30)}>大扰动 30°</button>
        <button
          onClick={() => {
            setTrimDegrees(0);
            setPerturbationDegrees(3);
          }}
        >
          默认工作点
        </button>
      </div>
      <Formula value="q_0=0,\qquad u_0=\frac{\omega_n^2\sin\theta_0}{K},\qquad f(x_0,u_0)=0" />
      <div className="lin-metrics">
        <div>
          <span>计算得到的 u₀ [rad]</span>
          <strong>{result.trimInput[0].toFixed(6)}</strong>
        </div>
        <div>
          <span>f(x₀,u₀) [rad/s, rad/s²]</span>
          <strong>
            [
            {result.jacobian.residual.map((v) => v.toExponential(1)).join(", ")}
            ]
          </strong>
        </div>
        <div>
          <span>最大角响应差异 [°]</span>
          <strong>{(result.maxError / DEG).toFixed(5)}</strong>
        </div>
      </div>
      <Formula value="A_{ij}\approx\frac{f_i(x_0+\epsilon e_j,u_0)-f_i(x_0-\epsilon e_j,u_0)}{2\epsilon},\qquad B_{i1}\approx\frac{f_i(x_0,u_0+\epsilon)-f_i(x_0,u_0-\epsilon)}{2\epsilon}" />
      <Formula
        value={`A_{num}=${matrixLatex(result.jacobian.a)},\\qquad B_{num}=${matrixLatex(result.jacobian.b)}`}
      />
      <p className="dyn-caption">
        中心差分步长 ε = 10⁻⁵，每个状态/输入轴按其 SI 单位扰动。可与解析值 A₂₁ =
        −ωn²cos θ₀、A₂₂ = −2ζωn、B₂₁ = K 核对。A₁₂ 无量纲、A₂₁ 为 s⁻²、A₂₂ 为
        s⁻¹，B₂₁ 为 s⁻²。
      </p>
      <Formula value="\delta\dot x=A_{num}\delta x+B_{num}\delta u,\qquad\delta u=0,\qquad\delta x(0)=[\delta\theta(0),0]^T" />
      <p>
        两条曲线从相同扰动开始，固定 u = u₀。非线性模型积分绝对状态后减去
        θ₀；线性模型直接积分 δx，使用上方实际差分得到的 A。将扰动从 3° 改为
        30°，或改变工作点，观察局部近似的误差。
      </p>
      <div
        className="lin-chart"
        role="img"
        aria-label="非线性与局部线性角扰动响应比较，时间秒，角扰动度"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 6, right: 20, left: 0, bottom: 22 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              type="number"
              dataKey="time"
              domain={[0, 10]}
              tick={{ fontSize: 10 }}
              label={{
                value: "t [s]",
                position: "insideBottom",
                offset: -12,
                fontSize: 10,
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={58}
              label={{
                value: "δθ [°]",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
              }}
            />
            <Tooltip
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v) => Number(v).toFixed(5)}
              contentStyle={{
                fontSize: 11,
                background: "var(--panel)",
                borderColor: "var(--border)",
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Line
              dataKey="nonlinear"
              name="非线性 δθ"
              stroke="#147b72"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="linear"
              name="局部线性 δθ"
              stroke="#398aac"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div
        className="lin-chart lin-error-chart"
        role="img"
        aria-label="非线性减线性角响应误差，时间秒，角误差度"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 6, right: 20, left: 0, bottom: 22 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              type="number"
              dataKey="time"
              domain={[0, 10]}
              tick={{ fontSize: 10 }}
              label={{
                value: "t [s]",
                position: "insideBottom",
                offset: -12,
                fontSize: 10,
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={58}
              tickFormatter={(v: number) => v.toFixed(3)}
              label={{
                value: "差异 [°]",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(v) => Number(v).toFixed(6)}
              contentStyle={{
                fontSize: 11,
                background: "var(--panel)",
                borderColor: "var(--border)",
              }}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Line
              dataKey="error"
              name="δθNL − δθlinear"
              stroke="#be8150"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="dyn-caption">
        两个模型均用 RK4、固定 h = 0.01 s 演算 10
        s；图表每两步取一点。小扰动近似误差与积分/差分数值误差不同；这个振子说明线性化的方法和局限，并未从完整飞机模型计算气动导数。
      </p>
    </div>
  );
}
