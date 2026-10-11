import { useEffect, useMemo, useState } from "react";
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
import Aircraft from "./Aircraft";
import LinearizationDemo from "./LinearizationDemo";
import { Formula } from "./Formula";
import { aerodynamics, defaults, initialMotion } from "../physics/models";
import {
  coordinateModel,
  DYNAMICS_STEP,
  dynamicsBounds,
  dynamicsCsv,
  dynamicsDefaults,
  modalSystem,
  simulateModal,
  type CoordinateState,
  type DynamicsExperiment,
  type DynamicsParameters,
  type DynamicsSample,
  type Eigenvalue,
  type ModalExperiment,
} from "../physics/dynamics";
import "../dynamics.css";

const names: Record<DynamicsExperiment, string> = {
  coordinates: "坐标与线性化",
  longitudinal: "纵向模态",
  lateral: "横侧向模态",
};
const parameterLabels: Record<
  keyof DynamicsParameters,
  { name: string; unit: string; step: number }
> = {
  shortOmega: { name: "短周期固有频率 ωn", unit: "rad/s", step: 0.05 },
  shortZeta: { name: "短周期阻尼比 ζ", unit: "无量纲", step: 0.01 },
  phugoidOmega: { name: "长周期固有频率 ωn", unit: "rad/s", step: 0.01 },
  phugoidZeta: { name: "长周期阻尼比 ζ", unit: "无量纲", step: 0.01 },
  dutchOmega: { name: "荷兰滚固有频率 ωn", unit: "rad/s", step: 0.05 },
  dutchZeta: { name: "荷兰滚阻尼比 ζ", unit: "无量纲", step: 0.01 },
  rollDecay: { name: "滚转衰减率 aR", unit: "s⁻¹", step: 0.05 },
  spiralRate: { name: "螺旋增长率 aS", unit: "s⁻¹", step: 0.005 },
  amplitude: {
    name: "初始幅值（角度/角速度）",
    unit: "rad / rad/s",
    step: 0.005,
  },
};
const colors = ["#147b72", "#398aac", "#be8150", "#8a74b3"];
const stabilityText = {
  stable: "渐近稳定：全部实部 < 0",
  marginal: "临界：存在零实部，无正实部",
  unstable: "失稳：存在正实部",
};
type Snapshot = {
  p: DynamicsParameters;
  experiment: ModalExperiment;
  duration: number;
  index: number;
};
type PlotRow = Record<string, number | null>;
const numberText = (value: number, digits = 3) =>
  Math.abs(value) < 1e-10 ? "0" : value.toFixed(digits);
function Parameter({
  id,
  name,
  unit,
  min,
  max,
  step,
  value,
  onChange,
  onError,
}: {
  id: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  function commit() {
    const parsed = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(parsed) ||
      parsed < min ||
      parsed > max
    ) {
      setInvalid(true);
      onError(`${name}请输入 ${min}–${max} ${unit} 范围的有限数值`);
      return;
    }
    setInvalid(false);
    onError("");
    if (parsed !== value) onChange(parsed);
  }
  return (
    <div className="dyn-parameter">
      <label htmlFor={`${id}-range`}>
        {name}
        <small>{unit}</small>
      </label>
      <input
        type="number"
        aria-label={`${name}数值`}
        aria-invalid={invalid}
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          setInvalid(false);
          onError("");
          onChange(Number(e.target.value));
        }}
      />
      <div className="dyn-range">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
