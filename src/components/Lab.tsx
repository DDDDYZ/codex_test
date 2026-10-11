import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import Aircraft from "./Aircraft";
import { Formula } from "./Formula";
import {
  aerodynamics,
  bounds,
  defaults,
  initialMotion,
  liftCoefficient,
  stepMotion,
  type Parameters,
  type Motion,
} from "../physics/models";
import { experiments, type ExperimentId } from "../physics/experiments";
export type Experiment = ExperimentId;
const names = { forces: "四力平衡", lift: "迎角与升力", attitude: "三轴姿态" };
const labels: Record<keyof Parameters, [string, string]> = {
  speed: ["来流速度", "m/s"],
  density: ["空气密度", "kg/m³"],
  area: ["机翼面积", "m²"],
  alpha: ["迎角", "°"],
  mass: ["质量", "kg"],
  thrust: ["推力", "N"],
  pitch: ["俯仰角 θ", "°"],
  roll: ["滚转角 φ", "°"],
  yaw: ["偏航角 ψ", "°"],
};
export default function Lab({ onTask }: { onTask: () => void }) {
  const [exp, setExp] = useState<Experiment>("forces");
  const [p, setP] = useState({ ...defaults });
  const [motion, setMotion] = useState<Motion>({ ...initialMotion });
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [vectors, setVectors] = useState(true);
  const [axes, setAxes] = useState(false);
  const [formulas, setFormulas] = useState(true);
  const [units, setUnits] = useState(true);
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<Parameters | null>(null);
  const [history, setHistory] = useState<{ t: number; z: number; x: number }[]>(
    [{ t: 0, z: 0, x: 0 }],
  );
  const state = useRef({ motion, time });
  const a = aerodynamics(p);
  function reset() {
    setRunning(false);
    state.current = { motion: { ...initialMotion }, time: 0 };
    setMotion({ ...initialMotion });
    setTime(0);
    setHistory([{ t: 0, z: 0, x: 0 }]);
    setError("");
  }
  function advance(n = 1) {
    try {
      let { motion: m, time: t } = state.current;
      for (let i = 0; i < n; i++) {
        m = stepMotion(m, p);
        t += 0.02;
      }
      if (t >= 20) {
        setRunning(false);
        setError("已完成 20 s 观察窗口。该模型固定来流，不继续外推，请重置。");
      }
      state.current = { motion: m, time: t };
      setMotion(m);
      setTime(t);
      setHistory((h) =>
        [...h, { t: Number(t.toFixed(2)), z: m.z, x: m.x }].slice(-1001),
      );
    } catch (e) {
      setRunning(false);
      setError(String(e));
    }
  }
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => advance(rate), 20);
    return () => clearInterval(id);
  }, [running, p, rate]);
  function update(k: keyof Parameters, v: number) {
    const [lo, hi] = bounds[k];
    if (!Number.isFinite(v) || v < lo || v > hi) {
      setError(
        `${labels[k][0]}范围：${lo}–${hi} ${labels[k][1]}。未应用输入。`,
      );
      return;
    }
    setError("");
    setP((old) => ({ ...old, [k]: v }));
  }
  const keys = experiments[exp].parameterKeys;
  const curve = Array.from({ length: 81 }, (_, i) => {
    const alpha = -10 + i * 0.5;
    return {
      alpha,
      cl: liftCoefficient(alpha),
      saved: comparison
        ? (liftCoefficient(alpha) *
            comparison.density *
            comparison.speed ** 2 *
            comparison.area) /
          2 /
          1000
        : undefined,
      lift:
        (liftCoefficient(alpha) * p.density * p.speed ** 2 * p.area) / 2 / 1000,
    };
  });
  function exportData() {
    const csv =
      "time_s,x_m,z_up_m\n" +
      history.map((h) => `${h.t},${h.x},${h.z}`).join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "flight-lab-response.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const savedResult = comparison ? aerodynamics(comparison) : null;
  const balanced = Math.abs(a.ax) < 0.1 && Math.abs(a.az) < 0.1;
  return (
    <section className="lab" id="lab">
      <div className="section-heading">
        <div>
          <div className="eyebrow">EXPLORE THE PHYSICS</div>
          <h2>把理论，放进实验里。</h2>
        </div>
        <span className="badge">3 个开放实验</span>
      </div>
      <div className="lab-tabs" role="tablist">
        {(Object.keys(names) as Experiment[]).map((key, i) => (
          <button
            role="tab"
            aria-selected={exp === key}
            className={exp === key ? "active" : ""}
            key={key}
            onClick={() => {
              setExp(key);
              reset();
            }}
          >
            <span>0{i + 1}</span> {names[key]}实验
          </button>
        ))}
      </div>
      <div className="lab-grid">
        <aside className="theory">
          <div className="eyebrow">
            实验手册 / {exp === "forces" ? "01" : exp === "lift" ? "02" : "03"}
          </div>
          <h3>{names[exp]}</h3>
          <p>
            {exp === "forces"
              ? "试着让四个力达到平衡。合力决定加速度，而不是速度；平衡的飞机也可以保持运动。"
              : exp === "lift"
                ? "缓慢增大迎角，观察线性升力区与失速区的分界。对比不同速度下的曲线。"
                : "分别调整三个姿态角，观察机体轴如何旋转。迎角与俯仰角不是同一个角度。"}
          </p>
          {formulas && (
            <>
              <Formula
                value={
                  exp === "attitude"
                    ? "R_b^n=R_z(\\psi)R_y(\\theta)R_x(\\phi)"
                    : exp === "lift"
                      ? "L=\\frac12\\rho V^2 S C_L"
                      : "\\sum F=ma"
                }
              />
              <p className="small">
                {exp === "attitude"
                  ? "机体 x 向前、y 向右、z 向下；世界为北东地 NED。内禀偏航–俯仰–滚转。"
                  : "L 升力 [N] · ρ 密度 [kg/m³] · V 速度 [m/s] · S 面积 [m²] · CL 无量纲"}
              </p>
            </>
          )}
          <div className="model-note">
            <strong>模型与假设</strong>
            <p>
              {exp === "attitude"
                ? "刚体姿态教学模型，非动力学。限制俯仰在 ±80°，避开欧拉角 ±90° 奇异性。姿态矩阵转为四元数用于渲染。"
                : "工程近似：CL = 0.2 + 0.08α（α 使用度，−10° 至 15°），CD = 0.025 + 0.055CL²。15° 后指数下降仅为教学示意。"}
            </p>
            {exp === "forces" && (
              <p>
                固定来流与迎角，推力沿来流；二维位移 z
                向上。显示位移经缩放限幅，实际值见图表。RK4 / Δt = 0.02 s。
              </p>
            )}
          </div>
          <a
            href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/"
            target="_blank"
            rel="noreferrer"
            className="reference"
          >
            参考：NASA Glenn · Lift Equation ↗
          </a>
          <p className="small">
            系数与机型参数均为假设教学示例，未经真实风洞数据标定。
          </p>
        </aside>
        <div className="visual-column">
          <Aircraft
            p={exp === "attitude" ? p : { ...p, pitch: 0, roll: 0, yaw: 0 }}
            forces={a}
            motion={motion}
            showForces={vectors && exp !== "attitude"}
            axes={axes || exp === "attitude"}
          />
          <div className="transport">
            <button
              aria-label={running ? "暂停" : "运行"}
              className="play"
              onClick={() => setRunning(!running)}
              disabled={exp !== "forces" || time >= 20}
            >
              {running ? "Ⅱ" : "▶"}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                advance();
              }}
              disabled={exp !== "forces" || time >= 20}
            >
              单步
            </button>
            <button onClick={reset}>↺ 重置</button>
            <span>{time.toFixed(2)} s</span>
            <select
              aria-label="仿真速度"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            >
              <option value={1}>1× 速度</option>
              <option value={2}>2× 速度</option>
              <option value={4}>4× 速度</option>
            </select>
          </div>
          <div className="readouts">
            {exp === "attitude"
              ? (["pitch", "roll", "yaw"] as const).map((k) => (
                  <div key={k}>
                    <small>{labels[k][0]}</small>
                    <strong>
                      {p[k].toFixed(0)}
                      <em>{units ? "°" : ""}</em>
                    </strong>
                  </div>
                ))
              : [
                  ["升力 L", a.lift / 1000, "kN"],
                  ["重力 W", a.weight / 1000, "kN"],
                  ["升力系数 CL", a.cl, ""],
                ].map(([t, v, u]) => (
                  <div key={t}>
                    <small>{t}</small>
                    <strong>
                      {Number(v).toFixed(2)}
                      <em>{units ? u : ""}</em>
                    </strong>
                  </div>
                ))}
          </div>
          <div className="display-options">
            <label>
              <input
                type="checkbox"
                checked={vectors}
                onChange={(e) => setVectors(e.target.checked)}
              />
              力矢量
            </label>
            <label>
              <input
                type="checkbox"
                checked={axes}
                onChange={(e) => setAxes(e.target.checked)}
              />
              坐标轴
            </label>
            <label>
              <input
                type="checkbox"
                checked={formulas}
                onChange={(e) => setFormulas(e.target.checked)}
              />
              公式
            </label>
            <label>
              <input
                type="checkbox"
                checked={units}
                onChange={(e) => setUnits(e.target.checked)}
              />
              单位
            </label>
          </div>
        </div>
        <aside className="parameters">
          <div className="panel-heading">
            <h3>实验参数</h3>
            <button
              onClick={() => {
                setP({ ...defaults });
                reset();
              }}
            >
              恢复默认
            </button>
          </div>
          {keys.map((k) => (
            <div className="parameter" key={k}>
              <label htmlFor={`range-${k}`}>
                {labels[k][0]} <small>{units ? labels[k][1] : ""}</small>
              </label>
              <input
                aria-label={`${labels[k][0]}数值`}
                type="number"
                key={`${k}-${p[k]}`}
                defaultValue={p[k]}
                min={bounds[k][0]}
                max={bounds[k][1]}
                step={k === "density" ? 0.025 : k === "alpha" ? 0.5 : 1}
                onBlur={(e) => update(k, Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <input
                id={`range-${k}`}
                type="range"
                min={bounds[k][0]}
                max={bounds[k][1]}
                step={k === "density" ? 0.025 : k === "alpha" ? 0.5 : 1}
                value={p[k]}
                onChange={(e) => update(k, Number(e.target.value))}
              />
              <div className="range-labels">
                <span>{bounds[k][0]}</span>
                <span>{bounds[k][1]}</span>
              </div>
            </div>
          ))}
          {error && (
            <p role="alert" className="warning">
              {error}
            </p>
          )}
          {exp === "lift" && p.alpha > 15 && (
            <p className="warning">
              失速示意区：线性模型不再适用，曲线不预测真实飞机。
            </p>
          )}
          {exp === "forces" && (
            <div className="balance-info">
              a水平 = {a.ax.toFixed(2)} m/s²
              <br />
              a向上 = {a.az.toFixed(2)} m/s²
              <br />
              {balanced ? "✓ 已达到近似平衡" : "调整质量和推力，寻找合力为零。"}
              {balanced && <button onClick={onTask}>记录实验任务完成</button>}
            </div>
          )}
          {exp === "lift" && (
            <>
              <div className="chart-title">升力系数曲线 · CL [无量纲]</div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={curve}
                    margin={{ top: 10, right: 12, left: -18, bottom: 18 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="alpha"
                      type="number"
                      domain={[-10, 30]}
                      tick={{ fontSize: 10 }}
                      label={{
                        value: "迎角 α [°]",
                        position: "insideBottom",
                        offset: -10,
                        fontSize: 10,
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend
                      verticalAlign="top"
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <ReferenceLine x={15} stroke="#d88747" />
                    <ReferenceLine x={p.alpha} stroke="#247e91" />
                    <Line
                      dataKey="cl"
                      name="CL 无量纲"
                      stroke="#247e91"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          <div className="chart-title">
            {exp === "forces"
              ? "位移响应 · z 向上"
              : exp === "lift"
                ? "迎角与升力"
                : "机体前轴在 NED 的分量"}
          </div>
          <div className="chart">
            {exp === "attitude" ? (
              <div className="matrix-readout">
                {bodyAxis(p).map((v, i) => (
                  <div key={i}>
                    {["北 N", "东 E", "地 D"][i]}
                    <strong>{v.toFixed(3)}</strong>
                  </div>
                ))}
                <p>无量纲单位向量。俯仰为正时，地向分量为负。</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={
                    (exp === "forces" ? history : curve) as Array<{
                      t?: number;
                      z?: number;
                      x?: number;
                      alpha?: number;
                      cl?: number;
                      saved?: number;
                      lift?: number;
                    }>
                  }
                  margin={{ top: 10, right: 12, left: -18, bottom: 18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#dce4ec" />
                  <XAxis
                    dataKey={exp === "forces" ? "t" : "alpha"}
                    type="number"
                    domain={exp === "forces" ? ["auto", "auto"] : [-10, 30]}
                    tick={{ fontSize: 10 }}
                    label={{
                      value: exp === "forces" ? "时间 t [s]" : "迎角 α [°]",
                      position: "insideBottom",
                      offset: -10,
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    label={{
                      value: exp === "forces" ? "位移 [m]" : "升力 [kN]",
                      angle: -90,
                      position: "insideLeft",
                      offset: 20,
                      fontSize: 10,
                    }}
                  />
                  <Tooltip formatter={(v) => Number(v).toFixed(3)} />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    name={exp === "forces" ? "z 向上" : "当前升力"}
                    dataKey={exp === "forces" ? "z" : "lift"}
                    stroke="#247e91"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {exp === "forces" ? (
                    <Line
                      name="x 水平"
                      dataKey="x"
                      stroke="#c18a48"
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <>
                      <ReferenceLine
                        x={15}
                        stroke="#d88747"
                        label={{ value: "失速", fontSize: 10 }}
                      />
                      <ReferenceLine x={p.alpha} stroke="#247e91" />
                      {comparison && (
                        <Line
                          name="保存的升力"
                          dataKey="saved"
                          stroke="#b797d1"
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="compare-buttons">
            <button onClick={() => setComparison({ ...p })}>
              保存参数快照
            </button>
            {comparison && (
              <button
                onClick={() => {
                  setP(comparison);
                  reset();
                }}
              >
                载入快照
              </button>
            )}
            {exp === "forces" && (
              <button onClick={exportData}>导出 CSV ↓</button>
            )}
          </div>
          {comparison && (
            <p className="small">
              快照：θ {comparison.pitch}° / φ {comparison.roll}° / ψ{" "}
              {comparison.yaw}° · V {comparison.speed} m/s · α{" "}
              {comparison.alpha}° · ρ {comparison.density} kg/m³ · S{" "}
              {comparison.area} m²
            </p>
          )}
          {savedResult && (
            <p className="small">
              快照结果：L {(savedResult.lift / 1000).toFixed(2)} kN · W{" "}
              {(savedResult.weight / 1000).toFixed(2)} kN · ax{" "}
              {savedResult.ax.toFixed(2)} m/s² · az {savedResult.az.toFixed(2)}{" "}
              m/s²
            </p>
          )}
        </aside>
      </div>
      <p className="lab-footer">
        ⓘ
        姿态与迎角实验为静态模型，参数即时更新；运行和单步用于四力动态实验。三维矢量长度缩放限幅，精确值以计算读数为准。
      </p>
    </section>
  );
}
function bodyAxis(p: Parameters) {
  const theta = (p.pitch * Math.PI) / 180,
    psi = (p.yaw * Math.PI) / 180;
  return [
    Math.cos(theta) * Math.cos(psi),
    Math.cos(theta) * Math.sin(psi),
    -Math.sin(theta),
  ];
}
