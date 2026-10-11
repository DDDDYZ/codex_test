import { useEffect, useId, useMemo, useState } from "react";
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
import { Formula } from "./Formula";
import { DEG } from "../physics/models";
import {
  DEFAULT_STABILITY_PARAMETERS,
  momentCurve,
  solveTrim,
  stabilityBounds,
  stabilityDerivatives,
  type StabilityParameters,
  type TrimResult,
} from "../physics/stability";
import "../stability.css";

export type StabilityExperiment = "margin" | "trim";
type Row = Record<string, number | null>;
type ParameterKey =
  | "cg"
  | "tailArea"
  | "tailArm"
  | "speed"
  | "density"
  | "mass"
  | "clMax"
  | "elevatorLimit";
type Snapshot = { p: StabilityParameters; experiment: StabilityExperiment };
const labels: Record<
  ParameterKey,
  { name: string; unit: string; step: number; scale: number }
> = {
  cg: { name: "重心位置 hCG", unit: "% MAC，向后为正", step: 0.5, scale: 100 },
  tailArea: { name: "水平尾翼面积 St", unit: "m²", step: 0.1, scale: 1 },
  tailArm: {
    name: "尾臂 lt",
    unit: "m，机翼 AC 至尾翼 AC",
    step: 0.1,
    scale: 1,
  },
  speed: { name: "真空速 V", unit: "m/s", step: 0.5, scale: 1 },
  density: { name: "空气密度 ρ", unit: "kg/m³", step: 0.025, scale: 1 },
  mass: { name: "质量 m", unit: "kg", step: 10, scale: 1 },
  clMax: { name: "升力系数限值 CL,max", unit: "无量纲", step: 0.05, scale: 1 },
  elevatorLimit: {
    name: "升降舵偏角上限 |δe|",
    unit: "°",
    step: 1,
    scale: 1 / DEG,
  },
};
const parameterKeys = Object.keys(labels) as ParameterKey[];
const names = { margin: "重心与静稳定裕度", trim: "纵向配平与操纵范围" };
const stabilityNames = {
  stable: "静稳定",
  neutral: "中性静稳定",
  unstable: "静不稳定",
};
function numberText(n: number | null, decimals = 2) {
  return n === null || !Number.isFinite(n) ? "—" : n.toFixed(decimals);
}
function draftsFor(p: StabilityParameters) {
  return Object.fromEntries(
    parameterKeys.map((k) => [
      k,
      String(Number((p[k] * labels[k].scale).toFixed(8))),
    ]),
  ) as Record<ParameterKey, string>;
}
function modeFor(name: string): StabilityExperiment {
  return name === "trim" ? "trim" : "margin";
}

