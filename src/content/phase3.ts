import type { Question } from "./questions";

export interface StabilityLesson {
  id: string;
  title: string;
  experiment: "margin" | "trim";
  objective: string;
  observation: string;
  question: string;
  predictionOptions: string[];
  predictionAnswer: number;
  explanation: string;
  steps: {
    formula: string;
    law: string;
    previous: string;
    reason: string;
  }[];
  assumptions: string;
  variables: string;
  summary: string;
  references: { name: string; url: string }[];
  task: { id: string; prompt: string };
  level: 3;
}

const stabilityReference = {
  name: "MIT OpenCourseWare · 16.333 Aircraft Stability and Control",
  url: "https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/",
};
const handbookReference = {
  name: "FAA · Pilot’s Handbook of Aeronautical Knowledge（稳定性与操纵）",
  url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak",
};
const stabilityAssumptions =
  "假想教学飞机，SI 单位；默认 m = 1000 kg、g = 9.80665 m/s²、ρ = 1.225 kg/m³、V = 50 m/s、S = 16 m²、平均气动弦 c̄ = 1.5 m。机翼气动中心 h_ac = 0.25，重心 h_cg = 0.30，位置均以 MAC 前缘为零、向后为正。尾翼面积 S_t = 3.2 m²，尾臂 l_t = 4 m 从机翼气动中心量到尾翼气动中心。a_w = 5.2/rad、a_t = 4/rad、尾翼动压比 η = 0.9、下洗梯度 dε/dα = 0.35、升降舵效率 τ = 0.45。采用低速、附着流的小角度线性模型，迎角与舵角参与计算时使用弧度；气动系数不随速度改变。参考 α = δ = 0 时，机翼 CL0 = 0.22、尾翼升力为零，机翼气动中心力矩系数 Cmac = −0.04。忽略机身、推进力矩、弹性、地面效应与非线性下洗。模型有效范围设为 α ∈ [−8°, 15°]、|δ| ≤ 20°、|CL| ≤ CLmax = 1.4；这些是教学模型边界，不描述失速后的运动。";

