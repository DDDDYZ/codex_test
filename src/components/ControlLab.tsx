import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Formula } from "./Formula";
import { DEG } from "../physics/models";
import {
  controlDefaults,
  controllerOutput,
  initialControlState,
  responseMetrics,
  sampleControl,
  stepControl,
  type ControlParameters,
  type ControlState,
} from "../physics/control";
import {
  autopilotCommand,
  autopilotDefaults,
  initialAutopilotState,
  stepAutopilot,
  type AutopilotParameters,
  type AutopilotState,
} from "../physics/autopilot";
import {
  initialSixDofState,
  matrixVector,
  quaternionEuler,
  quaternionMatrix,
  sixDofControls,
  sixDofDefaults,
  sixDofLoads,
  stepSixDof,
  type SixDofControls,
  type SixDofState,
  type Vec3,
} from "../physics/sixDof";
import "../control.css";

export type ControlExperiment = "pid" | "autopilot" | "sixdof";
type Row = Record<string, number>;
type Series = {
  key: string;
  label: string;
  color: string;
  axis?: string;
  dashed?: boolean;
};
const fmt = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
const names: Record<ControlExperiment, string> = {
  pid: "俯仰控制",
  autopilot: "高度与速度保持",
  sixdof: "六自由度仿真",
};

function NumericControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(Number(value.toFixed(5))));
    setInvalid(false);
  }, [value]);
  function accept() {
    const text = draft.trim();
    const numeric = Number(text);
    if (
      text === "" ||
      !Number.isFinite(numeric) ||
      numeric < min ||
      numeric > max
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(numeric);
  }
  return (
    <div className="ctl-input">
      <label>
        {label}
        <span>{unit}</span>
        <input
          type="number"
          aria-label={`${label}数值`}
          value={draft}
          min={min}
          max={max}
          step={step}
          aria-invalid={invalid}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={accept}
          onKeyDown={(event) => {
            if (event.key === "Enter") accept();
          }}
        />
        <input
          type="range"
          aria-label={`${label} 滑块`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            setInvalid(false);
            onChange(Number(event.target.value));
          }}
        />
      </label>
      {invalid && (
        <small role="alert">
          请输入 {min} 至 {max} 的有限数值。
        </small>
      )}
    </div>
  );
}