function StabilityChart({
  title,
  rows,
  x,
  xLabel,
  yLabel,
  series,
  selected,
}: {
  title: string;
  rows: Row[];
  x: string;
  xLabel: string;
  yLabel: string;
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  selected?: number;
}) {
  return (
    <div className="stability-chart-card">
      <h4>{title}</h4>
      <div
        className="stability-chart"
        role="img"
        aria-label={`${title}；横轴 ${xLabel}；纵轴 ${yLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 3, right: 12, bottom: 22, left: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              dataKey={x}
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
              tickFormatter={(v: number) => numberText(v, 0)}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -12,
                fill: "var(--muted)",
                fontSize: 10,
              }}
            />
            <YAxis
              width={55}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
              tickFormatter={(v: number) =>
                numberText(v, yLabel.includes("Cm") ? 2 : 0)
              }
              label={{
                value: yLabel,
                position: "insideLeft",
                angle: -90,
                fill: "var(--muted)",
                fontSize: 10,
              }}
            />
            <Tooltip
              labelFormatter={(v) => `${xLabel}: ${Number(v).toFixed(2)}`}
              formatter={(v) => Number(v).toFixed(4)}
              contentStyle={{
                background: "var(--panel)",
                color: "var(--text)",
                borderColor: "var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Legend
              verticalAlign="top"
              wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 4" />
            {selected !== undefined && (
              <ReferenceLine
                x={selected}
                stroke="var(--accent)"
                strokeDasharray="2 3"
              />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                type="linear"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.7 : 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AircraftGeometry({ p }: { p: StabilityParameters }) {
  const marker = useId().replace(/:/g, "");
  const d = stabilityDerivatives(p);
  const chordPixels = Math.min(175, 445 / d.tailAc);
  const x = (h: number) => 105 + h * chordPixels;
  const tail = x(d.tailAc);
  const cg = x(p.cg);
  const np = x(d.neutralPoint);
  return (
    <div className="stability-diagram">
      <div className="stability-diagram-heading">
        <span>纵向几何 · 重心与中性点</span>
        <span>位置沿 MAC 向后增加 →</span>
      </div>
      <svg
        viewBox="0 0 660 245"
        role="img"
        aria-label={`教学飞机纵向几何，重心 ${numberText(p.cg * 100)}% MAC，中性点 ${numberText(d.neutralPoint * 100)}% MAC，静稳定裕度 ${numberText(d.staticMargin * 100)}% MAC`}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 8 8"
            markerWidth="5"
            markerHeight="5"
            refX="7"
            refY="4"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L8 4 L0 8Z" fill="var(--muted)" />
          </marker>
        </defs>
        <path
          d={`M35 121 Q45 102 80 106 L${tail + 24} 110 L${tail + 34} 122 L${tail + 8} 130 L80 131 Q45 131 35 121Z`}
          fill="var(--soft)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <path
          d={`M${tail - 10} 108 L${tail + 10} 74 L${tail + 22} 74 L${tail + 18} 113Z`}
          fill="var(--panel)"
          stroke="var(--accent)"
        />
        <path
          d={`M105 117 Q${x(0.25)} 100 ${x(1)} 120 L${x(0.5)} 126Z`}
          fill="var(--panel)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <path
          d={`M${tail - 24} 118 L${tail + 27} 120 L${tail - 2} 125Z`}
          fill="var(--panel)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <line
          x1={105}
          x2={x(1)}
          y1={153}
          y2={153}
          stroke="var(--muted)"
          markerStart={`url(#${marker})`}
          markerEnd={`url(#${marker})`}
        />
        <text
          x={(105 + x(1)) / 2}
          y={173}
          fill="var(--muted)"
          fontSize="11"
          textAnchor="middle"
        >
          MAC · c = {p.chord} m
        </text>
        <line
          x1={x(p.wingAc)}
          x2={tail}
          y1={46}
          y2={46}
          stroke="var(--muted)"
          markerStart={`url(#${marker})`}
          markerEnd={`url(#${marker})`}
        />
        <line
          x1={x(p.wingAc)}
          x2={x(p.wingAc)}
          y1={46}
          y2={112}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <line
          x1={tail}
          x2={tail}
          y1={46}
          y2={112}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <text
          x={(x(p.wingAc) + tail) / 2}
          y={35}
          fill="var(--muted)"
          textAnchor="middle"
          fontSize="11"
        >
          尾臂 lt = {numberText(p.tailArm, 1)} m
        </text>
        <circle cx={x(p.wingAc)} cy={118} r="3" fill="var(--muted)" />
        <text x="25" y="92" fill="var(--muted)" fontSize="10">
          机头 ←
        </text>
        <line
          x1={cg}
          x2={cg}
          y1={79}
          y2={197}
          stroke="#be8150"
          strokeWidth="1.6"
        />
        <circle
          cx={cg}
          cy={120}
          r="7"
          fill="var(--panel)"
          stroke="#be8150"
          strokeWidth="2"
        />
        <path
          d={`M${cg - 4} 120 H${cg + 4} M${cg} 116 V124`}
          stroke="#be8150"
        />
        <text x={cg - 6} y={74} textAnchor="end" fill="#be8150" fontSize="11">
          CG {numberText(p.cg * 100, 1)}%
        </text>
        <line
          x1={np}
          x2={np}
          y1={87}
          y2={197}
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
        <text x={np + 6} y={95} fill="var(--accent)" fontSize="11">
          NP {numberText(d.neutralPoint * 100, 1)}%
        </text>
        <line
          x1={cg}
          x2={np}
          y1={194}
          y2={194}
          stroke="var(--accent)"
          markerStart={`url(#${marker})`}
          markerEnd={`url(#${marker})`}
        />
        <text
          x="330"
          y="222"
          textAnchor="middle"
          fill="var(--accent)"
          fontSize="12"
        >
          SM = hNP − hCG = {numberText(d.staticMargin * 100)}% MAC ·{" "}
          {stabilityNames[d.stability]}
        </text>
      </svg>
      <p>
        轴向位置按比例绘制；机身与尾翼外形为几何符号，尾翼面积以参数为准。该图不模拟飞行姿态。
      </p>
    </div>
  );
}

function trimMetrics(t: TrimResult) {
  return [
    {
      label: "配平迎角 α",
      value: t.alpha === null ? null : t.alpha / DEG,
      unit: "°",
    },
    {
      label: "升降舵 δe",
      value: t.elevator === null ? null : t.elevator / DEG,
      unit: "°",
    },
    { label: "所需 CL", value: t.requiredCl, unit: "无量纲", decimals: 3 },
    { label: "升力残差 L − W", value: t.liftResidual, unit: "N", decimals: 5 },
  ];
}

export default function StabilityLab({
  onTask,
  initialExperiment = "margin",
}: {
  onTask: (id: string) => void;
  initialExperiment?: string;
}) {
  const [experiment, setExperiment] = useState<StabilityExperiment>(
    modeFor(initialExperiment),
  );
  const [p, setP] = useState<StabilityParameters>({
    ...DEFAULT_STABILITY_PARAMETERS,
  });
  const [drafts, setDrafts] = useState(draftsFor(DEFAULT_STABILITY_PARAMETERS));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [invalidKey, setInvalidKey] = useState<ParameterKey | null>(null);
  const [recorded, setRecorded] = useState<string[]>([]);
  useEffect(() => {
    setExperiment(modeFor(initialExperiment));
    setError("");
  }, [initialExperiment]);
  const d = stabilityDerivatives(p);
  const trim = solveTrim(p);
  const saved = snapshot?.experiment === experiment ? snapshot.p : null;
  const savedD = saved ? stabilityDerivatives(saved) : null;
  const savedTrim = saved ? solveTrim(saved) : null;
  const elevator = experiment === "trim" && trim.valid ? trim.elevator! : 0;
  const savedElevator =
    experiment === "trim" && savedTrim?.valid ? savedTrim.elevator! : 0;
  const curves = useMemo(() => {
    const savedMoments = saved ? momentCurve(saved, savedElevator) : null;
    return momentCurve(p, elevator).map((row, i) => ({
      alpha: row.alphaDegrees,
      cm: row.valid ? row.cm : null,
      cl: row.cl,
      valid: row.valid ? 1 : 0,
      savedCm: savedMoments?.[i].valid ? savedMoments[i].cm : null,
      savedCl: savedMoments?.[i].cl ?? null,
      savedValid: savedMoments ? (savedMoments[i].valid ? 1 : 0) : null,
    }));
  }, [p, saved, elevator, savedElevator]);
  const sweep = useMemo<Row[]>(
    () =>
      Array.from({ length: 86 }, (_, i): Row => {
        if (experiment === "margin") {
          const cg = (5 + (i * 75) / 85) / 100;
          return {
            x: cg * 100,
            margin: stabilityDerivatives({ ...p, cg }).staticMargin * 100,
            savedMargin: saved
              ? stabilityDerivatives({ ...saved, cg }).staticMargin * 100
              : null,
          };
        }
        const speed = 15 + i;
        const t = solveTrim({ ...p, speed });
        const st = saved ? solveTrim({ ...saved, speed }) : null;
        return {
          x: speed,
          alpha: t.valid ? t.alpha! / DEG : null,
          elevator: t.valid ? t.elevator! / DEG : null,
          valid: t.valid ? 1 : 0,
          savedAlpha: st?.valid ? st.alpha! / DEG : null,
          savedElevator: st?.valid ? st.elevator! / DEG : null,
          savedValid: st ? (st.valid ? 1 : 0) : null,
        };
      }),
    [p, saved, experiment],
  );
  const marginMetrics = (params: StabilityParameters) => {
    const deriv = stabilityDerivatives(params);
    return [
      {
        label: "静稳定裕度 SM",
        value: deriv.staticMargin * 100,
        unit: "% MAC",
      },
      {
        label: "俯仰力矩斜率 Cmα",
        value: deriv.cmAlpha,
        unit: "rad⁻¹",
        decimals: 3,
      },
      { label: "中性点 hNP", value: deriv.neutralPoint * 100, unit: "% MAC" },
      {
        label: "尾翼容积系数 VH",
        value: deriv.tailVolume,
        unit: "无量纲",
        decimals: 3,
      },
    ];
  };
  const metrics =
    experiment === "margin" ? marginMetrics(p) : trimMetrics(trim);
  const savedMetrics = saved
    ? experiment === "margin"
      ? marginMetrics(saved)
      : trimMetrics(savedTrim!)
    : null;
  const marginReady = Boolean(
    saved &&
    savedD &&
    p.cg - saved.cg >= 0.049 &&
    d.staticMargin > 0 &&
    savedD.staticMargin > 0 &&
    Math.abs(p.tailArea - saved.tailArea) < 1e-9 &&
    Math.abs(p.tailArm - saved.tailArm) < 1e-9,
  );
  const trimReady =
    trim.valid &&
    Math.abs(p.speed - 50) >= 5 &&
    Math.abs(trim.liftResidual!) < 1e-5 &&
    Math.abs(trim.momentResidual!) < 1e-5;
  const ready = experiment === "margin" ? marginReady : trimReady;
  const taskId =
    experiment === "margin" ? "stability-margin" : "stability-trim";
  const activeKeys: ParameterKey[] =
    experiment === "margin"
      ? ["cg", "tailArea", "tailArm"]
      : [
          "cg",
          "tailArea",
          "tailArm",
          "speed",
          "density",
          "mass",
          "clMax",
          "elevatorLimit",
        ];
  function update(key: ParameterKey, raw: string) {
    const [min, max] = stabilityBounds[key];
    const parsed = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(
      raw.trim(),
    )
      ? Number(raw) / labels[key].scale
      : NaN;
    if (
      !Number.isFinite(parsed) ||
      parsed < min - 1e-12 ||
      parsed > max + 1e-12
    ) {
      setError(
        `${labels[key].name}请输入 ${numberText(min * labels[key].scale, 2)}–${numberText(max * labels[key].scale, 2)} ${labels[key].unit} 的有限数值；未应用输入。`,
      );
      setInvalidKey(key);
      setDrafts((prev) => ({ ...prev, [key]: draftsFor(p)[key] }));
      return;
    }
    const value = Math.min(max, Math.max(min, parsed));
    setP((prev) => ({ ...prev, [key]: value }));
    setDrafts((prev) => ({ ...prev, [key]: raw }));
    setError("");
    setInvalidKey(null);
  }
  function reset() {
    setP({ ...DEFAULT_STABILITY_PARAMETERS });
    setDrafts(draftsFor(DEFAULT_STABILITY_PARAMETERS));
    setError("");
    setInvalidKey(null);
  }
  function exportCsv() {
    const header = [
      "curve",
      "alpha_deg",
      "Cm",
      "CL",
      "hCG_percent_MAC",
      "SM_percent_MAC",
      "speed_m_s",
      "trim_alpha_deg",
      "trim_elevator_deg",
      "valid_1_0",
      "saved_Cm",
      "saved_CL",
      "saved_SM_percent_MAC",
      "saved_trim_alpha_deg",
      "saved_trim_elevator_deg",
      "saved_valid_1_0",
      "fixed_elevator_deg",
      "saved_fixed_elevator_deg",
    ];
    const configFields: [keyof StabilityParameters, string][] = [
      ["speed", "speed_m_s"],
      ["density", "density_kg_m3"],
      ["mass", "mass_kg"],
      ["area", "area_m2"],
      ["chord", "chord_m"],
      ["cg", "hCG_fraction_MAC"],
      ["wingAc", "wing_AC_fraction_MAC"],
      ["tailArea", "tail_area_m2"],
      ["tailArm", "tail_arm_m"],
      ["wingLiftSlope", "wing_lift_slope_per_rad"],
      ["tailLiftSlope", "tail_lift_slope_per_rad"],
      ["tailEfficiency", "tail_dynamic_pressure_ratio"],
      ["downwashGradient", "downwash_gradient"],
      ["elevatorEffectiveness", "elevator_effectiveness"],
      ["wingZeroLift", "wing_CL0"],
      ["wingAcMoment", "wing_AC_Cm0"],
      ["clMax", "CLmax"],
      ["elevatorLimit", "elevator_limit_rad"],
    ];
    const configHeader = [
      ...configFields.map(([, name]) => `config_${name}`),
      ...configFields.map(([, name]) => `saved_config_${name}`),
    ];
    const configValues = [
      ...configFields.map(([key]) => p[key]),
      ...configFields.map(([key]) => saved?.[key] ?? null),
    ];
    const lines = curves.map((r) => [
      "moment",
      r.alpha,
      r.cm,
      r.cl,
      null,
      null,
      null,
      null,
      null,
      r.valid,
      r.savedCm,
      r.savedCl,
      null,
      null,
      null,
      r.savedValid,
      elevator / DEG,
      saved ? savedElevator / DEG : null,
      ...configValues,
    ]);
    const sweepLines = sweep.map((r) =>
      experiment === "margin"
        ? [
            "margin",
            null,
            null,
            null,
            r.x,
            r.margin,
            null,
            null,
            null,
            1,
            null,
            null,
            r.savedMargin,
            null,
            null,
            saved ? 1 : null,
            null,
            null,
            ...configValues,
          ]
        : [
            "trim",
            null,
            null,
            null,
            null,
            null,
            r.x,
            r.alpha,
            r.elevator,
            r.valid,
            null,
            null,
            null,
            r.savedAlpha,
            r.savedElevator,
            r.savedValid,
            null,
            null,
            ...configValues,
          ],
    );
    const csv =
      [...header, ...configHeader].join(",") +
      "\n" +
      [...lines, ...sweepLines]
        .map((row) => row.map((n) => n ?? "").join(","))
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `flight-stability-${experiment}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="stability-lab" id="stability-lab">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PHASE 03 / LONGITUDINAL STATICS</div>
          <h2>移动重心，理解稳定与配平。</h2>
        </div>
        <span className="badge">2 个纵向实验</span>
      </div>
      <div
        className="stability-tabs"
        role="tablist"
        aria-label="纵向静稳定与配平实验"
      >
        {(["margin", "trim"] as const).map((mode, i) => (
          <button
            key={mode}
            role="tab"
            id={`stability-tab-${mode}`}
            aria-controls="stability-panel"
            aria-selected={mode === experiment}
            className={mode === experiment ? "active" : ""}
            onClick={() => {
              setExperiment(mode);
              setError("");
              setInvalidKey(null);
            }}
          >
            <span>0{i + 1}</span>
            {names[mode]}
          </button>
        ))}
      </div>
      <div
        className="stability-grid"
        id="stability-panel"
        role="tabpanel"
        aria-labelledby={`stability-tab-${experiment}`}
      >
        <aside className="stability-theory">
          <div className="eyebrow">实验手册 / 固定升降舵</div>
          <h3>{names[experiment]}</h3>
          <p>
            {experiment === "margin"
              ? "保持升降舵不动，迎角略微增大时，负的力矩斜率会产生低头的恢复力矩。重心后移会减小静稳定裕度；增大水平尾翼或尾臂，通常使中性点后移。"
              : "配平同时要求 L = W 与重心处 M = 0。迎角与升降舵一起求解；负升降舵偏角表示后缘向上。配平能否实现，还取决于升力、迎角和舵面限制。"}
          </p>
          <Formula
            value={
              experiment === "margin"
                ? String.raw`SM=h_{NP}-h_{CG},\quad C_{m_\alpha}=-C_{L_\alpha}SM`
                : String.raw`\begin{bmatrix}C_{L_\alpha}&C_{L_{\delta_e}}\\C_{m_\alpha}&C_{m_{\delta_e}}\end{bmatrix}\begin{bmatrix}\alpha\\\delta_e\end{bmatrix}=\begin{bmatrix}W/(qS)-C_{L0}\\-C_{m0}\end{bmatrix}`
            }
          />
          <Formula value="C_m=C_{m0}+C_{m_\alpha}\alpha+C_{m_{\delta_e}}\delta_e" />
          <div className="model-note">
            <strong>符号与模型边界</strong>
            <p>
              α、δe 在计算中用 rad；Cm 为正表示抬头；δe
              为正表示舵面后缘向下，尾翼升力增加，产生低头力矩。图表角度用 °。
            </p>
            <p>
              假想教学飞机，固定升降舵、线性附着流、无风。总升力包含尾翼贡献。静稳定只判断初始恢复趋势，不能证明动态衰减或飞行安全。
            </p>
            <p>
              α ∈ [−8°, 15°]，|CL| ≤ CL,max
              是模型有效性边界；不模拟失速。配平页只解竖直力与俯仰力矩，不检查推力、阻力或侧向平衡。
            </p>
          </div>
          <details className="stability-model-details">
            <summary>查看尾翼理论与固定系数</summary>
            <Formula value="b_t=\eta_t a_t\frac{S_t}{S}(1-\epsilon_\alpha),\quad a=a_w+b_t" />
            <Formula value="h_{NP}=h_{ac,w}+\frac{b_t}{a}\frac{l_t}{c},\quad V_H=\frac{S_t l_t}{Sc}" />
            <p>
              aw = 5.2 rad⁻¹；at = 4 rad⁻¹；尾翼动压比 ηt = 0.9；下洗梯度 εα =
              0.35；升降舵效率 τ = 0.45。S = 16 m²，c = 1.5 m，机翼 AC = 25%
              MAC；CL0 = 0.22，机翼 AC 力矩系数 =
              −0.04。零迎角时假定尾翼基准升力为零，已由固定安装角抵消基准下洗。
            </p>
            <p>
              Cm0 = −0.04 + CL0(hCG − 0.25)；CLδe = ηt at τ St/S；Cmδe =
              −CLδe(hAC,t −
              hCG)。未包含机身与推进力矩。以上均为自选教学参数，不是某型真飞机数据。
            </p>
          </details>
          <a
            className="reference"
            href="https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/"
            target="_blank"
            rel="noreferrer"
          >
            参考：MIT · Aircraft Stability and Control ↗
          </a>
        </aside>
        <div className="stability-workspace">
          <AircraftGeometry p={p} />
          <p
            className={`stability-status ${d.stability === "unstable" ? "warning" : ""}`}
            role="status"
          >
            <strong>{stabilityNames[d.stability]}</strong> · Cmα ={" "}
            {numberText(d.cmAlpha, 3)} rad⁻¹ · 迎角增加 1°，力矩系数改变{" "}
            {numberText(d.cmAlpha * DEG, 4)}。
            {d.stability === "stable"
              ? "恢复增量为低头方向。"
              : d.stability === "unstable"
                ? "增量沿抬头方向。"
                : "一阶迎角扰动不产生恢复增量。"}
          </p>
          {experiment === "trim" && (
            <p
              className={`stability-status${trim.valid ? "" : " warning"}`}
              role="status"
            >
              <strong>{trim.valid ? "纵向配平可行" : "纵向配平不可行"}</strong>{" "}
              · {trim.message}
              {!trim.valid && trim.candidateElevator !== null
                ? ` 理论所需 δe = ${numberText(trim.candidateElevator / DEG)}°，α = ${numberText(trim.candidateAlpha! / DEG)}°；未采用为可行解。`
                : ""}
            </p>
          )}
          <div className="stability-readouts">
            {metrics.map((m) => (
              <div key={m.label}>
                <small>{m.label}</small>
                <strong>
                  {numberText(m.value, "decimals" in m ? m.decimals : 2)}
                  <em>{m.unit}</em>
                </strong>
              </div>
            ))}
          </div>
          {experiment === "trim" && (
            <p className="stability-caption">
              俯仰力矩残差 M = {numberText(trim.momentResidual, 6)} N·m；负 δe
              表示后缘向上。即使是静不稳定的构型，也可能存在代数配平解。
            </p>
          )}
          <div className="stability-tools">
            <span>实时静态模型 · 不积分动态响应</span>
            <button onClick={reset}>↺ 恢复默认</button>
            <button onClick={() => setSnapshot({ p: { ...p }, experiment })}>
              保存参数快照
            </button>
            <button onClick={exportCsv}>导出曲线 CSV ↗</button>
          </div>
          <StabilityChart
            title={`俯仰力矩随迎角变化 · 固定 δe = ${numberText(elevator / DEG)}°`}
            rows={curves}
            x="alpha"
            xLabel="迎角 α [°]"
            yLabel="Cm [无量纲]"
            selected={
              experiment === "trim" && trim.valid
                ? trim.alpha! / DEG
                : undefined
            }
            series={[
              { key: "cm", name: "当前参数", color: "#147b72" },
              ...(saved
                ? [
                    {
                      key: "savedCm",
                      name: `快照 · δe ${numberText(savedElevator / DEG)}°`,
                      color: "#9c82bd",
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
          <p className="stability-caption">
            斜率表示固定升降舵时的静稳定性。零力矩截点只说明 M = 0，仍须检查 L =
            W。留白表示 |CL| 超出模型界限；不可行配平时，上图改用 δe = 0°。
          </p>
          {experiment === "margin" ? (
            <StabilityChart
              title="重心后移，静稳定裕度减小"
              rows={sweep}
              x="x"
              xLabel="重心 hCG [% MAC]"
              yLabel="SM [% MAC]"
              selected={p.cg * 100}
              series={[
                { key: "margin", name: "当前尾翼构型", color: "#147b72" },
                ...(saved
                  ? [
                      {
                        key: "savedMargin",
                        name: "保存的尾翼构型",
                        color: "#9c82bd",
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <>
              <StabilityChart
                title="空速与所需配平角度"
                rows={sweep}
                x="x"
                xLabel="真空速 V [m/s]"
                yLabel="角度 [°]"
                selected={p.speed}
                series={[
                  { key: "alpha", name: "配平迎角 α", color: "#147b72" },
                  { key: "elevator", name: "配平升降舵 δe", color: "#be8150" },
                  ...(saved
                    ? [
                        {
                          key: "savedAlpha",
                          name: "快照迎角",
                          color: "#9c82bd",
                          dashed: true,
                        },
                        {
                          key: "savedElevator",
                          name: "快照升降舵",
                          color: "#398aac",
                          dashed: true,
                        },
                      ]
                    : []),
                ]}
              />
              <p className="stability-caption">
                留白表示
                CL、迎角、操纵范围或方程独立性未通过检查；不把不可行角度画成配平状态。
              </p>
            </>
          )}
          {snapshot && (
            <div className="stability-comparison">
              <div className="stability-comparison-heading">
                <h4>参数快照对比</h4>
                <button onClick={() => setSnapshot(null)}>清除快照</button>
              </div>
              {savedMetrics && saved ? (
                <>
                  <p>虚线在相同横轴条件下重新计算；表格比较各自保存的状态。</p>
                  <div className="stability-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>指标</th>
                          <th>当前</th>
                          <th>快照</th>
                          <th>变化</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m, i) => (
                          <tr key={m.label}>
                            <th>
                              {m.label} [{m.unit}]
                            </th>
                            <td>
                              {numberText(
                                m.value,
                                "decimals" in m ? m.decimals : 2,
                              )}
                            </td>
                            <td>
                              {numberText(
                                savedMetrics[i].value,
                                "decimals" in m ? m.decimals : 2,
                              )}
                            </td>
                            <td>
                              {numberText(
                                m.value === null ||
                                  savedMetrics[i].value === null
                                  ? null
                                  : m.value - savedMetrics[i].value!,
                                3,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    快照：CG {numberText(saved.cg * 100, 1)}% MAC · St{" "}
                    {saved.tailArea} m² · lt {saved.tailArm} m · V {saved.speed}{" "}
                    m/s · ρ {saved.density} kg/m³ · m {saved.mass} kg · CL,max{" "}
                    {saved.clMax} · |δe| ≤{" "}
                    {numberText(saved.elevatorLimit / DEG, 0)}°
                  </p>
                </>
              ) : (
                <p>
                  已保存「{names[snapshot.experiment]}
                  」快照；回到该实验查看比较。
                </p>
              )}
            </div>
          )}
        </div>
        <aside className="stability-parameters">
          <div className="stability-parameter-heading">
            <h3>实验参数</h3>
            <span>数值与滑块同步</span>
          </div>
          {activeKeys.map((key) => {
            const meta = labels[key];
            const [min, max] = stabilityBounds[key];
            return (
              <div className="stability-parameter" key={key}>
                <label htmlFor={`stability-${key}-range`}>
                  {meta.name}
                  <small>{meta.unit}</small>
                </label>
                <input
                  type="number"
                  aria-label={`${meta.name}数值`}
                  min={min * meta.scale}
                  max={max * meta.scale}
                  step={meta.step}
                  value={drafts[key]}
                  aria-invalid={invalidKey === key}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  onBlur={() => update(key, drafts[key])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <input
                  type="range"
                  id={`stability-${key}-range`}
                  min={min * meta.scale}
                  max={max * meta.scale}
                  step={meta.step}
                  value={p[key] * meta.scale}
                  onChange={(e) => update(key, e.target.value)}
                />
                <div className="stability-range-labels">
                  <span>
                    {numberText(min * meta.scale, key === "density" ? 1 : 0)}
                  </span>
                  <span>
                    {numberText(max * meta.scale, key === "density" ? 1 : 0)}
                  </span>
                </div>
              </div>
            );
          })}
          {error && (
            <p className="warning" role="alert">
              {error}
            </p>
          )}
          <div className="stability-context">
            <span>总升力斜率 CLα</span>
            <strong>{numberText(d.clAlpha, 3)} rad⁻¹</strong>
            <span>固定翼参数 S / c</span>
            <strong>16 m² / 1.5 m</strong>
            {experiment === "trim" && (
              <>
                <span>动压 q</span>
                <strong>{numberText(trim.q, 0)} Pa</strong>
                <span>重量 W</span>
                <strong>{numberText(trim.weight, 1)} N</strong>
              </>
            )}
          </div>
          <div className={`stability-task${ready ? " ready" : ""}`}>
            <div className="eyebrow">小实验 / 探索任务</div>
            <p>
              {experiment === "margin"
                ? "恢复默认并保存快照，保持尾翼参数不变，把重心向后移动至少 5% MAC（例如 30% → 35%），仍保留正静稳定裕度。比较斜率与裕度的变化。"
                : "把空速从基准 50 m/s 改变至少 5 m/s（例如 40 m/s），取得有效纵向配平，检查升力与力矩残差。"}
            </p>
            <span>
              {ready ? "✓ 当前状态已达到目标" : "调整参数，达到目标条件"}
            </span>
            <button
              disabled={!ready}
              onClick={() => {
                onTask(taskId);
                setRecorded((old) =>
                  old.includes(taskId) ? old : [...old, taskId],
                );
              }}
            >
              {recorded.includes(taskId)
                ? "再次记录任务完成"
                : "记录实验任务完成"}
            </button>
            {recorded.includes(taskId) && (
              <small role="status">✓ 实验完成情况已保存到学习进度</small>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
