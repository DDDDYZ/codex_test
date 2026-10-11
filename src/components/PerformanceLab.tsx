import { useEffect, useId, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Formula } from "./Formula";
import {
  climbFlight, coordinatedTurn, dragPolar, glideFlight, levelFlight,
  optimalLiftDrag, performanceBounds, performanceCurves, performanceDefaults,
  type PerformanceParameters,
} from "../physics/performance";
import "../performance.css";

export type PerformanceExperiment = "polar" | "level" | "climb" | "turn";
type FlightMode = "climb" | "glide";
type Snapshot = { p: PerformanceParameters; cl: number; experiment: PerformanceExperiment; mode: FlightMode };
type CurveRow = Record<string, number | null>;
type Metric = { label: string; value: number | null; unit: string; decimals?: number };
const names: Record<PerformanceExperiment, string> = { polar: "阻力极线", level: "平飞性能", climb: "爬升与滑翔", turn: "协调转弯" };
const labels: Record<keyof PerformanceParameters, { name: string; unit: string; step: number }> = {
  speed: { name: "真空速 V", unit: "m/s", step: 0.5 },
  density: { name: "空气密度 ρ", unit: "kg/m³", step: 0.025 },
  area: { name: "机翼面积 S", unit: "m²", step: 0.5 },
  mass: { name: "质量 m", unit: "kg", step: 10 },
  cd0: { name: "零升阻力系数 CD₀", unit: "无量纲", step: 0.001 },
  k: { name: "诱导阻力因子 k", unit: "无量纲", step: 0.001 },
  clMax: { name: "最大升力系数 CL,max", unit: "无量纲", step: 0.05 },
  thrust: { name: "可用推力 T", unit: "N", step: 25 },
  bank: { name: "倾斜角 φ", unit: "°", step: 1 },
};
const keys = Object.keys(labels) as (keyof PerformanceParameters)[];
const descriptions: Record<PerformanceExperiment, string> = {
  polar: "改变升力系数，观察寄生阻力与诱导阻力的此消彼长。最佳升阻比对应一条从原点与极线相切的直线。",
  level: "平飞需要升力平衡重力、推力平衡阻力。速度太低时，需要的升力系数超过上限；速度增大也会增加寄生阻力。",
  climb: "爬升利用剩余推力，滑翔利用重力沿航迹的分量。模型同时求解沿航迹和垂直航迹的力平衡。",
  turn: "保持高度的协调转弯需要倾斜升力。倾斜越大，载荷因子越高，转弯越紧，同时失速速度也随之提高。",
};
const formulas: Record<PerformanceExperiment, string[]> = {
  polar: ["C_D=C_{D0}+kC_L^2", "C_{L,*}=\\sqrt{C_{D0}/k},\\quad (L/D)_{max}=\\frac{1}{2\\sqrt{C_{D0}k}}"],
  level: ["C_L=\\frac{W}{qS},\\quad T_{req}=D=qSC_D", "V_s=\\sqrt{\\frac{2W}{\\rho S C_{L,max}}},\\quad P_{req}=DV"],
  climb: ["T-D-W\\sin\\gamma=0", "L=W\\cos\\gamma,\\quad \\dot h=V\\sin\\gamma"],
  turn: ["n=\\frac{1}{\\cos\\phi},\\quad L=nW", "R=\\frac{V^2}{g\\tan|\\phi|},\\quad \\omega=\\frac{g\\tan\\phi}{V}"],
};

function textValue(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}
function parameterDrafts(p: PerformanceParameters) {
  return Object.fromEntries(keys.map((key) => [key, String(p[key])])) as Record<keyof PerformanceParameters, string>;
}