export const stabilityLessons: StabilityLesson[] = [
  {
    id: "static-stability",
    title: "纵向静稳定：重心为何影响恢复力矩",
    experiment: "margin",
    objective:
      "从机翼与尾翼的力矩增量推导中性点与静稳定裕度，区分初始恢复趋势、配平和随时间的运动。",
    observation:
      "保持默认尾翼参数，先保存重心 30% MAC 的基线，再将重心后移至 35% MAC。中性点仍约为 47.02% MAC，静稳定裕度由 17.02% MAC 降至 12.02% MAC。固定升降舵并给迎角一个小正扰动，两种构型都产生低头的力矩增量，但后移重心后的恢复作用较弱。",
    question:
      "升降舵固定，重心位于中性点前方。迎角受到一个小的正扰动，初始俯仰力矩增量是什么方向？",
    predictionOptions: [
      "低头，倾向于减小迎角扰动",
      "抬头，倾向于放大迎角扰动",
      "力矩必定为零，因为已经存在配平点",
    ],
    predictionAnswer: 0,
    explanation:
      "正迎角扰动使机翼与尾翼升力发生变化，它们绕重心产生的力矩共同决定恢复趋势。中性点是固定升降舵时总俯仰力矩对迎角的斜率恰为零的重心位置。重心在中性点前方时，静稳定裕度为正，Cmα 为负，因此迎角增加带来低头的力矩增量。将重心后移会减小这一裕度；越过中性点后，力矩增量反而放大扰动。这里判断的是扰动刚发生时的静态趋势，飞机是否振荡、是否最终返回原状态还取决于惯性与气动阻尼，本实验没有计算这些动态因素。",
    steps: [
      {
        formula:
          "r=\\frac{S_t}{S},\\qquad b_t=\\eta a_t r\\left(1-\\frac{d\\epsilon}{d\\alpha}\\right),\\qquad a=a_w+b_t",
        law: "把机翼与尾翼的升力斜率统一到机翼参考面积。",
        previous: "尾翼所见迎角增量为 (1 − dε/dα)Δα",
        reason:
          "下洗减弱尾翼迎角的增量；η 表示尾翼动压与机翼参考动压之比。默认 r = 0.2、bt = 0.468/rad、总升力斜率 a = 5.668/rad。总升力包括尾翼贡献。",
      },
      {
        formula:
          "h_t=h_{ac}+\\frac{l_t}{\\bar c},\\qquad C_{m\\alpha}=a_w(h_{cg}-h_{ac})+b_t(h_{cg}-h_t)",
        law: "以重心为矩心叠加两个升力增量的俯仰力矩。",
        previous: "俯仰力矩 M = qSc̄Cm，抬头为正",
        reason:
          "h 是距离除以 c̄ 的无量纲位置。重心后方的尾翼产生向上的力增量时给出低头力矩；这里 lt 从机翼气动中心量起，故 ht = 0.25 + 4/1.5 ≈ 2.9167。",
      },
      {
        formula:
          "C_{m\\alpha}=a(h_{cg}-h_{np}),\\qquad h_{np}=h_{ac}+\\frac{b_t}{a}\\frac{l_t}{\\bar c}",
        law: "把力矩斜率整理为相对中性点的位置差。",
        previous: "Cma = aw(hcg − hac) + bt(hcg − ht)，a = aw + bt",
        reason:
          "令 Cma = 0 可解出中性点。分母使用机翼与尾翼的总升力斜率 a；默认 hnp ≈ 0.47018，即 47.02% MAC。尾翼参数固定时，移动重心不会移动这个中性点。",
      },
      {
        formula: "SM=h_{np}-h_{cg},\\qquad C_{m\\alpha}=-a\\,SM",
        law: "定义固定升降舵的纵向静稳定裕度。",
        previous: "中性点使 Cma = 0",
        reason:
          "SM > 0 给出 Cma < 0 的恢复趋势；SM = 0 为该线性模型中的中性静稳定；SM < 0 为静不稳定。默认 SM ≈ 0.17018、Cma = −0.9646/rad。17.02% MAC 是位置差，不是角度或力矩。",
      },
      {
        formula:
          "\\Delta M=qS\\bar c\\,C_{m\\alpha}\\Delta\\alpha,\\qquad \\Delta\\delta=0",
        law: "在舵角固定时用局部斜率计算小扰动的力矩增量。",
        previous: "M = qSc̄Cm，Cm 对 α 的斜率为 Cma",
        reason:
          "正 Δα 与负 Cma 相乘给出负 ΔM，即低头趋势。应观察相对原状态的力矩增量；若原状态尚未配平，总力矩还包括原来的偏置。此式没有给出扰动随时间衰减的速度。",
      },
      {
        formula:
          "\\Delta SM=-\\Delta h_{cg},\\qquad \\Delta C_{m\\alpha}=a\\,\\Delta h_{cg}",
        law: "在固定气动参数下比较重心移动前后的静稳定量。",
        previous: "hnp 与 a 保持不变，SM = hnp − hcg",
        reason:
          "将重心从 30% 后移到 35% MAC，裕度减少 0.05，也就是 5 个百分点；新的 SM ≈ 0.12018、Cma = −0.6812/rad。恢复趋势仍在，但相同迎角扰动的恢复力矩增量减小。",
      },
    ],
    assumptions: stabilityAssumptions,
    variables:
      "S、St：机翼与尾翼面积 [m²]；c̄：平均气动弦 [m]；lt：机翼气动中心至尾翼气动中心的距离 [m]；hac、hcg、ht、hnp：以 MAC 前缘为零的无量纲位置，乘 100 即 % MAC；r = St/S：面积比；aw、at、bt、a：升力斜率 [rad⁻¹]；η：尾翼动压比；dε/dα：下洗梯度；SM：无量纲静稳定裕度；Cmα：俯仰力矩系数对迎角的斜率 [rad⁻¹]；α：迎角 [rad]；δ：升降舵角 [rad]，后缘向下为正；q：动压 [Pa]；M：俯仰力矩 [N·m]，抬头为正。",
    summary:
      "固定升降舵时，重心在中性点前方意味着正静稳定裕度和负 Cmα。静稳定描述初始恢复趋势；配平描述当前力与力矩平衡，两者需要分别检验。",
    references: [stabilityReference, handbookReference],
    task: {
      id: "stability-margin",
      prompt:
        "在默认尾翼参数下将重心设为 30% MAC，确认静稳定裕度为正并保存基线快照。保持尾翼参数不变，把重心后移至 35% MAC 或更后的位置，确认裕度仍为正且比基线至少减少 0.05（5 个百分点），再记录实验结果。",
    },
    level: 3,
  },
  {
    id: "trim",
    title: "纵向配平：同时求迎角与升降舵角",
    experiment: "trim",
    objective:
      "联立升力与俯仰力矩平衡求配平迎角及舵角，检查角度、升力系数边界和残差，并解释速度变化带来的配平变化。",
    observation:
      "默认重心与尾翼参数下，50 m/s 时配平迎角约为 2.069°、升降舵角约为 −4.314°。把空速降到 40 m/s，配平迎角约为 4.503°、舵角约为 −7.083°。两组解都在本模型范围内，升力残差与俯仰力矩残差接近零；负舵角表示升降舵后缘向上。",
    question:
      "在本页后缘向下为正的舵角约定中，增加升降舵角 δ 会给位于重心后方的尾翼带来哪种力与力矩增量？",
    predictionOptions: [
      "向上的尾翼力增量与低头力矩增量",
      "向上的尾翼力增量与抬头力矩增量",
      "只改变升力，俯仰力矩完全不变",
    ],
    predictionAnswer: 0,
    explanation:
      "配平要求升力满足当前重量需求，同时总俯仰力矩为零。迎角会改变机翼与尾翼升力；升降舵也同时改变尾翼升力和它绕重心的力矩，因此必须联立两个方程。δ 正方向取升降舵后缘向下，会增加尾翼向上的力并产生低头力矩；负 δ 则提供相反的增量。对默认的负机翼气动中心力矩，解出的负舵角补偿低头作用。静稳定裕度决定力矩对迎角的斜率，不保证配平解落入舵角和迎角范围；中性静稳定也不自动意味着无法配平。",
    steps: [
      {
        formula:
          "q=\\frac12\\rho V^2,\\qquad W=mg,\\qquad C_{L,\\mathrm{req}}=\\frac{W}{qS}",
        law: "用水平飞行的竖直力平衡计算所需升力系数。",
        previous: "L = qSCL = W",
        reason:
          "默认 W = 9806.65 N、qS = 24500 N，所以 CLreq ≈ 0.40027。空速降低到 40 m/s 时 qS = 15680 N，CLreq 增至约 0.62542。推进方向的 T = D 需要另行检查，本页计算升力与俯仰力矩平衡。",
      },
      {
        formula:
          "C_{L\\delta}=\\eta a_t\\tau r,\\qquad C_{m\\delta}=-C_{L\\delta}(h_t-h_{cg})",
        law: "按升降舵效率计算尾翼力与俯仰力矩的舵角导数。",
        previous: "尾翼升力增量为 qSCLδΔδ，尾翼位于重心后方",
        reason:
          "τ 把舵角增量换成尾翼有效迎角增量；正 δ 是后缘向下。默认 CLδ = 0.324/rad、Cmδ = −0.8478/rad。这里“向上”描述的是力的增量，实际尾翼力仍可能朝下。",
      },
      {
        formula:
          "C_{m0}=C_{m,ac}+C_{L0}(h_{cg}-h_{ac}),\\qquad C_{m\\alpha}=-a\\,SM",
        law: "把参考状态的机翼力矩平移到重心，并取迎角导数。",
        previous: "参考 α = δ = 0 时，尾翼升力设为零",
        reason:
          "CL0 = 0.22 是该参考状态的机翼升力系数，也是本模型的总升力截距。默认 Cm0 = −0.04 + 0.22 × (0.30 − 0.25) = −0.029；负号表示低头的参考力矩。移动重心时，Cm0、Cmα 与 Cmδ 都需更新。",
      },
      {
        formula:
          "C_L=C_{L0}+a\\alpha+C_{L\\delta}\\delta,\\qquad C_m=C_{m0}+C_{m\\alpha}\\alpha+C_{m\\delta}\\delta",
        law: "使用同一套线性气动模型表示升力与俯仰力矩。",
        previous: "总升力斜率 a = aw + bt，力矩与舵角导数已求得",
        reason:
          "两式中的 α 与 δ 均以弧度代入；显示为角度时需乘 180/π。把角度数直接乘以每弧度的导数，会造成约 57.3 倍的错误。",
      },
      {
        formula:
          "\\begin{bmatrix}a&C_{L\\delta}\\\\C_{m\\alpha}&C_{m\\delta}\\end{bmatrix}\\begin{bmatrix}\\alpha\\\\\\delta\\end{bmatrix}=\\begin{bmatrix}C_{L,\\mathrm{req}}-C_{L0}\\\\-C_{m0}\\end{bmatrix}",
        law: "同时施加 CL = CLreq 与 Cm = 0 两个平衡条件。",
        previous: "升力与俯仰力矩的两个线性方程",
        reason:
          "当行列式 Δ = aCmδ − CLδCmα 非零时，有唯一数学解。默认 Δ = −4.4928/rad²，解为 α ≈ 0.036109 rad、δ ≈ −0.075290 rad。若 SM = 0，则 Cmα = 0，但只要 aCmδ ≠ 0，方程仍可求解；缺少尾翼或舵效可能使矩阵奇异。",
      },
      {
        formula: "R_L=qSC_L-W,\\qquad R_M=qS\\bar c\\,C_m",
        law: "把解代回原方程，检查力与力矩残差及模型边界。",
        previous: "已求得配平 α 与 δ",
        reason:
          "要求两项残差接近零，并同时检查 −8° ≤ α ≤ 15°、|δ| ≤ 当前舵角限值、|CL| ≤ CLmax。超出边界的数学解不能认定为本模型的可用配平。40 m/s 的默认解 α ≈ 4.503°、δ ≈ −7.083° 满足这些检查。",
      },
    ],
    assumptions: `${stabilityAssumptions} 本页要求定常水平飞行的升力与俯仰力矩平衡，重力通过重心。没有推进与阻力模型，也没有积分求解飞行轨迹或气动阻尼；舵角限值与 CLmax 可在实验中调整，检查时使用当前限值。`,
    variables:
      "m：质量 [kg]；g：重力加速度 [m/s²]；W：重量 [N]；ρ：空气密度 [kg/m³]；V：空速 [m/s]；q：动压 [Pa]；CLreq：平飞所需升力系数；CL0：参考升力截距；Cmac：机翼气动中心力矩系数；Cm0：重心处参考力矩系数；CLδ、Cmδ：升力与力矩对舵角的导数 [rad⁻¹]；a、Cmα：迎角导数 [rad⁻¹]；τ：升降舵效率；α、δ：迎角与舵角 [rad]；Δ：配平方程矩阵行列式 [rad⁻²]；RL：升力残差 [N]；RM：俯仰力矩残差 [N·m]。位置、面积与尾翼参数沿用上一课定义。",
    summary:
      "可用配平必须同时满足升力与力矩平衡，且迎角、升力系数与舵角落在模型范围内。速度降低使平飞所需 CL 增大，迎角和舵角要一起调整；静稳定与能否配平是两个独立判断。",
    references: [stabilityReference, handbookReference],
    task: {
      id: "stability-trim",
      prompt:
        "保持默认重心、尾翼与质量，先检查 50 m/s 的配平解及升力、力矩残差。把空速改为 40 m/s（相对默认至少改变 5 m/s），求得新的配平解，确认迎角、舵角与 |CL| 均在当前限值内，两项残差接近零，再记录这个有效配平结果。",
    },
    level: 3,
  },
];

