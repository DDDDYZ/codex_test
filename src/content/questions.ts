import { stabilityQuestions } from "./phase3";
import { dynamicsQuestions } from "./phase4";
import { controlQuestions } from "./phase5";

export type LearningLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface QuestionBase {
  id: string;
  level: LearningLevel;
  lessonId: string;
  title: string;
  explanation: string;
}

export interface ChoiceQuestion extends QuestionBase {
  kind: "choice";
  options: string[];
  answer: number;
}

export interface NumericQuestion extends QuestionBase {
  kind: "numeric";
  answer: number;
  tolerance: number;
  unit: string;
}

export type Question = ChoiceQuestion | NumericQuestion;

/** Stable IDs preserve the original four exercise results during migration. */
const foundationPerformanceQuestions: Question[] = [
  {
    id: "balance",
    level: 1,
    lessonId: "first-flight",
    kind: "choice",
    title: "飞机做定常水平直线飞行时，哪一组关系成立？推力沿空速方向。",
    options: ["L = W 且 T = D", "L > W 且 T > D", "只有 L = W 即可"],
    answer: 0,
    explanation:
      "定常水平直线飞行要求加速度为零，两个方向都必须满足力平衡：L = W、T = D。",
  },
  {
    id: "speed",
    level: 1,
    lessonId: "first-flight",
    kind: "choice",
    title: "CL、ρ、S 固定，空速从 40 m/s 增至 80 m/s，升力变为原来的多少倍？",
    options: ["2 倍", "4 倍", "8 倍"],
    answer: 1,
    explanation:
      "L = ½ρV²SCL。其余参数固定，升力之比为 (80/40)² = 4；这里没有要求维持平飞。",
  },
  {
    id: "stall",
    level: 1,
    lessonId: "first-flight",
    kind: "choice",
    title: "在第一阶段实验的示意失速区，继续增大迎角会怎样？",
    options: ["升力系数永远线性增加", "升力系数开始下降", "空气密度变为零"],
    answer: 1,
    explanation:
      "大范围流动分离使升力系数降低。第一阶段的失速区曲线是教学示意，不能用来预测真实飞机的失速过程。",
  },
  {
    id: "calculation",
    level: 1,
    lessonId: "first-flight",
    kind: "numeric",
    title:
      "假想参数 ρ = 1.225 kg/m³、V = 50 m/s、S = 16 m²、CL = 0.6，升力是多少 N？",
    answer: 14700,
    tolerance: 1,
    unit: "N",
    explanation: "L = ½ × 1.225 × 50² × 16 × 0.6 = 14700 N。允许误差 ±1 N。",
  },
  {
    id: "p2-pressure-square",
    level: 2,
    lessonId: "dynamic-pressure",
    kind: "choice",
    title: "密度不变，空速增加一倍，动压如何变化？",
    options: ["变为两倍", "变为四倍", "保持不变"],
    answer: 1,
    explanation: "q = ½ρV²；空速翻倍使动压变为 2² = 4 倍。",
  },
  {
    id: "p2-pressure-number",
    level: 2,
    lessonId: "dynamic-pressure",
    kind: "numeric",
    title: "假想参数 ρ = 1.225 kg/m³、空速 V = 50 m/s，动压是多少 Pa？",
    answer: 1531.25,
    tolerance: 0.5,
    unit: "Pa",
    explanation: "q = ½ × 1.225 × 50² = 1531.25 Pa。允许误差 ±0.5 Pa。",
  },
  {
    id: "p2-pressure-ratio",
    level: 2,
    lessonId: "dynamic-pressure",
    kind: "choice",
    title: "CL、CD 和 S 均固定，只把动压减半，升阻比 L/D 如何变化？",
    options: ["减半", "增加一倍", "不变"],
    answer: 2,
    explanation:
      "L 与 D 都减半；L/D = CL/CD，因此升阻比不变。真实平飞若调整 CL，必须重新判断。",
  },
  {
    id: "p2-polar-balance",
    level: 2,
    lessonId: "polar",
    kind: "choice",
    title:
      "抛物线极曲线 CD = CD0 + kCL² 中，若解析最优 CL* 未超过 CLmax，最大升阻比点满足什么条件？",
    options: ["CD0 = kCL²", "CD = 0", "CL 必须等于 CLmax"],
    answer: 0,
    explanation:
      "对 E = CL/(CD0 + kCL²) 求导，极值条件为 CD0 − kCL² = 0；还要检查 CL* 不超过上限。",
  },
  {
    id: "p2-polar-number",
    level: 2,
    lessonId: "polar",
    kind: "numeric",
    title:
      "假想极曲线 CD0 = 0.025、k = 0.055、CLmax = 1.4，最佳升阻比对应的 CL 是多少？",
    answer: 0.674199862463242,
    tolerance: 0.001,
    unit: "无量纲",
    explanation:
      "CL* = √(CD0/k) = √(0.025/0.055) ≈ 0.6742，低于 CLmax。允许误差 ±0.001。",
  },
  {
    id: "p2-polar-goal",
    level: 2,
    lessonId: "polar",
    kind: "choice",
    title: "无风定常滑翔时，最大升阻比直接对应哪一种性能？",
    options: ["最小下降角", "所有条件下的最小下沉率", "最大发动机功率"],
    answer: 0,
    explanation:
      "tan|γ| = D/L。最大 L/D 给出最小下降角和每单位高度损失的最大无风水平距离；下沉率还受空速影响。",
  },
  {
    id: "p2-level-cl",
    level: 2,
    lessonId: "level-flight",
    kind: "numeric",
    title:
      "假想飞机 m = 1000 kg、g = 9.80665 m/s²、ρ = 1.225 kg/m³、S = 16 m²，以 50 m/s 定常平飞。所需 CL 是多少？",
    answer: 0.4002714285714286,
    tolerance: 0.0005,
    unit: "无量纲",
    explanation:
      "W = 9806.65 N，qS = ½ × 1.225 × 50² × 16 = 24500 N；CL = W/(qS) ≈ 0.40027。允许误差 ±0.0005。",
  },
  {
    id: "p2-level-speed",
    level: 2,
    lessonId: "level-flight",
    kind: "choice",
    title:
      "重量、密度与机翼面积固定，定常平飞的空速增加一倍，所需 CL 如何变化？",
    options: ["变为四倍", "变为四分之一", "保持不变"],
    answer: 1,
    explanation:
      "维持平飞要求 L = W，故 CLreq = 2W/(ρV²S)。空速加倍时所需 CL 降为四分之一。",
  },
  {
    id: "p2-level-feasible",
    level: 2,
    lessonId: "level-flight",
    kind: "choice",
    title:
      "本教学模型要在某一空速维持定常水平直线飞行，哪一组条件需要同时成立？",
    options: [
      "只要可用推力大于零",
      "只要 CLreq 不超过 CLmax",
      "CLreq 不超过 CLmax，并且可用推力 T 等于阻力 D",
    ],
    answer: 2,
    explanation:
      "升力需求必须可实现，沿空速方向也必须力平衡。T > D 在保持高度时意味着加速趋势，并非该空速的定常平飞。",
  },
  {
    id: "p2-glide-lift",
    level: 2,
    lessonId: "climb-glide",
    kind: "choice",
    title: "无推力定常直线滑翔，航迹角 γ 向上为正。哪组精确关系成立？",
    options: ["L = W，D = 0", "L = W cos γ，D = −W sin γ", "L = 0，D = W"],
    answer: 1,
    explanation:
      "滑翔时 γ < 0。垂直航迹方向 L = W cos γ，沿航迹方向 0 − D = W sin γ，因此 D = −W sin γ > 0。",
  },
  {
    id: "p2-climb-rate",
    level: 2,
    lessonId: "climb-glide",
    kind: "numeric",
    title:
      "假想飞机以空速 50 m/s 沿 5° 向上航迹定常爬升。爬升率是多少 m/s？（使用角度制）",
    answer: 4.357787137382909,
    tolerance: 0.02,
    unit: "m/s",
    explanation:
      "ḣ = V sin γ = 50 × sin(5°) ≈ 4.358 m/s。不是 50 × 5；使用计算器时须选择角度制。允许误差 ±0.02 m/s。",
  },
  {
    id: "p2-glide-distance",
    level: 2,
    lessonId: "climb-glide",
    kind: "numeric",
    title:
      "无风、参数不变的定常直线滑翔，升阻比 L/D = 12。损失 1000 m 高度，可前进多少 m 水平距离？不计进近余量。",
    answer: 12000,
    tolerance: 10,
    unit: "m",
    explanation:
      "x/H = L/D，因此 x = 1000 × 12 = 12000 m。该理想结果不含风、转弯与实际进近余量。允许误差 ±10 m。",
  },
  {
    id: "p2-turn-load",
    level: 2,
    lessonId: "turn",
    kind: "choice",
    title: "60° 倾侧、保持高度的协调转弯，载荷因数 n 是多少？",
    options: ["1", "2", "4"],
    answer: 1,
    explanation: "n = 1/cos φ。cos 60° = 0.5，所以 n = 2。",
  },
  {
    id: "p2-turn-radius",
    level: 2,
    lessonId: "turn",
    kind: "numeric",
    title:
      "假想飞机以空速 50 m/s、45° 倾侧保持高度协调转弯，g = 9.80665 m/s²。转弯半径是多少 m？",
    answer: 254.92905324448207,
    tolerance: 0.5,
    unit: "m",
    explanation:
      "R = V²/(g tan|φ|) = 50²/(9.80665 × tan45°) ≈ 254.929 m。允许误差 ±0.5 m。",
  },
  {
    id: "p2-turn-stall",
    level: 2,
    lessonId: "turn",
    kind: "choice",
    title:
      "重量、密度和构型不变，载荷因数由 1 增至 2，理论失速空速变为原来的多少倍？",
    options: ["2 倍", "√2 倍", "1/√2 倍"],
    answer: 1,
    explanation:
      "Vs,n = Vs,1√n。两倍升力需求要求失速空速提高到 √2 ≈ 1.414 倍；不是两倍。",
  },
];

export const questionBank: Question[] = [
  ...foundationPerformanceQuestions,
  ...stabilityQuestions,
  ...dynamicsQuestions,
  ...controlQuestions,
];

/** Accept finite decimal input only; blanks never become numeric zero. */
export function gradeQuestion(
  question: Question,
  value: string | number | undefined,
): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))
      return false;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  if (question.kind === "choice") {
    return (
      Number.isInteger(numeric) &&
      numeric >= 0 &&
      numeric < question.options.length &&
      numeric === question.answer
    );
  }
  return (
    Number.isFinite(question.answer) &&
    Number.isFinite(question.tolerance) &&
    question.tolerance >= 0 &&
    Math.abs(numeric - question.answer) <= question.tolerance
  );
}