function PerformanceChart({ title, rows, xKey, xLabel, yLabel, series, selected, threshold }: {
  title: string; rows: CurveRow[]; xKey: string; xLabel: string; yLabel: string;
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  selected?: number; threshold?: { value: number; label: string };
}) {
  return <div className="perf-chart-card">
    <h4>{title}</h4>
    <div className="perf-chart" role="img" aria-label={`${title}；横轴 ${xLabel}；纵轴 ${yLabel}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 12, bottom: 20, left: 4 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" />
          <XAxis dataKey={xKey} type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(v: number) => textValue(v, xKey === "cl" ? 1 : 0)} label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 10, fill: "var(--muted)" }} />
          <YAxis width={53} tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(v: number) => textValue(v, Math.abs(v) < 1 ? 2 : 0)} label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 0, fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text)" }} labelFormatter={(v) => `${xLabel}: ${Number(v).toFixed(2)}`} formatter={(v) => Number(v).toFixed(3)} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10, paddingBottom: 10 }} />
          {threshold && <ReferenceLine x={threshold.value} stroke="#cc8950" strokeDasharray="3 3" label={{ value: threshold.label, position: "insideTopRight", fontSize: 9, fill: "#cc8950" }} />}
          {selected !== undefined && <ReferenceLine x={selected} stroke="var(--accent)" strokeDasharray="2 3" />}
          {series.map((line) => <Line key={line.key} type="linear" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={line.dashed ? 1.7 : 2} strokeDasharray={line.dashed ? "5 4" : undefined} dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

function ForceDiagram({ experiment, mode, valid, lift, drag, thrust, weight, gamma, bank, radius, loadFactor }: {
  experiment: PerformanceExperiment; mode: FlightMode; valid: boolean;
  lift: number | null; drag: number | null; thrust: number; weight: number;
  gamma: number | null; bank: number; radius: number | null; loadFactor: number | null;
}) {
  const marker = useId().replace(/:/g, "");
  const isTurn = experiment === "turn";
  const pathAngle = experiment === "climb" ? gamma ?? 0 : 0;
  const scale = 68 / Math.max(weight, lift ?? 0, thrust, drag ?? 0, 1);
  const center = { x: 240, y: 147 };
  const arrow = (endX: number, endY: number, label: string, color: string, anchor?: "start" | "middle" | "end") => <g key={label}>
    <line x1={center.x} y1={center.y} x2={endX} y2={endY} stroke={color} strokeWidth={2.3} markerEnd={`url(#${marker}-${color.slice(1)})`} />
    <text x={endX + (anchor === "end" ? -8 : anchor === "start" ? 8 : 0)} y={endY + (endY >= center.y ? 19 : -8)} textAnchor={anchor ?? "middle"} fill={color} fontSize={11}>{label}</text>
  </g>;
  return <div className={`perf-diagram${!valid ? " is-invalid" : ""}`}>
    <div className="perf-diagram-head"><span>{isTurn ? "后视图 · 升力分解" : "侧视图 · 航迹坐标"}</span><span>实时静态解</span></div>
    <svg viewBox="0 0 480 272" aria-label={valid ? `${names[experiment]}受力示意。${isTurn ? `倾斜角 ${bank} 度` : `航迹角 ${textValue(pathAngle)} 度`}` : "当前条件超出模型适用范围，已隐藏受力矢量"} role="img">
      <defs>{["#147b72", "#be8150", "#398aac", "#8a74b3"].map((color) => <marker key={color} id={`${marker}-${color.slice(1)}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill={color} /></marker>)}</defs>
      <path d="M 25 212 H 455" stroke="var(--border)" strokeDasharray="5 5" />
      <text x="31" y="230" fill="var(--muted)" fontSize="10">水平参考</text>
      {!isTurn && <g transform={`rotate(${-pathAngle} 240 147)`}>
        <path d="M 60 147 H 427" stroke="var(--muted)" strokeDasharray="4 5" opacity=".4" />
        <path d="M 188 153 L 198 139 L 231 143 L 249 122 L 259 122 L 253 143 L 284 144 Q 301 146 288 152 L 252 157 L 243 175 L 233 175 L 236 158 L 207 158 Z" fill="var(--panel)" stroke="var(--accent)" strokeWidth="2" />
        <text x="385" y="138" fill="var(--muted)" fontSize="10">航迹 V →</text>
      </g>}
      {isTurn && <g transform={`rotate(${bank} 240 147)`}>
        <path d="M 156 147 H 324 M 234 147 L 240 122 L 246 147 L 240 159 Z" stroke="var(--accent)" strokeWidth="3" fill="var(--panel)" />
      </g>}
      {valid && <>
        {arrow(center.x, center.y + weight * scale, `W ${textValue(weight / 1000)} kN`, "#be8150")}
        {isTurn ? <>
          {arrow(center.x + Math.sin(bank * Math.PI / 180) * (lift ?? 0) * scale, center.y - Math.cos(bank * Math.PI / 180) * (lift ?? 0) * scale, `L ${textValue((lift ?? 0) / 1000)} kN`, "#147b72")}
          <line x1={center.x} y1={center.y} x2={center.x} y2={center.y - weight * scale} stroke="#147b72" strokeDasharray="3 3" />
          <line x1={center.x} y1={center.y} x2={center.x + weight * Math.tan(bank * Math.PI / 180) * scale} y2={center.y} stroke="#398aac" strokeWidth="2" />
          <text x="240" y="253" textAnchor="middle" fill="var(--muted)" fontSize="11">L cos φ = W · 水平升力提供向心加速度</text>
        </> : (() => {
          const angle = pathAngle * Math.PI / 180;
          return <>
            {arrow(center.x - Math.sin(angle) * (lift ?? 0) * scale, center.y - Math.cos(angle) * (lift ?? 0) * scale, `L ${textValue((lift ?? 0) / 1000)} kN`, "#147b72")}
            {arrow(center.x - Math.cos(angle) * (drag ?? 0) * scale, center.y + Math.sin(angle) * (drag ?? 0) * scale, `D ${textValue((drag ?? 0) / 1000)} kN`, "#8a74b3", "end")}
            {thrust > 0 && arrow(center.x + Math.cos(angle) * thrust * scale, center.y - Math.sin(angle) * thrust * scale, `T ${textValue(thrust / 1000)} kN`, "#398aac", "start")}
          </>;
        })()}
      </>}
      {!valid && <text x="240" y="253" textAnchor="middle" fill="var(--muted)" fontSize="11">无可用稳态解 · 受力矢量已隐藏</text>}
    </svg>
    <div className="perf-diagram-footer"><span>{isTurn ? `φ = ${textValue(bank, 0)}° · n = ${textValue(loadFactor)}` : `γ = ${textValue(valid ? pathAngle : null)}°${experiment === "climb" && mode === "glide" ? " · 推力关闭" : ""}`}</span><span>{isTurn ? !valid ? "无有效转弯半径" : radius === null ? "直线飞行 · R → ∞" : `R = ${textValue(radius, 0)} m` : "矢量同一比例 · 飞机图标仅标示航迹"}</span></div>
  </div>;
}

export default function PerformanceLab({ initialExperiment = "polar", onTask }: {
  initialExperiment?: PerformanceExperiment; onTask: (id: string) => void;
}) {
  const [experiment, setExperiment] = useState<PerformanceExperiment>(initialExperiment);
  const [p, setP] = useState<PerformanceParameters>({ ...performanceDefaults });
  const [drafts, setDrafts] = useState(parameterDrafts(performanceDefaults));
  const [explorationCl, setExplorationCl] = useState(0.4);
  const [clDraft, setClDraft] = useState("0.4");
  const [mode, setMode] = useState<FlightMode>("climb");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<string[]>([]);
  useEffect(() => { setExperiment(initialExperiment); setError(""); }, [initialExperiment]);
  const optimum = optimalLiftDrag(p);
  const level = levelFlight(p);
  const flight = mode === "climb" ? climbFlight(p) : glideFlight(p);
  const turn = coordinatedTurn(p);
  const selectedCd = dragPolar(explorationCl, p.cd0, p.k);
  const q = p.density * p.speed ** 2 / 2;
  const sameSnapshot = snapshot?.experiment === experiment && (experiment !== "climb" || snapshot.mode === mode) ? snapshot : null;
  const s = sameSnapshot?.p ?? null;
  const selected = experiment === "level" ? level : experiment === "turn" ? turn : flight;
  const valid = experiment === "polar" || selected.valid;
  const curves = useMemo(() => {
    if (experiment === "polar") return Array.from({ length: 81 }, (_, i) => {
      const cl = p.clMax * i / 80;
      const cd = dragPolar(cl, p.cd0, p.k);
      const savedCd = s && cl <= s.clMax ? dragPolar(cl, s.cd0, s.k) : null;
      return { cl, cd, parasite: p.cd0, induced: p.k * cl ** 2, ld: cl / cd, savedCd, savedLd: savedCd === null ? null : cl / savedCd };
    });
    if (experiment === "turn") return Array.from({ length: performanceBounds.bank[1] + 1 }, (_, i) => {
      const bank = i;
      const current = coordinatedTurn({ ...p, bank });
      const saved = s ? coordinatedTurn({ ...s, bank }) : null;
      return { bank, n: current.valid ? current.loadFactor : null, radius: current.valid ? current.radius : null, rate: current.valid ? current.turnRate : null, savedN: saved?.valid ? saved.loadFactor : null, savedRadius: saved?.valid ? saved.radius : null, valid: current.valid ? 1 : 0 };
    });
    return performanceCurves(p).map((row) => {
      const savedLevel = s ? levelFlight({ ...s, speed: row.speed }) : null;
      const currentFlight = mode === "climb" ? climbFlight({ ...p, speed: row.speed }) : glideFlight({ ...p, speed: row.speed });
      const savedFlight = s ? mode === "climb" ? climbFlight({ ...s, speed: row.speed }) : glideFlight({ ...s, speed: row.speed }) : null;
      return { speed: row.speed, cl: row.cl, drag: row.valid ? row.drag : null, parasite: row.valid ? row.parasiteDrag : null, induced: row.valid ? row.inducedDrag : null, thrust: experiment === "climb" && mode === "glide" ? 0 : p.thrust, power: row.valid ? row.powerRequired / 1000 : null, availablePower: experiment === "climb" && mode === "glide" ? 0 : p.thrust * row.speed / 1000, savedDrag: savedLevel?.valid ? savedLevel.drag : null, savedPower: savedLevel?.valid ? savedLevel.powerRequired / 1000 : null, roc: currentFlight.valid ? currentFlight.verticalSpeed : null, savedRoc: savedFlight?.valid ? savedFlight.verticalSpeed : null, valid: row.valid ? 1 : 0, flightValid: currentFlight.valid ? 1 : 0 };
    });
  }, [experiment, p, s, mode]);
  const metricsFor = (params: PerformanceParameters, cl: number): Metric[] => {
    if (experiment === "polar") {
      const cd = dragPolar(cl, params.cd0, params.k);
      const best = optimalLiftDrag(params);
      return [{ label: "选定升阻比 L/D", value: cl / cd, unit: "", decimals: 2 }, { label: "阻力系数 CD", value: cd, unit: "", decimals: 4 }, { label: "最佳 CL", value: best.constrainedCl, unit: "", decimals: 3 }, { label: "最佳平飞速度", value: best.constrainedSpeed, unit: "m/s", decimals: 1 }];
    }
    if (experiment === "level") {
      const a = levelFlight(params);
      return [{ label: "需用推力", value: a.valid ? a.requiredThrust : null, unit: "N", decimals: 0 }, { label: "剩余推力 T − D", value: a.valid ? a.excessThrust : null, unit: "N", decimals: 0 }, { label: "所需 CL", value: a.cl, unit: "", decimals: 3 }, { label: "平飞失速速度", value: a.stallSpeed, unit: "m/s", decimals: 1 }];
    }
    if (experiment === "climb") {
      const a = mode === "climb" ? climbFlight(params) : glideFlight(params);
      return [{ label: "垂直速度 · 向上为正", value: a.valid ? a.verticalSpeed : null, unit: "m/s", decimals: 2 }, { label: "航迹角 γ", value: a.valid ? a.gamma : null, unit: "°", decimals: 2 }, { label: "需用 CL", value: a.valid ? a.cl : null, unit: "", decimals: 3 }, { label: mode === "glide" ? "滑翔比 · 水平/下降" : "沿航迹力残差", value: a.valid ? mode === "glide" ? ("glideRatio" in a ? a.glideRatio as number | null : null) : a.forceResidual : null, unit: mode === "glide" ? "" : "N", decimals: mode === "glide" ? 2 : 4 }];
    }
    const a = coordinatedTurn(params);
    return [{ label: "载荷因子 n", value: a.valid ? a.loadFactor : null, unit: "g", decimals: 2 }, { label: "转弯半径 R", value: a.valid ? a.radius : null, unit: "m", decimals: 0 }, { label: "转弯角速度", value: a.valid ? a.turnRate : null, unit: "°/s", decimals: 2 }, { label: "转弯失速速度", value: a.stallSpeed, unit: "m/s", decimals: 1 }];
  };
  const metrics = metricsFor(p, explorationCl);
  const savedMetrics = sameSnapshot ? metricsFor(sameSnapshot.p, sameSnapshot.cl) : null;
  const taskId = `perf-${experiment}`;
  const taskReady = experiment === "polar" ? Math.abs(explorationCl - optimum.constrainedCl) <= 0.03 : experiment === "level" ? level.valid && Math.abs(level.excessThrust) < 50 : experiment === "climb" ? mode === "climb" && flight.valid && (flight.verticalSpeed ?? 0) > 2 && (flight.gamma ?? 99) < 20 : turn.valid && Math.abs(turn.loadFactor - 2) < 0.06;
  const taskPrompt = experiment === "polar" ? "把选定 CL 调至最佳升阻比附近（误差 ≤ 0.03）。" : experiment === "level" ? "调节推力，让剩余推力的绝对值小于 50 N。" : experiment === "climb" ? "在有效爬升状态下，达到爬升率 > 2 m/s、航迹角 < 20°。" : "达到约 2 g 的有效协调转弯（提示：倾斜角约 60°）。";
  const pressureReady = Math.abs(p.speed - 100) < 0.5 && Math.abs(p.density - 1.225) < 0.005;
  const commonKeys: (keyof PerformanceParameters)[] = ["speed", "density", "mass", "area"];
  const activeKeys: (keyof PerformanceParameters)[] = [...commonKeys, ...(experiment === "level" || experiment === "climb" && mode === "climb" ? ["thrust" as const] : []), ...(experiment === "turn" ? ["bank" as const] : []), "cd0", "k", "clMax"];
  function update(key: keyof PerformanceParameters, raw: string) {
    const value = raw.trim() === "" ? NaN : Number(raw);
    const [min, max] = performanceBounds[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      setError(`${labels[key].name}请输入 ${min}–${max} ${labels[key].unit} 的有限数值。`);
      setInvalidKey(key);
      setDrafts((d) => ({ ...d, [key]: String(p[key]) }));
      return;
    }
    setError(""); setInvalidKey(null);
    setP((prev) => ({ ...prev, [key]: value }));
    setDrafts((d) => ({ ...d, [key]: String(value) }));
    if (key === "clMax" && explorationCl > value) { setExplorationCl(value); setClDraft(String(value)); }
  }
  function updateCl(raw: string) {
    const value = raw.trim() === "" ? NaN : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > p.clMax) {
      setError(`选定 CL 范围是 0–${p.clMax}。未应用输入。`); setInvalidKey("selectedCl"); setClDraft(String(explorationCl)); return;
    }
    setExplorationCl(value); setClDraft(String(value)); setError(""); setInvalidKey(null);
  }
  function reset() {
    setP({ ...performanceDefaults }); setDrafts(parameterDrafts(performanceDefaults)); setExplorationCl(0.4); setClDraft("0.4"); setError(""); setInvalidKey(null);
  }
  function exportData() {
    const header = experiment === "polar" ? ["CL", "CD", "CD_parasite", "CD_induced", "L_over_D", "saved_CD", "saved_L_over_D"] : experiment === "turn" ? ["bank_deg", "load_factor", "radius_m", "turn_rate_deg_s", "saved_load_factor", "saved_radius_m", "valid_1_0"] : ["speed_m_s", "CL_required", "drag_N", "parasite_drag_N", "induced_drag_N", "thrust_N", "power_required_kW", "available_power_kW", "saved_drag_N", "saved_power_kW", "vertical_speed_m_s", "saved_vertical_speed_m_s", "level_valid_1_0", "flight_valid_1_0"];
    const fields = experiment === "polar" ? ["cl", "cd", "parasite", "induced", "ld", "savedCd", "savedLd"] : experiment === "turn" ? ["bank", "n", "radius", "rate", "savedN", "savedRadius", "valid"] : ["speed", "cl", "drag", "parasite", "induced", "thrust", "power", "availablePower", "savedDrag", "savedPower", "roc", "savedRoc", "valid", "flightValid"];
    const csv = header.join(",") + "\n" + curves.map((row) => fields.map((field) => row[field as keyof typeof row] ?? "").join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `flight-performance-${experiment}${experiment === "climb" ? `-${mode}` : ""}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const chartRows = curves as CurveRow[];
  const savedLine = (key: string, name: string) => sameSnapshot ? [{ key, name, color: "#9c82bd", dashed: true }] : [];
  return <section className="performance-lab" id="performance-lab">
    <div className="section-heading"><div><div className="eyebrow">PHASE 02 / PERFORMANCE LAB</div><h2>用性能曲线，读懂飞行。</h2></div><span className="badge">4 个稳态实验</span></div>
    <div className="perf-tabs" role="tablist" aria-label="飞行性能实验">
      {(Object.keys(names) as PerformanceExperiment[]).map((key, i) => <button key={key} role="tab" id={`perf-tab-${key}`} aria-selected={experiment === key} aria-controls="perf-panel" className={experiment === key ? "active" : ""} onClick={() => { setExperiment(key); setError(""); setInvalidKey(null); }}><span>0{i + 1}</span>{names[key]}</button>)}
    </div>
    <div className="perf-grid" id="perf-panel" role="tabpanel" aria-labelledby={`perf-tab-${experiment}`}>
      <aside className="perf-theory">
        <div className="eyebrow">实验手册 / 稳态性能</div><h3>{names[experiment]}</h3><p>{descriptions[experiment]}</p>
        {formulas[experiment].map((formula) => <Formula key={formula} value={formula} />)}
        <p className="small">q = ½ρV² [Pa] · W = mg [N] · L, D, T [N] · CL, CD, n 无量纲 · γ 航迹角 [°] · φ 倾斜角 [°]</p>
        <div className="model-note"><strong>模型边界</strong><p>假设教学飞机；定常、亚音速、无风，系数不随雷诺数和马赫数变化。重力加速度为 9.80665 m/s²。</p><p>{experiment === "polar" ? "极线适用于附着流。CL 不超过 CL,max；理论最佳值若超出上限，显示上限内可实现的最佳值。最佳速度按平飞 L = W 求得。" : experiment === "level" ? "机翼水平，升力等于重力，推力沿航迹。T 与 D 不等时只报告剩余推力，不把该状态视为匀速平飞。" : experiment === "climb" ? "推力沿航迹，以解析求根解力平衡；|γ| ≤ 20°。超出范围或失速时不外推。滑翔模式固定 T = 0。飞机图标沿航迹显示，不代表真实俯仰或迎角。" : "水平、协调、无侧滑转弯；|φ| ≤ 60°。所示为维持指定速度和高度所需的升力与推力，不计算控制舵面或瞬态姿态。"}</p></div>
        <div className="perf-observe"><strong>观察问题</strong><p>{experiment === "polar" ? "为什么 CL 太小和太大，升阻比都会下降？改变 k 会如何移动最佳点？" : experiment === "level" ? "为什么需用推力呈 U 形？最小功率速度与最小阻力速度一样吗？" : experiment === "climb" ? "最佳爬升率与最佳爬升角，为什么不是同一个速度？滑翔时，垂直速度为什么是负值？" : "同样速度下，倾斜角从 30° 改为 60°，半径与失速速度如何变化？"}</p></div>
        <a className="reference" href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak" target="_blank" rel="noreferrer">参考：FAA · Pilot’s Handbook ↗</a>
      </aside>
      <div className="perf-workspace">
        {experiment === "climb" && <div className="perf-mode" role="group" aria-label="爬升或滑翔模式"><button aria-pressed={mode === "climb"} className={mode === "climb" ? "active" : ""} onClick={() => setMode("climb")}>有动力爬升</button><button aria-pressed={mode === "glide"} className={mode === "glide" ? "active" : ""} onClick={() => setMode("glide")}>无动力滑翔 · T = 0</button></div>}
        <ForceDiagram experiment={experiment} mode={mode} valid={valid} lift={experiment === "polar" ? q * p.area * explorationCl : selected.valid ? selected.lift : null} drag={experiment === "polar" ? q * p.area * selectedCd : selected.valid ? selected.drag : null} thrust={experiment === "climb" && mode === "glide" ? 0 : experiment === "turn" ? turn.valid ? turn.requiredThrust : 0 : p.thrust} weight={p.mass * 9.80665} gamma={experiment === "climb" && flight.valid ? flight.gamma : 0} bank={p.bank} radius={turn.valid ? turn.radius : null} loadFactor={turn.valid ? turn.loadFactor : null} />
        {experiment === "polar" && <p className="perf-caption">系数试验：由选定 CL 计算升阻力，此图不要求配平，也不预测运动。</p>}
        {experiment === "polar" && (optimum.constrainedSpeed < performanceBounds.speed[0] || optimum.constrainedSpeed > performanceBounds.speed[1]) && <p className="warning perf-status">解析最佳速度 {textValue(optimum.constrainedSpeed, 1)} m/s 超出当前速度模型范围 {performanceBounds.speed[0]}–{performanceBounds.speed[1]} m/s，仅供极线理论比较。</p>}
        {!valid && <p className="perf-status warning" role="status"><strong>{selected.status === "stall" ? "失速边界" : selected.status === "numerical-failure" ? "求解失败" : "超出模型范围"}</strong> · {selected.message} 已隐藏稳态力与轨迹预测。</p>}
        {valid && experiment !== "polar" && <p className="perf-status"><span className="live-dot" />{experiment === "level" ? Math.abs(level.excessThrust) < 50 ? "接近匀速平飞配平" : "升力配平 · 当前推力与阻力不平衡" : experiment === "climb" ? mode === "glide" ? "无动力滑翔解有效 · 垂直速度向下" : (flight.verticalSpeed ?? 0) > 0 ? "定常爬升解有效" : "定常下降解有效 · 剩余推力不足" : "协调转弯解有效 · 推力采用维持该状态的需用值"}</p>}
        <div className="perf-readouts">{metrics.map((metric) => <div key={metric.label}><small>{metric.label}</small><strong>{textValue(metric.value, metric.decimals)}<em>{metric.unit}</em></strong></div>)}</div>
        <div className="perf-tools"><span>稳态模型 · 无时间积分</span><button onClick={reset}>↺ 恢复默认</button><button onClick={() => setSnapshot({ p: { ...p }, cl: explorationCl, experiment, mode })}>保存参数快照</button><button onClick={exportData}>导出曲线 CSV ↗</button></div>
        {experiment === "polar" ? <>
          <PerformanceChart title="阻力极线 · 系数分解" rows={chartRows} xKey="cl" xLabel="升力系数 CL [无量纲]" yLabel="CD [无量纲]" selected={explorationCl} series={[{ key: "cd", name: "总阻力系数", color: "#147b72" }, { key: "parasite", name: "零升阻力", color: "#398aac", dashed: true }, { key: "induced", name: "诱导阻力", color: "#be8150", dashed: true }, ...savedLine("savedCd", "保存的极线")]} />
          <PerformanceChart title="升阻比 · 寻找最佳点" rows={chartRows} xKey="cl" xLabel="升力系数 CL [无量纲]" yLabel="L/D [无量纲]" selected={explorationCl} threshold={{ value: optimum.constrainedCl, label: "最佳 CL" }} series={[{ key: "ld", name: "当前升阻比", color: "#147b72" }, ...savedLine("savedLd", "保存的升阻比")]} />
        </> : experiment === "turn" ? <>
          <PerformanceChart title="倾斜角与载荷因子" rows={chartRows} xKey="bank" xLabel="倾斜角 |φ| [°]" yLabel="载荷因子 n" selected={Math.abs(p.bank)} series={[{ key: "n", name: "当前载荷", color: "#147b72" }, ...savedLine("savedN", "保存的载荷")]} />
          <PerformanceChart title="倾斜角与转弯半径" rows={chartRows} xKey="bank" xLabel="倾斜角 |φ| [°]" yLabel="转弯半径 R [m]" selected={Math.abs(p.bank)} series={[{ key: "radius", name: "当前半径", color: "#398aac" }, ...savedLine("savedRadius", "保存的半径")]} />
          <p className="perf-caption">φ = 0° 为直线飞行，半径趋于无穷，不在曲线中绘制。失速条件的点也不绘制。</p>
        </> : <>
          <PerformanceChart title={experiment === "level" ? "需用推力与可用推力" : "阻力与推力 · 平飞参考曲线"} rows={chartRows} xKey="speed" xLabel="真空速 V [m/s]" yLabel="力 [N]" selected={p.speed} threshold={{ value: level.stallSpeed, label: "平飞失速" }} series={[{ key: "drag", name: "需用推力 D", color: "#147b72" }, { key: "thrust", name: "可用推力 T", color: "#398aac", dashed: true }, ...(experiment === "level" ? [{ key: "parasite", name: "寄生阻力", color: "#be8150", dashed: true }, { key: "induced", name: "诱导阻力", color: "#8a74b3", dashed: true }] : []), ...savedLine("savedDrag", "保存的需用推力")]} />
          {experiment === "level" ? <PerformanceChart title="需用功率 · 推力乘以速度" rows={chartRows} xKey="speed" xLabel="真空速 V [m/s]" yLabel="功率 [kW]" selected={p.speed} series={[{ key: "power", name: "需用功率 DV", color: "#147b72" }, { key: "availablePower", name: "可用功率 TV", color: "#398aac", dashed: true }, ...savedLine("savedPower", "保存的需用功率")]} /> : <PerformanceChart title={mode === "climb" ? "爬升率 · 力平衡求解" : "滑翔下降率 · 向上为正"} rows={chartRows} xKey="speed" xLabel="真空速 V [m/s]" yLabel="垂直速度 [m/s]" selected={p.speed} series={[{ key: "roc", name: mode === "climb" ? "爬升/下降率" : "滑翔下降率", color: "#147b72" }, ...savedLine("savedRoc", "保存的垂直速度")]} />}
          <p className="perf-caption">留白表示失速或无适用稳态解。{experiment === "climb" ? "上图阻力以平飞配平计算作参考；下图依据当前航迹角重新求解。" : "可用推力假设与速度无关，仅为教学近似。"}</p>
        </>}
        {snapshot && <div className="perf-comparison"><div className="perf-comparison-heading"><h4>参数快照对比</h4><button onClick={() => setSnapshot(null)}>清除快照</button></div>{sameSnapshot && savedMetrics ? <><p className="small">实线为当前参数，紫色虚线为保存参数。曲线在相同横轴条件下重新计算。</p><div className="perf-table-scroll"><table><thead><tr><th>指标</th><th>当前</th><th>保存</th><th>变化</th></tr></thead><tbody>{metrics.map((metric, i) => <tr key={metric.label}><th>{metric.label} {metric.unit && `[${metric.unit}]`}</th><td>{textValue(metric.value, metric.decimals)}</td><td>{textValue(savedMetrics[i].value, metric.decimals)}</td><td>{textValue(metric.value !== null && savedMetrics[i].value !== null ? metric.value - savedMetrics[i].value! : null, metric.decimals)}</td></tr>)}</tbody></table></div><p className="small">保存：V {sameSnapshot.p.speed} m/s · m {sameSnapshot.p.mass} kg · ρ {sameSnapshot.p.density} kg/m³ · S {sameSnapshot.p.area} m² · CD₀ {sameSnapshot.p.cd0} · k {sameSnapshot.p.k} · CL,max {sameSnapshot.p.clMax}{experiment === "polar" ? ` · CL ${sameSnapshot.cl}` : experiment === "turn" ? ` · φ ${sameSnapshot.p.bank}°` : experiment === "climb" && mode === "glide" ? " · T = 0 N" : ` · T ${sameSnapshot.p.thrust} N`}</p></> : <p className="small">已保存「{names[snapshot.experiment]}{snapshot.experiment === "climb" ? snapshot.mode === "glide" ? " · 滑翔" : " · 爬升" : ""}」的快照。切换回相同实验和模式查看对比。</p>}</div>}
      </div>
      <aside className="perf-parameters"><div className="perf-parameter-head"><h3>实验参数</h3><span>SI 单位</span></div>
        {experiment === "polar" && <div className="perf-parameter perf-selected-cl"><label htmlFor="perf-cl-range">选定升力系数 CL <small>无量纲</small></label><input type="number" aria-label="选定升力系数 CL 数值" min={0} max={p.clMax} step={0.01} value={clDraft} aria-invalid={invalidKey === "selectedCl"} onChange={(e) => setClDraft(e.target.value)} onBlur={() => updateCl(clDraft)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /><input id="perf-cl-range" type="range" min={0} max={p.clMax} step={0.01} value={explorationCl} onChange={(e) => updateCl(e.target.value)} /><div className="perf-range-labels"><span>0</span><span>{p.clMax}</span></div></div>}
        {activeKeys.map((key) => <div className="perf-parameter" key={key}><label htmlFor={`perf-${key}-range`}>{labels[key].name}<small>{labels[key].unit}</small></label><input type="number" aria-label={`${labels[key].name}数值`} min={performanceBounds[key][0]} max={performanceBounds[key][1]} step={labels[key].step} value={drafts[key]} aria-invalid={invalidKey === key} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} onBlur={() => update(key, drafts[key])} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /><input id={`perf-${key}-range`} type="range" min={performanceBounds[key][0]} max={performanceBounds[key][1]} step={labels[key].step} value={p[key]} onChange={(e) => update(key, e.target.value)} /><div className="perf-range-labels"><span>{performanceBounds[key][0]}</span><span>{performanceBounds[key][1]}</span></div></div>)}
        {error && <p className="warning" role="alert">{error}</p>}
        <div className="perf-context"><span>当前动压 q</span><strong>{textValue(q, 0)} Pa</strong><span>当前重量 W</span><strong>{textValue(p.mass * 9.80665 / 1000)} kN</strong></div>
        {experiment === "polar" && <div className={`perf-task${pressureReady ? " ready" : ""}`}><div className="eyebrow">小实验 / 动压与速度</div><p>保持 ρ = 1.225 kg/m³，将速度从基准 50 m/s 加倍至 100 m/s，观察动压变为四倍。</p><span>基准 q = 1531.25 Pa · 当前为基准 {textValue(q / 1531.25)} 倍</span><button disabled={!pressureReady} onClick={() => { onTask("perf-pressure"); setRecorded((list) => list.includes("perf-pressure") ? list : [...list, "perf-pressure"]); }}>记录动压实验完成</button>{recorded.includes("perf-pressure") && <small role="status">✓ 动压实验完成情况已保存</small>}</div>}
        <div className={`perf-task${taskReady ? " ready" : ""}`}><div className="eyebrow">小实验 / 探索任务</div><p>{taskPrompt}</p><span>{taskReady ? "✓ 当前状态已达到目标" : "调整参数，达到目标条件"}</span><button disabled={!taskReady} onClick={() => { onTask(taskId); setRecorded((list) => list.includes(taskId) ? list : [...list, taskId]); }}>{recorded.includes(taskId) ? "再次记录任务完成" : "记录实验任务完成"}</button>{recorded.includes(taskId) && <small role="status">✓ 完成情况已保存到学习进度</small>}</div>
      </aside>
    </div>
  </section>;
}