function TimeChart({
  title,
  rows,
  series,
  unit,
  rightUnit,
}: {
  title: string;
  rows: Row[];
  series: Series[];
  unit: string;
  rightUnit?: string;
}) {
  return (
    <div className="ctl-chart-card">
      <h4>{title}</h4>
      <div
        className="ctl-chart"
        role="img"
        aria-label={`${title}；横轴时间秒；纵轴${unit}${rightUnit ? `；右轴${rightUnit}` : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 18, left: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, "dataMax"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmt(Number(v), 1)}
              label={{
                value: "时间 [s]",
                position: "insideBottom",
                offset: -10,
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="left"
              width={52}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmt(Number(v), 1)}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
            />
            {rightUnit && (
              <YAxis
                yAxisId="right"
                orientation="right"
                width={48}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => fmt(Number(v), 1)}
                label={{
                  value: rightUnit,
                  angle: 90,
                  position: "insideRight",
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                borderColor: "var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(v) => `${fmt(Number(v))} s`}
              formatter={(v) => fmt(Number(v), 3)}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                yAxisId={s.axis ?? "left"}
                stroke={s.color}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeWidth={2}
                type="linear"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function exportCsv(rows: Row[], fileName: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const content = `${keys.join(",")}\n${rows.map((row) => keys.map((key) => row[key]).join(",")).join("\n")}\n`;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function compareRows(rows: Row[], saved: Row[] | null, keys: string[]) {
  const byTime = new Map(saved?.map((row) => [row.time.toFixed(5), row]));
  return rows.map((row) => {
    const previous = byTime.get(row.time.toFixed(5));
    return {
      ...row,
      ...(previous
        ? Object.fromEntries(keys.map((key) => [`saved_${key}`, previous[key]]))
        : {}),
    };
  });
}
function RunBar({
  running,
  rate,
  setRate,
  setRunning,
  reset,
  step,
  save,
  csv,
  hasRows,
  time,
  stopAt,
}: {
  running: boolean;
  rate: number;
  setRate: (n: number) => void;
  setRunning: (b: boolean) => void;
  reset: () => void;
  step: () => void;
  save: () => void;
  csv: () => void;
  hasRows: boolean;
  time: number;
  stopAt: number;
}) {
  return (
    <div className="ctl-runbar">
      <button
        className="primary"
        onClick={() => setRunning(!running)}
        disabled={!running && time >= stopAt}
      >
        {running ? "暂停" : "运行"}
      </button>
      <button onClick={step} disabled={running || time >= stopAt}>
        单步 +0.01 s
      </button>
      <button onClick={reset}>重置</button>
      <label>
        播放速度{" "}
        <select
          aria-label="播放速度"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </label>
      <span>t = {fmt(time)} s</span>
      <button disabled={!hasRows} onClick={save}>
        保存响应快照
      </button>
      <button disabled={!hasRows} onClick={csv}>
        导出 CSV
      </button>
    </div>
  );
}

/** Integration uses fixed 0.01 s substeps; playback speed changes the number of substeps, never dt. */
function useSimulation<S extends { time: number }>(
  initial: () => S,
  stepper: (s: S) => S,
  sample: (s: S) => Row,
  stopAt: number,
) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(state);
  const [rows, setRows] = useState<Row[]>(() => [sample(state)]);
  const rowsRef = useRef(rows);
  const [running, setRunning] = useState(false),
    [rate, setRate] = useState(1),
    [error, setError] = useState("");
  const stepRef = useRef(stepper);
  stepRef.current = stepper;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  function reset() {
    const next = initial();
    stateRef.current = next;
    setState(next);
    const data = [sampleRef.current(next)];
    rowsRef.current = data;
    setRows(data);
    setRunning(false);
    setError("");
  }
  function advance(count: number, recordEveryStep = false) {
    let next = stateRef.current;
    const newRows: Row[] = [];
    try {
      for (let i = 0; i < count; i++) {
        if (next.time >= stopAt - 1e-8) {
          setRunning(false);
          break;
        }
        next = stepRef.current(next);
        if (recordEveryStep || Math.round(next.time / 0.01) % 5 === 0)
          newRows.push(sampleRef.current(next));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "计算失败，请重置");
      setRunning(false);
    }
    stateRef.current = next;
    setState(next);
    if (newRows.length) {
      rowsRef.current = [...rowsRef.current, ...newRows];
      setRows(rowsRef.current);
    }
  }
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => advanceRef.current(5 * rate), 50);
    return () => window.clearInterval(timer);
  }, [running, rate]);
  return {
    state,
    rows,
    running,
    rate,
    error,
    setRate,
    setRunning,
    reset,
    step: () => advance(1, true),
  };
}

function PitchPlant({ theta, actuator }: { theta: number; actuator: number }) {
  return (
    <div className="ctl-attitude">
      <div className="ctl-visual-label">俯仰单通道 · 侧视示意</div>
      <svg
        viewBox="0 0 440 200"
        role="img"
        aria-label={`实际俯仰角 ${fmt(theta / DEG)} 度；虚拟抬头操纵量 ${fmt(actuator / DEG)} 度`}
      >
        <path d="M 20 125 H 420" stroke="var(--border)" strokeDasharray="5 5" />
        <text x="28" y="145" fill="var(--muted)" fontSize="11">
          水平参考
        </text>
        <g transform={`rotate(${-theta / DEG} 220 108)`}>
          <path
            d="M 153 113 L 160 98 L 205 104 L 237 78 L 249 79 L 235 105 L 282 107 Q 302 110 282 116 L 235 120 L 217 146 L 204 146 L 211 120 L 168 120 Z"
            fill="var(--soft)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <path
            d="M 160 103 l -19 0"
            stroke="#be8150"
            strokeWidth="4"
            transform={`rotate(${actuator / DEG} 160 103)`}
          />
          <text x="292" y="100" fill="var(--accent)" fontSize="11">
            机头 →
          </text>
        </g>
        <text
          x="220"
          y="181"
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted)"
        >
          θ {fmt(theta / DEG)}° · u {fmt(actuator / DEG)}°
        </text>
      </svg>
    </div>
  );
}

function PidExperiment({ onTask }: { onTask: (id: string) => void }) {
  const [p, setP] = useState<ControlParameters>({ ...controlDefaults });
  const sample = (s: ControlState): Row => {
    const command = controllerOutput(s, p);
    return {
      ...sampleControl(s, p),
      theta_deg: s.theta / DEG,
      target_deg: p.target / DEG,
      actuator_deg: s.actuator / DEG,
      command_deg: command.limited / DEG,
      raw_command_rad: command.requested,
      q_rad_s: s.rate,
      integral_rad_s: s.integral,
    };
  };
  const sim = useSimulation(
    () => ({ ...initialControlState }),
    (s: ControlState) => stepControl(s, p),
    sample,
    30,
  );
  const [snapshot, setSnapshot] = useState<{
    rows: Row[];
    label: string;
  } | null>(null);
  const [recorded, setRecorded] = useState(false);
  const pendingReset = useRef(false);
  useEffect(() => {
    if (pendingReset.current) {
      sim.reset();
      setRecorded(false);
      pendingReset.current = false;
    }
  }, [p]);
  const change = <K extends keyof ControlParameters>(
    key: K,
    value: ControlParameters[K],
  ) => {
    pendingReset.current = true;
    setP((old) => ({ ...old, [key]: value }));
  };
  const command = controllerOutput(sim.state, p);
  const metrics = responseMetrics(
    sim.rows.map((r) => ({
      time: r.time,
      theta: r.theta,
      target: r.target,
      actuator: r.actuator,
      error: r.error,
    })),
    p.gust === 0,
  );
  const chartRows = useMemo(
    () => compareRows(sim.rows, snapshot?.rows ?? null, ["theta_deg"]),
    [sim.rows, snapshot],
  );
  return (
    <>
      <p className="ctl-intro">
        让真实积分得到的俯仰角追踪目标，观察增益、舵机限幅和持续扰动。此处使用假想二阶俯仰单通道，不是六自由度飞机或可用于飞行的自动驾驶仪。改变参数会从同一初始状态重跑；快照保留上一条响应。
      </p>
      <div className="ctl-layout">
        <aside className="ctl-controls">
          <h3>目标与控制器</h3>
          <label className="ctl-select">
            控制模式
            <select
              aria-label="控制模式"
              value={p.mode}
              onChange={(event) =>
                change("mode", event.target.value as ControlParameters["mode"])
              }
            >
              <option value="manual">手动</option>
              <option value="pid">PID</option>
              <option value="feedback">状态反馈 · θ 与 q</option>
            </select>
          </label>
          <NumericControl
            label="目标俯仰角 θc"
            unit="°"
            min={-30}
            max={30}
            value={p.target / DEG}
            onChange={(v) => change("target", v * DEG)}
          />
          {p.mode === "manual" ? (
            <NumericControl
              label="手动虚拟操纵量 u"
              unit="°"
              min={-30}
              max={30}
              value={p.manual / DEG}
              onChange={(v) => change("manual", v * DEG)}
            />
          ) : (
            <>
              <NumericControl
                label="比例增益 Kp"
                unit="1"
                min={0}
                max={12}
                step={0.1}
                value={p.kp}
                onChange={(v) => change("kp", v)}
              />
              {p.mode === "pid" && (
                <NumericControl
                  label="积分增益 Ki"
                  unit="s⁻¹"
                  min={0}
                  max={8}
                  step={0.1}
                  value={p.ki}
                  onChange={(v) => change("ki", v)}
                />
              )}
              <NumericControl
                label="角速度反馈 Kd"
                unit="s"
                min={0}
                max={8}
                step={0.1}
                value={p.kd}
                onChange={(v) => change("kd", v)}
              />
            </>
          )}
          <h3>模型与约束</h3>
          <NumericControl
            label="固有频率 ωn"
            unit="rad/s"
            min={0.2}
            max={5}
            step={0.1}
            value={p.naturalFrequency}
            onChange={(v) => change("naturalFrequency", v)}
          />
          <NumericControl
            label="阻尼比 ζ"
            unit="1"
            min={0}
            max={2}
            step={0.05}
            value={p.damping}
            onChange={(v) => change("damping", v)}
          />
          <NumericControl
            label="虚拟操纵量限幅"
            unit="±°"
            min={1}
            max={30}
            value={p.actuatorLimit / DEG}
            onChange={(v) => change("actuatorLimit", v * DEG)}
          />
          <NumericControl
            label="3 s 起的持续俯仰扰动"
            unit="rad/s²"
            min={-2}
            max={2}
            step={0.05}
            value={p.gust}
            onChange={(v) => change("gust", v)}
          />
          <small>
            控制效应 K = 4 s⁻²；执行器一阶滞后 0.05 s，最大速率 60°/s。u
            是虚拟抬头操纵量，用等效角度表示；机械升降舵后缘向下为正时 δe =
            −u。积分只在向位置饱和继续推动时冻结，可反向解饱和。状态反馈不含积分，恒定目标通常保留稳态误差。
          </small>
        </aside>
        <div className="ctl-output">
          <RunBar
            {...sim}
            time={sim.state.time}
            stopAt={30}
            hasRows={sim.rows.length > 1}
            save={() =>
              setSnapshot({
                rows: sim.rows.map((r) => ({ ...r })),
                label: `${p.mode}，目标 ${fmt(p.target / DEG, 1)}°，Kp ${p.kp} / Ki ${p.ki} / Kd ${p.kd}`,
              })
            }
            csv={() => exportCsv(sim.rows, "pitch-control-SI.csv")}
          />
          {sim.error && (
            <div className="ctl-warning" role="alert">
              {sim.error}
            </div>
          )}
          <div className="ctl-metrics">
            <span>
              当前误差
              <strong>
                {fmt(metrics.error === null ? null : metrics.error / DEG)} °
              </strong>
            </span>
            <span>
              采样误差 RMS
              <strong>
                {fmt(metrics.rmsError === null ? null : metrics.rmsError / DEG)}{" "}
                °
              </strong>
            </span>
            <span>
              观测超调<strong>{fmt(metrics.overshoot)} %</strong>
            </span>
            <span>
              观测调节时间<strong>{fmt(metrics.settlingTime)} s</strong>
            </span>
          </div>
          <p className="ctl-status" role="status">
            {command.saturated ? "虚拟操纵指令已限幅" : "虚拟操纵指令在限幅内"}{" "}
            · 原始要求 {fmt(command.requested / DEG)}° → 限幅指令{" "}
            {fmt(command.limited / DEG)}° ·{" "}
            {command.rateLimited
              ? "执行器正在速率限制内运动"
              : "执行器速率未受限"}{" "}
            · RK4 0.01 s · 最长 30 s
          </p>
          <PitchPlant theta={sim.state.theta} actuator={sim.state.actuator} />
          <TimeChart
            title="目标、实际俯仰与虚拟执行器响应"
            rows={chartRows}
            unit="角度 [°]"
            series={[
              {
                key: "target_deg",
                label: "目标 θc",
                color: "#be8150",
                dashed: true,
              },
              { key: "theta_deg", label: "实际 θ", color: "#147b72" },
              {
                key: "command_deg",
                label: "限幅 u 指令",
                color: "#94a7b6",
                dashed: true,
              },
              { key: "actuator_deg", label: "实际虚拟量 u", color: "#398aac" },
              ...(snapshot
                ? [
                    {
                      key: "saved_theta_deg",
                      label: "快照 θ",
                      color: "#8a74b3",
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
          {snapshot && (
            <p className="ctl-snapshot">
              比较快照：{snapshot.label} · {fmt(snapshot.rows.at(-1)?.time)} s{" "}
              <button onClick={() => setSnapshot(null)}>清除快照</button>
            </p>
          )}
          <small>
            超调仅对非零目标阶跃且无扰动报告；调节时间为进入 ±2%
            阶跃幅值误差带后，在已有数据中连续保持至少 1 s
            的首次时刻。它不保证未来永不离开误差带。“—”表示尚未建立或条件不适用。CSV
            的 θ/actuator（虚拟 u）为 rad，另附 *_deg 显示列；RMS 是记录采样点的
            RMS。
          </small>
          <Formula value="\dot\theta=q,\quad \dot q=-2\zeta\omega_n q-\omega_n^2\theta+Ku+d(t)" />
          <Formula value="u_{cmd}=K_p(\theta_c-\theta)+K_i\int e\,dt-K_dq" />
          <button
            className="ctl-task"
            disabled={
              sim.state.time < 4 ||
              p.mode !== "pid" ||
              Math.abs(p.target) < 3 * DEG ||
              recorded
            }
            onClick={() => {
              onTask("control-pid");
              setRecorded(true);
            }}
          >
            {recorded ? "已记录俯仰控制观察" : "记录俯仰控制观察"}
          </button>
          <small>
            使用 PID、非零目标（|θc| ≥ 3°），运行至少 4 s
            后记录；比较误差和舵面约束，无需宣称已收敛。
          </small>
        </div>
      </div>
    </>
  );
}

function AutopilotExperiment({ onTask }: { onTask: (id: string) => void }) {
  const [p, setP] = useState<AutopilotParameters>({ ...autopilotDefaults });
  const sample = (s: AutopilotState): Row => ({
    time: s.time,
    speed: s.speed,
    speedTarget: p.speedTarget,
    height: s.height,
    heightTarget: p.heightTarget,
    gamma_rad: s.gamma,
    gamma_deg: s.gamma / DEG,
    cl: s.cl,
    thrust_N: s.thrust,
    speedIntegral: s.speedIntegral,
    heightIntegral: s.heightIntegral,
  });
  const sim = useSimulation(
    () => ({ ...initialAutopilotState }),
    (s: AutopilotState) => stepAutopilot(s, p),
    sample,
    180,
  );
  const [snapshot, setSnapshot] = useState<Row[] | null>(null),
    [recorded, setRecorded] = useState(false);
  const pendingReset = useRef(false);
  useEffect(() => {
    if (pendingReset.current) {
      sim.reset();
      setRecorded(false);
      pendingReset.current = false;
    }
  }, [p]);
  const change = <K extends keyof AutopilotParameters>(
    key: K,
    value: AutopilotParameters[K],
  ) => {
    pendingReset.current = true;
    setP((old) => ({ ...old, [key]: value }));
  };
  const command = autopilotCommand(sim.state, p);
  const rows = useMemo(
    () => compareRows(sim.rows, snapshot, ["speed", "height"]),
    [sim.rows, snapshot],
  );
  return (
    <>
      <p className="ctl-intro">
        外环把高度误差转成爬升率需求，内环用升力改变航迹角；速度 PI
        用推力补偿阻力和沿航迹重力。状态通过力方程积分得到。此实验是二维点质量模型，不含机体俯仰、滚转或偏航，也不构成六自由度自动驾驶仪。
      </p>
      <div className="ctl-layout">
        <aside className="ctl-controls">
          <h3>保持目标</h3>
          <label className="ctl-toggle">
            <input
              type="checkbox"
              checked={p.speedHold}
              onChange={(e) => change("speedHold", e.target.checked)}
            />
            速度保持 · PI
          </label>
          <NumericControl
            label="目标空速 Vc"
            unit="m/s"
            min={25}
            max={80}
            value={p.speedTarget}
            onChange={(v) => change("speedTarget", v)}
          />
          {!p.speedHold && (
            <NumericControl
              label="手动推力"
              unit="N"
              min={0}
              max={3500}
              step={25}
              value={p.manualThrust}
              onChange={(v) => change("manualThrust", v)}
            />
          )}
          <label className="ctl-toggle">
            <input
              type="checkbox"
              checked={p.heightHold}
              onChange={(e) => change("heightHold", e.target.checked)}
            />
            高度保持 · PI 外环
          </label>
          <NumericControl
            label="目标高度 hc"
            unit="m"
            min={800}
            max={1200}
            step={5}
            value={p.heightTarget}
            onChange={(v) => change("heightTarget", v)}
          />
          {!p.heightHold && (
            <NumericControl
              label="手动升力系数 CL"
              unit="1"
              min={-0.2}
              max={1.4}
              step={0.02}
              value={p.manualCl}
              onChange={(v) => change("manualCl", v)}
            />
          )}
          <NumericControl
            label="3 s 起的垂直风 · 向上为正"
            unit="m/s"
            min={-3}
            max={3}
            step={0.25}
            value={p.windUp}
            onChange={(v) => change("windUp", v)}
          />
          <small>
            假想 m = 1000 kg、S = 16 m²、ρ = 1.225 kg/m³。速度 PI：Kp = 0.6
            s⁻¹、Ki = 0.12 s⁻²；高度 PI：Kh = 0.12 s⁻¹、Kih = 0.004
            s⁻²；航迹内环增益 1.2 s⁻¹。CL 滞后 0.1 s，推力滞后 0.3
            s。爬升需求限制 ±5 m/s，γc 限制 ±10°；T ∈ [0,3500] N、CL ∈
            [−0.2,1.4]。限制出现时阻止进一步积分饱和。
          </small>
        </aside>
        <div className="ctl-output">
          <RunBar
            {...sim}
            time={sim.state.time}
            stopAt={180}
            hasRows={sim.rows.length > 1}
            save={() => setSnapshot(sim.rows.map((r) => ({ ...r })))}
            csv={() => exportCsv(sim.rows, "planar-altitude-speed-SI.csv")}
          />
          {sim.error && (
            <div className="ctl-warning" role="alert">
              {sim.error}
            </div>
          )}
          <div className="ctl-metrics">
            <span>
              实际空速<strong>{fmt(sim.state.speed)} m/s</strong>
            </span>
            <span>
              实际高度<strong>{fmt(sim.state.height)} m</strong>
            </span>
            <span>
              航迹角 γ<strong>{fmt(sim.state.gamma / DEG)} °</strong>
            </span>
            <span>
              实际推力<strong>{fmt(sim.state.thrust, 0)} N</strong>
            </span>
          </div>
          <p className="ctl-status" role="status">
            {command.thrustLimited ? "推力需求已限幅" : "推力需求在范围内"} ·{" "}
            {command.liftLimited
              ? "升力需求超过约束，跟踪能力不足"
              : "升力需求在范围内"}{" "}
            ·{" "}
            {command.climbLimited
              ? "爬升率/航迹角需求已限幅"
              : "爬升率与航迹角需求在范围内"}
          </p>
          <TimeChart
            title="速度保持响应"
            rows={rows}
            unit="空速 [m/s]"
            series={[
              {
                key: "speedTarget",
                label: "目标空速",
                color: "#be8150",
                dashed: true,
              },
              { key: "speed", label: "实际空速", color: "#147b72" },
              ...(snapshot
                ? [
                    {
                      key: "saved_speed",
                      label: "快照空速",
                      color: "#8a74b3",
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
          <TimeChart
            title="高度保持与航迹响应"
            rows={rows}
            unit="高度 [m]"
            rightUnit="γ [°]"
            series={[
              {
                key: "heightTarget",
                label: "目标高度",
                color: "#be8150",
                dashed: true,
              },
              { key: "height", label: "实际高度", color: "#147b72" },
              {
                key: "gamma_deg",
                label: "实际航迹角",
                color: "#398aac",
                axis: "right",
              },
              ...(snapshot
                ? [
                    {
                      key: "saved_height",
                      label: "快照高度",
                      color: "#8a74b3",
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
          {snapshot && (
            <p className="ctl-snapshot">
              保留快照的目标、实际高度和速度响应 · {fmt(snapshot.at(-1)?.time)}{" "}
              s <button onClick={() => setSnapshot(null)}>清除快照</button>
            </p>
          )}
          <small>
            初始状态为 V = 50 m/s、h = 1000 m、γ = 0，满足 T = D、L =
            W；改变设置会重置到同一状态。垂直风只进入高度运动学，此模型不解析阵风气动力。空速范围
            20–100 m/s、|γ| ≤
            25°；超过范围暂停。较大高度阶跃和持续风需要数十秒至数分钟观察。
          </small>
          <Formula value="\dot V=\frac{T-D}{m}-g\sin\gamma,\quad \dot\gamma=\frac{L-mg\cos\gamma}{mV},\quad \dot h=V\sin\gamma+w_{up}" />
          <button
            className="ctl-task"
            disabled={
              sim.state.time < 8 || !p.speedHold || !p.heightHold || recorded
            }
            onClick={() => {
              onTask("control-autopilot");
              setRecorded(true);
            }}
          >
            {recorded ? "已记录保持环观察" : "记录高度与速度保持观察"}
          </button>
          <small>
            启用两个保持环，运行至少 8 s，并比较跟踪误差和约束状态。
          </small>
        </div>
      </div>
    </>
  );
}

function SixDofView({ state, rows }: { state: SixDofState; rows: Row[] }) {
  const r = quaternionMatrix(state.attitude);
  const project = (body: Vec3) => {
    const [north, east, down] = matrixVector(r, body);
    return [
      225 + 9 * (0.65 * north + 0.76 * east),
      112 + 9 * (down - 0.22 * north + 0.18 * east),
    ];
  };
  const plane: Vec3[] = [
    [6, 0, 0],
    [1, 0.5, 0],
    [0, 5, 0],
    [-0.7, 5, 0],
    [-1, 0.5, 0],
    [-4, 0.3, 0],
    [-4.5, 2, 0],
    [-5, 2, 0],
    [-4.7, 0, 0],
    [-5, -2, 0],
    [-4.5, -2, 0],
    [-4, -0.3, 0],
    [-1, -0.5, 0],
    [-0.7, -5, 0],
    [0, -5, 0],
    [1, -0.5, 0],
  ];
  const axes: { vector: Vec3; label: string; color: string }[] = [
    { vector: [7, 0, 0], label: "xb 前", color: "#147b72" },
    { vector: [0, 7, 0], label: "yb 右", color: "#398aac" },
    { vector: [0, 0, 5], label: "zb 下", color: "#be8150" },
  ];
  const northRange = Math.max(50, ...rows.map((row) => Math.abs(row.north_m)));
  const heightRange = Math.max(
    5,
    ...rows.map((row) => Math.abs(row.altitude_m - 1000)),
  );
  return (
    <div className="ctl-visual-grid">
      <div className="ctl-attitude">
        <div className="ctl-visual-label">四元数驱动姿态 · 固定 NED 投影</div>
        <svg
          viewBox="0 0 450 225"
          role="img"
          aria-label="由积分四元数旋转的飞机机体坐标轴与实际姿态"
        >
          <path
            d="M 30 151 L 410 83 M 30 78 L 410 161"
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          <text x="401" y="75" fontSize="10" fill="var(--muted)">
            北 N
          </text>
          <text x="402" y="177" fontSize="10" fill="var(--muted)">
            东 E
          </text>
          <polygon
            points={plane.map((v) => project(v).join(",")).join(" ")}
            fill="var(--soft)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          {axes.map((axis) => {
            const [x, y] = project(axis.vector);
            return (
              <g key={axis.label}>
                <line
                  x1="225"
                  y1="112"
                  x2={x}
                  y2={y}
                  stroke={axis.color}
                  strokeWidth="2"
                />
                <circle cx={x} cy={y} r="2.5" fill={axis.color} />
                <text x={x + 5} y={y - 6} fill={axis.color} fontSize="11">
                  {axis.label}
                </text>
              </g>
            );
          })}
          <text
            x="225"
            y="211"
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="10"
          >
            图标随实际 R(q) 旋转 · 轴线为方向，不是气动力
          </text>
        </svg>
      </div>
      <div className="ctl-attitude">
        <div className="ctl-visual-label">北向位移—高度轨迹 · 相对初始高度</div>
        <svg
          viewBox="0 0 450 225"
          role="img"
          aria-label="北向位移与高度投影轨迹，横轴北向位移米，纵轴高度米"
        >
          <path d="M 45 20 V 186 H 425" stroke="var(--border)" fill="none" />
          <path d="M45 105H425" stroke="var(--border)" strokeDasharray="4 4" />
          <polyline
            points={rows
              .map(
                (row) =>
                  `${45 + (365 * row.north_m) / northRange},${105 - (73 * (row.altitude_m - 1000)) / heightRange}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <text x="48" y="202" fill="var(--muted)" fontSize="10">
            0
          </text>
          <text
            x="414"
            y="202"
            textAnchor="end"
            fill="var(--muted)"
            fontSize="10"
          >
            {fmt(northRange, 0)} m 北
          </text>
          <text x="48" y="100" fill="var(--muted)" fontSize="10">
            1000 m
          </text>
          <text x="48" y="29" fill="var(--muted)" fontSize="10">
            +{fmt(heightRange, 0)} m
          </text>
          <text
            x="225"
            y="219"
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="10"
          >
            横纵比例独立 · 完整北/东/下坐标见指标与 CSV
          </text>
        </svg>
      </div>
    </div>
  );
}

function SixDofExperiment({ onTask }: { onTask: (id: string) => void }) {
  const [c, setC] = useState<SixDofControls>({ ...sixDofControls });
  const [windEast, setWindEast] = useState(0);
  const [gustEast, setGustEast] = useState(0);
  const parameters = (time: number) => ({
    ...sixDofDefaults,
    wind: [0, windEast + (time >= 3 ? gustEast : 0), 0] as Vec3,
  });
  const sample = (s: SixDofState): Row => {
    const e = quaternionEuler(s.attitude);
    const loads = sixDofLoads(s, parameters(s.time), c);
    return {
      time: s.time,
      north_m: s.position[0],
      east_m: s.position[1],
      down_m: s.position[2],
      altitude_m: -s.position[2],
      u_m_s: s.velocity[0],
      v_m_s: s.velocity[1],
      w_m_s: s.velocity[2],
      qw: s.attitude[0],
      qx: s.attitude[1],
      qy: s.attitude[2],
      qz: s.attitude[3],
      p_rad_s: s.rates[0],
      q_rad_s: s.rates[1],
      r_rad_s: s.rates[2],
      roll_deg: e.roll / DEG,
      pitch_deg: e.pitch / DEG,
      yaw_deg: e.yaw / DEG,
      airspeed_m_s: loads.speed,
      alpha_rad: loads.alpha,
      beta_rad: loads.beta,
      cl: loads.cl,
      lift_N: loads.lift,
      drag_N: loads.drag,
      thrust_N: c.thrust,
      elevator_rad: c.elevator,
      aileron_rad: c.aileron,
      rudder_rad: c.rudder,
      windEast_m_s: parameters(s.time).wind[1],
    };
  };
  const sim = useSimulation(
    initialSixDofState,
    (s: SixDofState) => stepSixDof(s, parameters(s.time + 0.005), c),
    sample,
    30,
  );
  const [snapshot, setSnapshot] = useState<Row[] | null>(null),
    [recorded, setRecorded] = useState(false);
  const restorePending = useRef(false);
  useEffect(() => {
    if (restorePending.current) {
      sim.reset();
      setRecorded(false);
      restorePending.current = false;
    }
  }, [c, windEast, gustEast]);
  const loads = sixDofLoads(sim.state, parameters(sim.state.time), c),
    angles = quaternionEuler(sim.state.attitude);
  const rows = useMemo(
    () => compareRows(sim.rows, snapshot, ["pitch_deg", "roll_deg"]),
    [sim.rows, snapshot],
  );
  const change = <K extends keyof SixDofControls>(
    key: K,
    value: SixDofControls[K],
  ) => {
    setC((old) => ({ ...old, [key]: value }));
    setRecorded(false);
  };
  const reset = () => {
    sim.reset();
    setRecorded(false);
  };
  return (
    <>
      <p className="ctl-intro">
        同时积分三维位置、机体系速度、四元数姿态与角速度。默认假想飞机用 α =
        0、CL₀ = 0.40027、T = 828.39 N
        精确配平；没有强制锁定高度或姿态。小幅操纵会真实改变力矩与航迹。操纵量可以在运行中修改，重置恢复初始状态并保留当前操纵设置。
      </p>
      <div className="ctl-layout">
        <aside className="ctl-controls">
          <h3>手动操纵</h3>
          <NumericControl
            label="机体 x 方向推力"
            unit="N"
            min={0}
            max={3500}
            step={25}
            value={c.thrust}
            onChange={(v) => change("thrust", v)}
          />
          <NumericControl
            label="升降舵 δe · 正值后缘向下"
            unit="°"
            min={-20}
            max={20}
            step={0.5}
            value={c.elevator / DEG}
            onChange={(v) => change("elevator", v * DEG)}
          />
          <NumericControl
            label="副翼 · 正值右滚"
            unit="°"
            min={-20}
            max={20}
            step={0.5}
            value={c.aileron / DEG}
            onChange={(v) => change("aileron", v * DEG)}
          />
          <NumericControl
            label="方向舵 · 正值右偏航"
            unit="°"
            min={-20}
            max={20}
            step={0.5}
            value={c.rudder / DEG}
            onChange={(v) => change("rudder", v * DEG)}
          />
          <button
            onClick={() => {
              restorePending.current = true;
              setC({ ...sixDofControls });
              setWindEast(0);
              setGustEast(0);
            }}
          >
            恢复默认参数
          </button>
          <h3>相对空气与阵风</h3>
          <NumericControl
            label="稳态风 · 向东为正"
            unit="m/s"
            min={-5}
            max={5}
            step={0.25}
            value={windEast}
            onChange={(v) => {
              setWindEast(v);
              setRecorded(false);
            }}
          />
          <NumericControl
            label="3 s 起追加的东向阵风"
            unit="m/s"
            min={-5}
            max={5}
            step={0.25}
            value={gustEast}
            onChange={(v) => {
              setGustEast(v);
              setRecorded(false);
            }}
          />
          <small>
            m = 1000 kg，S = 16 m²，b = 10 m，c̄ = 1.6 m；I =
            diag(1200,1800,2500) kg·m²，ρ = 1.225 kg/m³。CL = CL₀ + 5α（α 用
            rad），CD = 0.025 + 0.055CL²；Cm = −0.8α −12c̄q/(2V) − δe；Cl =
            −0.12β −0.5bp/(2V) + 0.12δa；Cn = 0.18β −0.25br/(2V) + 0.1δr；CY =
            −0.7β。物理 δe 正值后缘向下，产生低头力矩，与配平章节一致；−2°
            对应小幅抬头。舵角直接作用于准定常气动力矩，不含真实舵机与发动机动态。
          </small>
        </aside>
        <div className="ctl-output">
          <RunBar
            {...sim}
            reset={reset}
            time={sim.state.time}
            stopAt={30}
            hasRows={sim.rows.length > 1}
            save={() => setSnapshot(sim.rows.map((r) => ({ ...r })))}
            csv={() => exportCsv(sim.rows, "six-dof-NED-SI.csv")}
          />
          {(sim.error || !loads.applicable) && (
            <div className="ctl-warning" role="alert">
              {sim.error || `${loads.reason}。运行将在下一积分步暂停。`}
            </div>
          )}
          <div className="ctl-metrics">
            <span>
              相对空速<strong>{fmt(loads.speed)} m/s</strong>
            </span>
            <span>
              俯仰 θ / 滚转 φ
              <strong>
                {fmt(angles.pitch / DEG)} / {fmt(angles.roll / DEG)} °
              </strong>
            </span>
            <span>
              高度 h = −zNED<strong>{fmt(-sim.state.position[2])} m</strong>
            </span>
            <span>
              迎角 α / 侧滑 β
              <strong>
                {fmt(loads.alpha / DEG)} / {fmt(loads.beta / DEG)} °
              </strong>
            </span>
          </div>
          <p className="ctl-status" role="status">
            N {fmt(sim.state.position[0])} m · E {fmt(sim.state.position[1])} m
            · D {fmt(sim.state.position[2])} m · q = {fmt(sim.state.rates[1])}{" "}
            rad/s · |四元数| = {fmt(Math.hypot(...sim.state.attitude), 6)} ·
            固定 RK4 0.01 s
          </p>
          <SixDofView state={sim.state} rows={sim.rows} />
          <TimeChart
            title="积分得到的实际姿态"
            rows={rows}
            unit="角度 [°]"
            series={[
              { key: "pitch_deg", label: "俯仰 θ", color: "#147b72" },
              { key: "roll_deg", label: "滚转 φ", color: "#398aac" },
              { key: "yaw_deg", label: "偏航 ψ", color: "#be8150" },
              ...(snapshot
                ? [
                    {
                      key: "saved_pitch_deg",
                      label: "快照俯仰",
                      color: "#8a74b3",
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
          <TimeChart
            title="空速与高度"
            rows={rows}
            unit="空速 [m/s]"
            rightUnit="高度 [m]"
            series={[
              { key: "airspeed_m_s", label: "相对空速", color: "#398aac" },
              {
                key: "altitude_m",
                label: "高度",
                color: "#147b72",
                axis: "right",
              },
            ]}
          />
          {snapshot && (
            <p className="ctl-snapshot">
              已保留 {fmt(snapshot.at(-1)?.time)} s 响应快照{" "}
              <button onClick={() => setSnapshot(null)}>清除快照</button>
            </p>
          )}
          <small>
            机体 x 前、y 右、z 下；地面 NED x 北、y 东、z 下，姿态 q = [w,x,y,z]
            把机体向量转到 NED。每步规范化四元数。空速低于 5 或高于 150
            m/s、|CL| &gt; 1.4、|α| &gt; 15° 或 |β| &gt; 20°
            时暂停，超范围不继续预测失速运动。数值保护与这些物理适用范围分开报告。系数是假想附着流近似，未由真实飞机验证，不含气弹性、地面碰撞、发动机/舵机动态或自动保持功能。
          </small>
          <Formula value="\dot{\mathbf r}_N=R\mathbf v_B,\quad \dot{\mathbf v}_B=\frac{\mathbf F_B}{m}-\boldsymbol\omega\times\mathbf v_B+R^T\mathbf g_N" />
          <Formula value="\dot{\boldsymbol\omega}=I^{-1}(\mathbf M_B-\boldsymbol\omega\times I\boldsymbol\omega),\quad \dot q=\tfrac12q\otimes[0,\boldsymbol\omega]" />
          <button
            className="ctl-task"
            disabled={sim.state.time < 2 || recorded}
            onClick={() => {
              onTask("control-sixdof");
              setRecorded(true);
            }}
          >
            {recorded ? "已记录六自由度观察" : "记录六自由度观察"}
          </button>
          <small>
            运行至少 2 s，先观察默认配平，再重置并施加小幅操纵，比较姿态与航迹。
          </small>
        </div>
      </div>
    </>
  );
}

function normalizeExperiment(value?: string): ControlExperiment {
  if (value === "autopilot" || value === "altitude-speed-hold")
    return "autopilot";
  if (value === "sixdof" || value === "six-dof") return "sixdof";
  return "pid";
}
export default function ControlLab({
  onTask,
  initialExperiment,
}: {
  onTask: (id: string) => void;
  initialExperiment?: string;
}) {
  const [experiment, setExperiment] = useState<ControlExperiment>(() =>
    normalizeExperiment(initialExperiment),
  );
  useEffect(() => {
    setExperiment(normalizeExperiment(initialExperiment));
  }, [initialExperiment]);
  return (
    <section className="control-lab">
      <div className="ctl-heading">
        <div>
          <span className="eyebrow">LEVEL 06 · FLIGHT CONTROL</span>
          <h2>飞行控制与综合仿真</h2>
        </div>
        <span className="ctl-model-tag">SI · 假想教学模型</span>
      </div>
      <div className="ctl-tabs" role="tablist" aria-label="控制实验">
        {(Object.keys(names) as ControlExperiment[]).map((key) => (
          <button
            key={key}
            id={`control-tab-${key}`}
            role="tab"
            aria-selected={experiment === key}
            aria-controls={`control-panel-${key}`}
            onClick={() => setExperiment(key)}
          >
            {names[key]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`control-panel-${experiment}`}
        aria-labelledby={`control-tab-${experiment}`}
      >
        {experiment === "pid" ? (
          <PidExperiment onTask={onTask} />
        ) : experiment === "autopilot" ? (
          <AutopilotExperiment onTask={onTask} />
        ) : (
          <SixDofExperiment onTask={onTask} />
        )}
      </div>
    </section>
  );
}