export const stabilityQuestions: Question[] = [
  {
    id: "p3-margin-restoring",
    level: 3,
    lessonId: "static-stability",
    kind: "choice",
    title:
      "固定升降舵、a > 0 且静稳定裕度 SM > 0。正迎角小扰动产生什么俯仰力矩增量？抬头为正。",
    options: ["负力矩增量，具有低头恢复趋势", "正力矩增量，放大扰动", "总是零"],
    answer: 0,
    explanation:
      "Cmα = −aSM < 0，故 ΔM = qSc̄CmαΔα < 0。这是初始恢复趋势，不能据此断言扰动随时间一定衰减。",
  },
  {
    id: "p3-margin-neutral-point",
    level: 3,
    lessonId: "static-stability",
    kind: "numeric",
    title:
      "假想参数 hac = 0.25、bt = 0.468/rad、a = 5.668/rad、lt = 4 m、c̄ = 1.5 m。中性点 hnp 位于多少 % MAC？请输入百分数值，例如 25 表示 25% MAC。",
    answer: 47.01834862385321,
    tolerance: 0.02,
    unit: "% MAC",
    explanation:
      "hnp = hac + (bt/a)(lt/c̄) = 0.25 + (0.468/5.668)(4/1.5) ≈ 0.4701835，乘 100 得 47.0183% MAC。允许误差 ±0.02 个百分点。",
  },
  {
    id: "p3-margin-aft-cg",
    level: 3,
    lessonId: "static-stability",
    kind: "choice",
    title:
      "尾翼与气动参数固定，重心从 30% 后移至 35% MAC，而中性点为 47.02% MAC。哪一项成立？",
    options: [
      "中性点随重心后移 5 个百分点，裕度不变",
      "裕度减少 5 个百分点，仍有初始恢复趋势",
      "裕度增加 5 个百分点，动态运动一定更快衰减",
    ],
    answer: 1,
    explanation:
      "SM = hnp − hcg；hnp 固定时，重心后移 0.05 使 SM 减少 0.05。新裕度约为 0.1202，仍为正。静稳定裕度没有给出动态衰减率。",
  },
  {
    id: "p3-trim-elevator-sign",
    level: 3,
    lessonId: "trim",
    kind: "choice",
    title:
      "δ 正方向为升降舵后缘向下，尾翼气动中心在重心后方。增加 δ 的直接作用是什么？",
    options: [
      "增加尾翼向上的力，产生低头力矩增量",
      "增加尾翼向上的力，产生抬头力矩增量",
      "必定让机翼失速，与俯仰力矩无关",
    ],
    answer: 0,
    explanation:
      "CLδ = ηatτr > 0，而 Cmδ = −CLδ(ht − hcg) < 0。正 δ 增加尾翼向上的力并增加低头力矩；实际尾翼总力还取决于原状态。",
  },
  {
    id: "p3-trim-speed-demand",
    level: 3,
    lessonId: "trim",
    kind: "numeric",
    title:
      "假想飞机 m = 1000 kg、g = 9.80665 m/s²、ρ = 1.225 kg/m³、S = 16 m²，以 40 m/s 定常平飞。配平所需总升力系数 CLreq 是多少？",
    answer: 0.6254241071428571,
    tolerance: 0.0005,
    unit: "无量纲",
    explanation:
      "CLreq = mg/(½ρV²S) = 9806.65/(½ × 1.225 × 40² × 16) ≈ 0.625424。这个总升力系数包括尾翼贡献，且迎角与舵角还必须满足零俯仰力矩。允许误差 ±0.0005。",
  },
  {
    id: "p3-trim-neutral-solvable",
    level: 3,
    lessonId: "trim",
    kind: "choice",
    title:
      "在中性静稳定位置 Cmα = 0，若 a > 0 且 Cmδ ≠ 0，线性配平方程能否得到唯一数学解？",
    options: [
      "不能，任何零 Cmα 都使矩阵奇异",
      "能，行列式 aCmδ 非零，但还要检查模型边界",
      "能，而且一定在舵角限值内并动态稳定",
    ],
    answer: 1,
    explanation:
      "Δ = aCmδ − CLδCmα。Cmα = 0 时，Δ = aCmδ ≠ 0，故仍有唯一数学解。解是否可用取决于迎角、舵角与 CL 范围；中性静稳定也没有提供动态稳定结论。",
  },
];