function matrixLatex(matrix: number[][]) {
  return `\\begin{bmatrix}${matrix.map((row) => row.map((v) => numberText(v, 4)).join("&")).join("\\\\")}\\end{bmatrix}`;
}
function EigenvaluePlane({ roots }: { roots: Eigenvalue[] }) {
  const minX = Math.min(-0.3, ...roots.map((r) => r.real)) * 1.25;
  const maxX = Math.max(0.3, ...roots.map((r) => r.real)) * 1.25;
  const maxY = Math.max(0.3, ...roots.map((r) => Math.abs(r.imaginary))) * 1.25;
  const x = (v: number) => 54 + ((v - minX) / (maxX - minX)) * 380;
  const y = (v: number) => 238 - ((v + maxY) / (2 * maxY)) * 190;
  const unique = [...new Set(roots.map((r) => `${r.real},${r.imaginary}`))].map(
    (key) => {
      const indices = roots
        .map((r, i) => (`${r.real},${r.imaginary}` === key ? i + 1 : -1))
        .filter((i) => i > 0);
      return { root: roots[indices[0] - 1], indices };
    },
  );
  return (
    <div className="dyn-eigen-plane">
      <svg
        viewBox="0 0 500 280"
        role="img"
        aria-label="连续系统特征值平面，横轴实部、纵轴虚部，均为每秒；左半平面衰减，右半平面增长"
      >
        <rect x="54" y="48" width={x(0) - 54} height="190" fill="var(--soft)" />
        {[0, 1, 2, 3, 4].map((i) => {
          const vx = minX + ((maxX - minX) * i) / 4,
            vy = -maxY + (2 * maxY * i) / 4;
          return (
            <g key={i}>
              <line
                x1={x(vx)}
                x2={x(vx)}
                y1="48"
                y2="238"
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <line
                x1="54"
                x2="434"
                y1={y(vy)}
                y2={y(vy)}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={x(vx)}
                y="254"
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {numberText(vx, 2)}
              </text>
              <text
                x="46"
                y={y(vy) + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted)"
              >
                {numberText(vy, 2)}
              </text>
            </g>
          );
        })}
        <line x1="54" x2="444" y1={y(0)} y2={y(0)} stroke="var(--muted)" />
        <line x1={x(0)} x2={x(0)} y1="40" y2="238" stroke="var(--muted)" />
        <text
          x="244"
          y="275"
          textAnchor="middle"
          fontSize="11"
          fill="var(--text)"
        >
          Re λ [s⁻¹]
        </text>
        <text x="20" y="32" fontSize="11" fill="var(--text)">
          Im λ [s⁻¹]
        </text>
        <text x="57" y="33" fontSize="10" fill="var(--accent)">
          左半平面：衰减
        </text>
        <text x="345" y="33" fontSize="10" fill="#be8150">
          右半平面：增长
        </text>
        {unique.map(({ root, indices }) => (
          <g key={indices.join(",")}>
            <circle
              cx={x(root.real)}
              cy={y(root.imaginary)}
              r="5"
              fill={
                root.real > 0
                  ? "#be8150"
                  : root.real < 0
                    ? "#147b72"
                    : "#398aac"
              }
              stroke="var(--panel)"
              strokeWidth="1.5"
            />
            <text
              x={x(root.real) + 8}
              y={y(root.imaginary) - 8}
              fontSize="10"
              fill="var(--text)"
            >
              λ{indices.join(",")}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function TimeChart({
  title,
  unit,
  rows,
  states,
  saved,
}: {
  title: string;
  unit: string;
  rows: PlotRow[];
  states: { key: number; name: string }[];
  saved: boolean;
}) {
  return (
    <div className="dyn-chart-card">
      <h4>{title}</h4>
      <div
        className="dyn-chart"
        role="img"
        aria-label={`${title}，横轴时间秒，纵轴${unit}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 4, right: 12, bottom: 18, left: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              type="number"
              dataKey="t"
              domain={[0, "dataMax"]}
              tick={{ fontSize: 10 }}
              label={{
                value: "t [s]",
                position: "insideBottom",
                offset: -10,
                fontSize: 10,
              }}
            />
            <YAxis
              width={62}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => numberText(v, 3)}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                background: "var(--panel)",
                borderColor: "var(--border)",
              }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v) => Number(v).toFixed(5)}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            {states.map(({ key, name }) => (
              <Line
                key={key}
                dataKey={`s${key}`}
                name={name}
                stroke={colors[key]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {saved &&
              states.map(({ key, name }) => (
                <Line
                  key={`saved${key}`}
                  dataKey={`saved${key}`}
                  name={`保存 · ${name}`}
                  stroke={colors[key]}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function PhasePlane({
  current,
  saved,
  coordinate,
  label,
}: {
  current: DynamicsSample[];
  saved: DynamicsSample[];
  coordinate: number;
  label: string;
}) {
  const all = [...current, ...saved];
  const maxX =
    Math.max(0.005, ...all.map((s) => Math.abs(s.state[coordinate]))) * 1.12;
  const maxY =
    Math.max(0.005, ...all.map((s) => Math.abs(s.state[coordinate + 1]))) *
    1.12;
  const x = (v: number) => 50 + ((v + maxX) / (2 * maxX)) * 380;
  const y = (v: number) => 235 - ((v + maxY) / (2 * maxY)) * 180;
  const path = (rows: DynamicsSample[]) =>
    rows
      .filter(
        (_, i) =>
          i % Math.max(1, Math.ceil(rows.length / 600)) === 0 ||
          i === rows.length - 1,
      )
      .map((s) => `${x(s.state[coordinate])},${y(s.state[coordinate + 1])}`)
      .join(" ");
  const last = current.at(-1)!;
  return (
    <div className="dyn-chart-card">
      <h4>{label}相平面</h4>
      <svg
        className="dyn-phase"
        viewBox="0 0 500 280"
        role="img"
        aria-label={`${label}相平面，横轴模态角度rad，纵轴模态角速度rad/s，实线当前，虚线保存`}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const vx = -maxX + (maxX * i) / 2,
            vy = -maxY + (maxY * i) / 2;
          return (
            <g key={i}>
              <line
                x1={x(vx)}
                x2={x(vx)}
                y1="55"
                y2="235"
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <line
                x1="50"
                x2="430"
                y1={y(vy)}
                y2={y(vy)}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={x(vx)}
                y="251"
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {numberText(vx)}
              </text>
              <text
                x="42"
                y={y(vy) + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted)"
              >
                {numberText(vy)}
              </text>
            </g>
          );
        })}
        <line x1="50" x2="430" y1={y(0)} y2={y(0)} stroke="var(--muted)" />
        <line x1={x(0)} x2={x(0)} y1="55" y2="235" stroke="var(--muted)" />
        {saved.length > 0 && (
          <polyline
            points={path(saved)}
            fill="none"
            stroke="#8a74b3"
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
        )}
        <polyline
          points={path(current)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle
          cx={x(last.state[coordinate])}
          cy={y(last.state[coordinate + 1])}
          r="4"
          fill="var(--accent)"
        />
        <text
          x="240"
          y="274"
          textAnchor="middle"
          fontSize="11"
          fill="var(--text)"
        >
          η [rad]
        </text>
        <text x="20" y="34" fontSize="11" fill="var(--text)">
          η̇ [rad/s]
        </text>
      </svg>
      <p className="dyn-caption">
        轨迹指向原点表示衰减；闭合椭圆为无阻尼；向外展开表示增长。坐标为模态幅值。
      </p>
    </div>
  );
}

export default function DynamicsLab({
  onTask,
  initialExperiment = "longitudinal",
}: {
  onTask: (id: string) => void;
  initialExperiment?: string;
}) {
  const [experiment, setExperiment] = useState<DynamicsExperiment>(
    initialExperiment === "coordinates" || initialExperiment === "lateral"
      ? initialExperiment
      : "longitudinal",
  );
  const [p, setP] = useState<DynamicsParameters>({ ...dynamicsDefaults });
  const [angles, setAngles] = useState<CoordinateState>({
    roll: 0,
    pitch: 0,
    yaw: 0,
  });
  const [duration, setDuration] = useState(40);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [recorded, setRecorded] = useState<string[]>([]);
  const modalExperiment: ModalExperiment =
    experiment === "lateral" ? "lateral" : "longitudinal";
  const system = useMemo(
    () => modalSystem(modalExperiment, p),
    [modalExperiment, p],
  );
  const trajectory = useMemo(
    () => simulateModal(system, duration),
    [system, duration],
  );
  const currentIndex = Math.min(index, trajectory.samples.length - 1);
  const visible = useMemo(
    () => trajectory.samples.slice(0, currentIndex + 1),
    [trajectory, currentIndex],
  );
  const current = trajectory.samples[currentIndex];
  const coordinate = useMemo(() => coordinateModel(angles), [angles]);
  const aircraftP = { ...defaults, ...angles };
  const sameSnapshot =
    snapshot?.experiment === modalExperiment ? snapshot : null;
  const saved = useMemo(
    () =>
      sameSnapshot
        ? simulateModal(
            modalSystem(sameSnapshot.experiment, sameSnapshot.p),
            sameSnapshot.duration,
          ).samples.slice(0, sameSnapshot.index + 1)
        : [],
    [sameSnapshot],
  );
  const rows = useMemo(() => {
    const length = Math.max(visible.length, saved.length),
      stride = Math.max(1, Math.ceil(length / 600));
    const result: PlotRow[] = [];
    const indices = new Set([visible.length - 1, saved.length - 1, length - 1]);
    for (let i = 0; i < length; i += stride) indices.add(i);
    for (const i of [...indices].filter((i) => i >= 0).sort((a, b) => a - b)) {
      const row: PlotRow = { t: i * DYNAMICS_STEP };
      for (let j = 0; j < 4; j++) {
        row[`s${j}`] = visible[i]?.state[j] ?? null;
        row[`saved${j}`] = saved[i]?.state[j] ?? null;
      }
      result.push(row);
    }
    return result;
  }, [visible, saved]);
  function resetTime() {
    setRunning(false);
    setIndex(0);
    setError("");
  }
  function changeExperiment(value: DynamicsExperiment) {
    resetTime();
    setExperiment(value);
    setPhase(0);
    setDuration(value === "lateral" ? 60 : 40);
  }
  useEffect(() => {
    const value =
      initialExperiment === "coordinates" || initialExperiment === "lateral"
        ? initialExperiment
        : "longitudinal";
    changeExperiment(value);
  }, [initialExperiment]);
  useEffect(() => {
    if (!running) return;
    let frame = 0,
      last: number | null = null,
      accumulator = 0;
    function tick(timestamp: number) {
      if (last !== null)
        accumulator += Math.min((timestamp - last) / 1000, 0.1) * speed;
      last = timestamp;
      const steps = Math.floor(accumulator / DYNAMICS_STEP);
      if (steps) {
        accumulator -= steps * DYNAMICS_STEP;
        setIndex((old) => Math.min(old + steps, trajectory.samples.length - 1));
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, trajectory]);
  useEffect(() => {
    if (currentIndex === trajectory.samples.length - 1) setRunning(false);
  }, [currentIndex, trajectory]);
  const taskId =
    experiment === "coordinates"
      ? "dynamics-coordinate"
      : experiment === "longitudinal"
        ? "dynamics-damping"
        : "dynamics-lateral";
  const taskReady =
    experiment === "coordinates"
      ? angles.pitch >= 20 &&
        angles.yaw >= 30 &&
        coordinate.orthogonalityError < 1e-10
      : experiment === "longitudinal"
        ? p.shortZeta >= 0.7 &&
          Math.abs(p.shortOmega - 3) < 1e-10 &&
          current.t >= 2
        : p.spiralRate > 0 && current.t >= 5;
  const taskPrompt =
    experiment === "coordinates"
      ? "设置 θ ≥ +20°、ψ ≥ +30°，验证旋转保持向量长度与正交性，然后记录。"
      : experiment === "longitudinal"
        ? "保持 ωn = 3 rad/s，将短周期阻尼比 ζ 调至 0.70 或更高，运行至少 2 s，观察特征值与时程后记录。"
        : "令螺旋增长率 aS > 0，运行至少 5 s，比较独立的荷兰滚、滚转衰减与螺旋增长后记录。";
  function recordTask() {
    if (!taskReady) return;
    onTask(taskId);
    setRecorded((old) => (old.includes(taskId) ? old : [...old, taskId]));
  }
  function downloadCsv() {
    const csv = dynamicsCsv(system, {
      ...trajectory,
      samples: visible,
      termination:
        currentIndex === trajectory.samples.length - 1
          ? trajectory.termination
          : "complete",
    });
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `modal-${modalExperiment}-${current.t.toFixed(2)}s.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const selectedKeys: (keyof DynamicsParameters)[] =
    experiment === "longitudinal"
      ? ["shortOmega", "shortZeta", "phugoidOmega", "phugoidZeta", "amplitude"]
      : ["dutchOmega", "dutchZeta", "rollDecay", "spiralRate", "amplitude"];
  const largeAmplitude = current.state.some(
    (v, i) => system.stateUnits[i] === "rad" && Math.abs(v) > 0.2,
  );
  const executedGuard =
    trajectory.termination === "display-guard" &&
    currentIndex === trajectory.samples.length - 1;
  return (
    <section className="dynamics-lab">
      <div className="dyn-heading">
        <div>
          <div className="eyebrow">
            PHASE 04 / EQUATIONS & DYNAMIC STABILITY
          </div>
          <h2>运动方程与动态稳定性实验</h2>
          <p>
            从机体坐标到
            NED，再用可检查的状态矩阵观察模态频率、阻尼与连续系统特征值。
          </p>
        </div>
        <span className="dyn-badge">假想参数 · SI</span>
      </div>
      <div className="dyn-tabs" role="tablist" aria-label="动态稳定性实验类型">
        {(Object.keys(names) as DynamicsExperiment[]).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={experiment === value}
            className={experiment === value ? "selected" : ""}
            onClick={() => changeExperiment(value)}
          >
            {names[value]}
          </button>
        ))}
      </div>
      <div className="dyn-layout">
        <div className="dyn-main">
          {experiment === "coordinates" ? (
            <>
              <div className="dyn-coordinate-scene">
                <Aircraft
                  p={aircraftP}
                  forces={aerodynamics(defaults)}
                  motion={initialMotion}
                  axes
                  showForces={false}
                />
              </div>
              <div className="dyn-card">
                <h3>同一个向量，不同坐标分量</h3>
                <p>
                  机体 x 向前、y 向右、z 向下；NED 为北、东、地向下。R = Rz(ψ)
                  Ry(θ) Rx(φ) 把机体分量映射到 NED，三个矩阵的乘法顺序不能交换。
                </p>
                <Formula
                  value={`\\mathbf v_{NED}=R\\mathbf v_B,\\qquad R=${matrixLatex(coordinate.matrix)}`}
                />
                <div className="dyn-vector-grid">
                  {["xB 前", "yB 右", "zB 下"].map((label, col) => (
                    <div key={label}>
                      <span>{label} → (N, E, D)</span>
                      <strong>
                        (
                        {coordinate.matrix
                          .map((row) => numberText(row[col]))
                          .join(", ")}
                        )
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="dyn-caption">
                  以上是三个机体单位基向量的 NED 分量。反向变换使用
                  Rᵀ；旋转改变分量，不改变向量的长度。
                </p>
              </div>
              <div className="dyn-card">
                <h3>Euler 角与四元数</h3>
                <Formula value="\begin{bmatrix}\dot\phi\\\dot\theta\\\dot\psi\end{bmatrix}=\begin{bmatrix}1&\sin\phi\tan\theta&\cos\phi\tan\theta\\0&\cos\phi&-\sin\phi\\0&\sin\phi/\cos\theta&\cos\phi/\cos\theta\end{bmatrix}\begin{bmatrix}p\\q\\r\end{bmatrix}" />
                <p>
                  机体角速度 p、q、r 一般不等于 Euler 角的时间导数。θ = ±90°
                  时上述 Euler
                  速率映射奇异，姿态旋转本身仍然存在。单位四元数用四个分量与单位范数约束描述同一旋转；q
                  与 −q 表示相同姿态。
                </p>
                <p
                  className={
                    coordinate.eulerSingular ? "warning" : "dyn-caption"
                  }
                >
                  {coordinate.eulerSingular
                    ? "当前 Euler 速率映射奇异；R 与四元数仍有效。"
                    : "当前 Euler 速率映射非奇异；接近 ±90° 时条件变差。"}
                </p>
                <code className="dyn-quaternion">
                  (qw, qx, qy, qz) = (
                  {coordinate.quaternion
                    .map((v) => numberText(v, 5))
                    .join(", ")}
                  )
                </code>
              </div>
              <div className="dyn-card">
                <h3>运动方程如何成为线性模型</h3>
                <Formula value="m(\dot{\mathbf v}_B+\boldsymbol\omega_B\times\mathbf v_B)=\mathbf F_B+mR^T\mathbf g_{NED}" />
                <Formula value="I\dot{\boldsymbol\omega}_B+\boldsymbol\omega_B\times(I\boldsymbol\omega_B)=\mathbf M_B,\qquad \dot{\mathbf r}_{NED}=R\mathbf v_B" />
                <p>
                  平动方程包含旋转坐标系的 ω × v
                  项；转动方程包含角动量的陀螺项。F
                  包括气动与推进力，重力单独列出；M
                  是质心处的外力矩。这里展示飞机方程，下面用独立的非线性振子实际计算局部
                  Jacobian。
                </p>
                <Formula value="\dot{\mathbf x}=f(\mathbf x,\mathbf u),\qquad \delta\dot{\mathbf x}=A\delta\mathbf x+B\delta\mathbf u,\qquad A=\left.\frac{\partial f}{\partial\mathbf x}\right|_{trim},\quad B=\left.\frac{\partial f}{\partial\mathbf u}\right|_{trim}" />
                <p>
                  在满足相应配平条件的参考运动附近作一阶展开；对定常运动，先选择让配平成为平衡点的状态或误差坐标。忽略二阶及更高扰动项，才能得到局部线性模型。纵向与横侧向模态实验使用给定的约化矩阵，不声称从真实飞机导数求出。
                </p>
              </div>
              <LinearizationDemo />
            </>
          ) : (
            <>
              <div className="dyn-card dyn-scope">
                <h3>{names[experiment]} · 独立约化模态</h3>
                <p>
                  η 是假想模态角幅值，η̇ 为其变化率；横侧向另含滚转角速度幅值 pR
                  与螺旋角幅值 φS。各块独立积分，未模拟真实飞机 α、q、β、r
                  的气动耦合。ζ 可为负，允许观察连续模型的物理增长。
                </p>
                <Formula value="\ddot\eta+2\zeta\omega_n\dot\eta+\omega_n^2\eta=0,\qquad \lambda=-\zeta\omega_n\pm\omega_n\sqrt{\zeta^2-1}" />
                {experiment === "lateral" && (
                  <Formula value="\dot p_R=-a_Rp_R,\quad\lambda_R=-a_R;\qquad\dot\phi_S=a_S\phi_S,\quad\lambda_S=a_S" />
                )}
              </div>
              <div className="dyn-toolbar">
                <button
                  className={running ? "selected" : ""}
                  disabled={currentIndex === trajectory.samples.length - 1}
                  onClick={() => setRunning((old) => !old)}
                >
                  {running ? "暂停" : "播放"}
                </button>
                <button
                  disabled={
                    running || currentIndex === trajectory.samples.length - 1
                  }
                  onClick={() =>
                    setIndex((old) =>
                      Math.min(old + 1, trajectory.samples.length - 1),
                    )
                  }
                >
                  单步 0.01 s
                </button>
                <button onClick={resetTime}>重置时程</button>
                <button
                  onClick={() => {
                    setRunning(false);
                    setIndex(trajectory.samples.length - 1);
                  }}
                >
                  计算至终点
                </button>
                <label>
                  播放速度
                  <select
                    aria-label="动态实验播放速度"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    {[0.5, 1, 2, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}×
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  积分时长
                  <select
                    aria-label="动态实验积分时长"
                    value={duration}
                    onChange={(e) => {
                      resetTime();
                      setDuration(Number(e.target.value));
                    }}
                  >
                    {[12, 40, 60, 120].map((value) => (
                      <option key={value} value={value}>
                        {value} s
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="dyn-status" role="status">
                <strong>t = {current.t.toFixed(2)} s</strong>
                <span>RK4 · 固定 h = 0.01 s · {currentIndex} 步</span>
                <span className={`dyn-stability ${system.stability}`}>
                  {stabilityText[system.stability]}
                </span>
              </div>
              {executedGuard && (
                <p className="warning" role="alert">
                  图表范围保护已停止时程：{trajectory.message}
                </p>
              )}
              {largeAmplitude && (
                <p className="dyn-limit">
                  角幅值超过 0.2
                  rad。线性方程仍可演算，但小扰动近似不能据此预测真实飞机的大幅运动。
                </p>
              )}
              <div className="dyn-state-grid">
                {system.stateNames.map((name, i) => (
                  <div key={name}>
                    <span>
                      {name} [{system.stateUnits[i]}]
                    </span>
                    <strong>{numberText(current.state[i], 5)}</strong>
                  </div>
                ))}
              </div>
              <div className="dyn-charts">
                <TimeChart
                  title="模态角幅值时程"
                  unit="rad"
                  rows={rows}
                  states={
                    experiment === "longitudinal"
                      ? [
                          { key: 0, name: "短周期 ηSP" },
                          { key: 2, name: "长周期 ηPH" },
                        ]
                      : [
                          { key: 0, name: "荷兰滚 ηDR" },
                          { key: 3, name: "螺旋 φS" },
                        ]
                  }
                  saved={saved.length > 0}
                />
                <TimeChart
                  title="模态角速度时程"
                  unit="rad/s"
                  rows={rows}
                  states={
                    experiment === "longitudinal"
                      ? [
                          { key: 1, name: "短周期 η̇SP" },
                          { key: 3, name: "长周期 η̇PH" },
                        ]
                      : [
                          { key: 1, name: "荷兰滚 η̇DR" },
                          { key: 2, name: "滚转 pR" },
                        ]
                  }
                  saved={saved.length > 0}
                />
              </div>
              <div className="dyn-phase-selector">
                {experiment === "longitudinal" && (
                  <label>
                    相平面模态
                    <select
                      aria-label="相平面模态"
                      value={phase}
                      onChange={(e) => setPhase(Number(e.target.value))}
                    >
                      <option value={0}>短周期</option>
                      <option value={2}>长周期</option>
                    </select>
                  </label>
                )}
                <span>
                  时程只显示已播放/计算的部分，图表抽样不改变积分步长。
                </span>
              </div>
              <div className="dyn-charts">
                <PhasePlane
                  current={visible}
                  saved={saved}
                  coordinate={experiment === "lateral" ? 0 : phase}
                  label={
                    experiment === "lateral"
                      ? "荷兰滚"
                      : phase === 0
                        ? "短周期"
                        : "长周期"
                  }
                />
                <div className="dyn-chart-card">
                  <h4>特征值平面 · 连续模型</h4>
                  <EigenvaluePlane roots={system.eigenvalues} />
                  <p className="dyn-caption">
                    坐标是 λ 的实部、虚部
                    [s⁻¹]，未按固有频率归一化。重根在同一点标注多个编号。
                  </p>
                </div>
              </div>
              <div className="dyn-card">
                <h3>完整状态矩阵与特征值</h3>
                <Formula
                  value={`\\dot{\\mathbf x}=A\\mathbf x,\\qquad A=${matrixLatex(system.matrix)}`}
                />
                <p className="dyn-caption">
                  x = [{system.stateNames.join(", ")}]ᵀ；各状态单位依次为 [
                  {system.stateUnits.join(", ")}]。Aij 的单位为
                  xi/(xj·s)，并非每一项都是 s⁻¹。此实验没有控制输入，δu = 0。
                </p>
                <div className="dyn-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>编号 / 模态</th>
                        <th>Re λ [s⁻¹]</th>
                        <th>Im λ [s⁻¹]</th>
                        <th>趋势</th>
                      </tr>
                    </thead>
                    <tbody>
                      {system.eigenvalues.map((root, i) => (
                        <tr key={i}>
                          <th>
                            λ{i + 1} · {root.mode}
                          </th>
                          <td>{numberText(root.real, 5)}</td>
                          <td>{numberText(root.imaginary, 5)}</td>
                          <td>
                            {root.real < 0
                              ? "衰减"
                              : root.real > 0
                                ? "增长"
                                : "不衰减"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="dyn-caption">
                  欠阻尼周期 Td = 2π/(ωn√(1−ζ²))；ζ = 1 为临界阻尼重根，ζ &gt; 1
                  为两个实根。负阻尼对应增长，不能把数值范围保护当作物理失稳的判据。
                </p>
              </div>
              <div className="dyn-export">
                <button disabled={currentIndex === 0} onClick={downloadCsv}>
                  导出当前时程 CSV
                </button>
                <button
                  disabled={currentIndex === 0}
                  onClick={() =>
                    setSnapshot({
                      p: { ...p },
                      experiment: modalExperiment,
                      duration,
                      index: currentIndex,
                    })
                  }
                >
                  保存参数与时程快照
                </button>
                {snapshot && (
                  <button onClick={() => setSnapshot(null)}>清除快照</button>
                )}
              </div>
              {snapshot && (
                <div className="dyn-card">
                  <h3>已保存「{names[snapshot.experiment]}」对比</h3>
                  <p>
                    {sameSnapshot
                      ? "虚线为保存参数的已计算时程；实线为当前时程。改变参数会从 t = 0 重新开始，先运行或计算至终点再比较。"
                      : "切换至保存的实验类型查看对比。"}
                  </p>
                  <p className="dyn-caption">
                    保存至 t = {(snapshot.index * DYNAMICS_STEP).toFixed(2)} s；
                    {snapshot.experiment === "longitudinal"
                      ? `短周期 ωn ${snapshot.p.shortOmega} rad/s、ζ ${snapshot.p.shortZeta}；长周期 ωn ${snapshot.p.phugoidOmega} rad/s、ζ ${snapshot.p.phugoidZeta}`
                      : `荷兰滚 ωn ${snapshot.p.dutchOmega} rad/s、ζ ${snapshot.p.dutchZeta}；aR ${snapshot.p.rollDecay} s⁻¹；aS ${snapshot.p.spiralRate} s⁻¹`}
                    ；初始幅值 {snapshot.p.amplitude}。
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <aside className="dyn-parameters">
          <div className="dyn-parameter-heading">
            <h3>{experiment === "coordinates" ? "姿态角" : "模态参数"}</h3>
            <button
              onClick={() => {
                resetTime();
                if (experiment === "coordinates")
                  setAngles({ roll: 0, pitch: 0, yaw: 0 });
                else setP({ ...dynamicsDefaults });
              }}
            >
              默认值
            </button>
          </div>
          {experiment === "coordinates"
            ? (Object.keys(angles) as (keyof CoordinateState)[]).map((key) => (
                <Parameter
                  key={key}
                  id={`dyn-${key}`}
                  name={
                    key === "roll"
                      ? "滚转 φ"
                      : key === "pitch"
                        ? "俯仰 θ"
                        : "航向 ψ"
                  }
                  unit="°"
                  min={key === "pitch" ? -90 : -180}
                  max={key === "pitch" ? 90 : 180}
                  step={1}
                  value={angles[key]}
                  onError={setError}
                  onChange={(value) =>
                    setAngles((old) => ({ ...old, [key]: value }))
                  }
                />
              ))
            : selectedKeys.map((key) => (
                <Parameter
                  key={key}
                  id={`dyn-${key}`}
                  {...parameterLabels[key]}
                  min={dynamicsBounds[key][0]}
                  max={dynamicsBounds[key][1]}
                  value={p[key]}
                  onError={setError}
                  onChange={(value) => {
                    resetTime();
                    setP((old) => ({ ...old, [key]: value }));
                  }}
                />
              ))}
          {error && (
            <p className="warning" role="alert">
              {error}
            </p>
          )}
          {experiment === "coordinates" ? (
            <div className="dyn-context">
              <span>max |RRᵀ − I|</span>
              <strong>{coordinate.orthogonalityError.toExponential(2)}</strong>
              <span>det R</span>
              <strong>{coordinate.determinant.toFixed(8)}</strong>
              <span>四元数范数</span>
              <strong>{Math.hypot(...coordinate.quaternion).toFixed(8)}</strong>
            </div>
          ) : (
            <div className="dyn-context">
              <span>参数影响</span>
              <p>
                ωn 决定时间尺度，ζ 决定相对阻尼。默认短周期比长周期快 12
                倍；选择 40–120 s 才能清楚看到长周期。aS
                正值增长、负值衰减、零值保持。
              </p>
              <p>
                初始 ηSP、ηPH、ηDR、φS 取同一角幅值；η̇ 为零，pR 取同一数值的
                rad/s。没有额外持续激励。
              </p>
            </div>
          )}
          <div className={`dyn-task${taskReady ? " ready" : ""}`}>
            <div className="eyebrow">小实验 / 探索任务</div>
            <p>{taskPrompt}</p>
            <span>
              {taskReady
                ? "✓ 已达到参数与执行条件"
                : "调整参数并执行，达到目标条件"}
            </span>
            <button disabled={!taskReady} onClick={recordTask}>
              {experiment === "coordinates"
                ? "验证并记录坐标实验"
                : "记录动态实验完成"}
            </button>
            {recorded.includes(taskId) && (
              <small role="status">✓ 完成情况已保存到学习进度</small>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
