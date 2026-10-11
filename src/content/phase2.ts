export interface PerformanceLesson {
  id: string;
  title: string;
  experiment: "polar" | "level" | "climb" | "turn";
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
}

const liftReference = {
  name: "NASA Glenn · Lift Equation",
  url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/",
};
const dragReference = {
  name: "NASA Glenn · Drag Equation",
  url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/",
};
const flightReference = {
  name: "FAA · Pilot’s Handbook of Aeronautical Knowledge（飞行原理与性能）",
  url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak",
};
const polarAssumptions =
  "假想教学飞机，SI 单位；低速不可压缩、无风，密度与机翼面积固定。采用抛物线阻力极曲线 CD = CD0 + kCL²，默认 CD0 = 0.025、k = 0.055、CLmax = 1.4。仅适用于附着流近似，不描述失速后的气动力、雷诺数变化或高速压缩效应。";

export const performanceLessons: PerformanceLesson[] = [
  {
    id: "dynamic-pressure",
    title: "动压：速度如何放大气动力",
    experiment: "polar",
    objective:
      "区分动压、静压与气动力，能在明确哪些参数固定的前提下预测速度和密度的影响。",
    observation:
      "在实验中保持密度、机翼面积与 CL 不变，把速度从 40 m/s 改到 80 m/s。观察动压、升力和阻力都增至四倍，而升阻比保持不变；这里没有自动维持平飞。",
    question:
      "密度、机翼面积、CL 和 CD 固定，速度增加一倍，升力与升阻比分别怎样变化？",
    predictionOptions: [
      "升力变为两倍，升阻比变为两倍",
      "升力变为四倍，升阻比不变",
      "升力不变，升阻比变为四倍",
    ],
    predictionAnswer: 1,
    explanation:
      "动压 q 是来流的惯性尺度，等于 ½ρV²，并不是翼面每一点的实际压力。升力和阻力通过 qS 与各自的无量纲系数相联系。固定 CL 与 CD 时，它们都随 V² 变化，所以比值 L/D 与速度无关。若改为维持重量不变的定常平飞，飞机必须随速度调整 CL，便不能再使用“CL 固定”的四倍结论。",
    steps: [
      {
        formula: "q=\\frac{1}{2}\\rho V^2",
        law: "定义动压。",
        previous: "来流密度 ρ 与相对空气速度 V",
        reason:
          "单位为 kg/m³ × m²/s² = Pa；V 是空速，不能用有风时的地速直接替代。",
      },
      {
        formula: "L=qSC_L,\\qquad D=qSC_D",
        law: "用参考动压、面积及气动力系数表示气动力。",
        previous: "CL = L/(qS)，CD = D/(qS)",
        reason:
          "CL、CD 包含形状、迎角与流动状态的影响；固定系数是本次比较的实验条件。",
      },
      {
        formula: "\\frac{q_2}{q_1}=\\frac{\\rho_2}{\\rho_1}\\left(\\frac{V_2}{V_1}\\right)^2",
        law: "把两组动压定义相除。",
        previous: "q = ½ρV²",
        reason:
          "相同密度下速度翻倍给出四倍动压；相同空速下密度减半给出一半动压。",
      },
      {
        formula: "\\frac{L}{D}=\\frac{qSC_L}{qSC_D}=\\frac{C_L}{C_D}",
        law: "消去相同参考尺度 qS。",
        previous: "L = qSCL，D = qSCD",
        reason:
          "仅当两个系数保持不变时，改变动压不改变升阻比。这不等于说真实飞机在所有速度下升阻比相同。",
      },
    ],
    assumptions: polarAssumptions,
    variables:
      "ρ：密度 [kg/m³]；V：空速 [m/s]；q：动压 [Pa]；S：参考机翼面积 [m²]；L、D：气动力 [N]；CL、CD 与 L/D：无量纲。",
    summary:
      "先写出保持不变的量，再判断比例。动压随空速平方变化；实际平飞中的 CL 还要满足重量约束。",
    references: [liftReference, dragReference],
    task: {
      id: "perf-pressure",
      prompt:
        "保持默认密度 1.225 kg/m³，将速度从默认 50 m/s 调至 100 m/s，验证动压从 1531.25 Pa 变为 6125 Pa，再记录动压任务完成。CL 与机翼面积保持不变。",
    },
  },
  {
    id: "polar",
    title: "阻力极曲线与最佳升阻比",
    experiment: "polar",
    objective:
      "用抛物线极曲线区分零升阻力与诱导阻力，并推导最佳升阻比对应的 CL。",
    observation:
      "缓慢改变 CL。很小的 CL 虽然阻力系数小，升阻比也低；很大的 CL 会增加诱导阻力。观察 L/D 曲线在两者之间出现峰值。",
    question:
      "在 CD = CD0 + kCL² 模型中，最大升阻比出现在哪个条件？",
    predictionOptions: [
      "CL 越大越好，没有最优值",
      "零升阻力项 CD0 等于诱导阻力项 kCL²",
      "总阻力系数 CD 必须等于零",
    ],
    predictionAnswer: 1,
    explanation:
      "抛物线极曲线把与升力无关的阻力项和随 CL² 增长的诱导阻力项相加。CL 太小，升力不足以换来高升阻比；CL 太大，诱导阻力增长太快。在该模型的附着流范围内，求 L/D 的极值可得到两项相等。最大升阻比对应无风定常滑翔的最小下降角，也对应给定重量定常平飞的最小阻力；它并不自动等于最小下沉率、最大爬升率或最佳续航条件。",
    steps: [
      {
        formula: "C_D=C_{D0}+kC_L^2",
        law: "采用抛物线阻力极曲线近似。",
        previous: "总阻力由多个气动来源组成",
        reason:
          "CD0 为零升阻力系数，k 表示诱导阻力强度；常用近似 k = 1/(πeAR)。本实验把它们作为给定参数。",
      },
      {
        formula: "E=\\frac{L}{D}=\\frac{C_L}{C_{D0}+kC_L^2}",
        law: "在升阻比中代入阻力极曲线。",
        previous: "L/D = CL/CD",
        reason: "动压与机翼面积相消，但 CL 决定升力与阻力之间的权衡。",
      },
      {
        formula: "\\frac{dE}{dC_L}=\\frac{C_{D0}-kC_L^2}{(C_{D0}+kC_L^2)^2}=0",
        law: "对正升力范围内的升阻比求导。",
        previous: "E = CL/(CD0 + kCL²)",
        reason:
          "分母为正，极值条件来自分子为零。该条件还必须位于 CLmax 以下才可在本模型中实现。",
      },
      {
        formula: "C_L^*=\\sqrt{\\frac{C_{D0}}{k}},\\qquad E_{\\max}=\\frac{1}{2\\sqrt{C_{D0}k}}",
        law: "解极值条件并代回升阻比。",
        previous: "CD0 = k(CL*)²",
        reason:
          "默认参数给出 CL* ≈ 0.6742、Emax ≈ 13.484；此时两种阻力项各占总阻力的一半。",
      },
      {
        formula: "V^*=\\sqrt{\\frac{2W}{\\rho S C_L^*}}",
        law: "把最佳 CL 与定常平飞的升力平衡联立。",
        previous: "W = ½ρV²SCL",
        reason:
          "这是给定重量与密度下的最佳升阻比平飞空速。实际最优速度随重量、密度、风和任务目标改变。",
      },
    ],
    assumptions: polarAssumptions,
    variables:
      "CD0：零升阻力系数；k：诱导阻力因子；E = L/D：升阻比；CL*：最优升力系数；W = mg：重量 [N]；V*：相应平飞空速 [m/s]。",
    summary:
      "升阻比的峰值来自零升阻力与诱导阻力的平衡。比较“最优”之前，先说明优化的是下降角、阻力还是其他性能。",
    references: [dragReference, flightReference],
    task: {
      id: "perf-polar",
      prompt:
        "保持默认 CD0 与 k，调节 CL 至最大升阻比附近，并检查零升阻力项与诱导阻力项是否接近相等。",
    },
  },
  {
    id: "level-flight",
    title: "定常平飞：需要多少推力与功率",
    experiment: "level",
    objective:
      "从重量约束计算平飞所需 CL、阻力与功率，区分可用推力和所需推力，并识别失速边界。",
    observation:
      "固定重量，改变空速。低速时所需 CL 和诱导阻力高，高速时零升阻力高；推力需求因此出现低谷。让可用推力线与当前所需阻力相交，才能维持当前速度的定常平飞。",
    question:
      "重量、密度、机翼面积固定，定常平飞空速增加一倍，所需 CL 怎么变化？",
    predictionOptions: [
      "变为原来的四倍",
      "保持不变",
      "变为原来的四分之一",
    ],
    predictionAnswer: 2,
    explanation:
      "定常水平直线飞行要求竖直合力与前向合力都为零。速度改变时，CL 必须调整以维持 L = W；不能沿用固定迎角的升力变化。把所需 CL 代入极曲线，得到随速度变化的阻力需求。可用推力大于需求时，若继续保持高度，飞机存在加速趋势；小于需求时有减速趋势。本页是定常性能计算，没有积分模拟这段加速过程。",
    steps: [
      {
        formula: "L=W=mg,\\qquad T_{\\mathrm{req}}=D",
        law: "牛顿第二定律在定常水平直线飞行中的力平衡。",
        previous: "竖直与前向加速度均为零",
        reason: "假定推力沿速度方向，升力竖直向上，没有侧滑、转弯或爬升。",
      },
      {
        formula: "C_{L,\\mathrm{req}}=\\frac{W}{qS}=\\frac{2mg}{\\rho V^2 S}",
        law: "把升力定义重排为所需升力系数。",
        previous: "L = qSCL = W",
        reason: "重量固定时，所需 CL 与 V² 成反比；CL 超过 CLmax 即不可用。",
      },
      {
        formula: "D=qS C_{D0}+\\frac{kW^2}{qS}",
        law: "把 CLreq 代入极曲线与阻力公式。",
        previous: "D = qS(CD0 + kCL²)，CL = W/(qS)",
        reason:
          "第一项随 V² 增长，第二项随 V⁻² 减小。这种速度分解使用了平飞重量约束。",
      },
      {
        formula: "P_{\\mathrm{req}}=DV,\\qquad P_{\\mathrm{avail}}=TV",
        law: "沿速度方向的力乘速度等于推进或阻力功率。",
        previous: "Treq = D",
        reason:
          "单位 N·m/s = W；这里的 TV 是推进有效功率，并非发动机轴功率，未另行模拟推进效率。",
      },
      {
        formula: "V_s=\\sqrt{\\frac{2W}{\\rho S C_{L\\max}}}",
        law: "在平飞升力平衡中令 CL 达到上限。",
        previous: "CLreq ≤ CLmax",
        reason:
          "这是给定重量、密度和构型的一倍载荷理论失速空速；不是实际操作速度建议。",
      },
    ],
    assumptions:
      `${polarAssumptions} 定常水平直线飞行，自动计算所需 CL；可用推力作为当前空速下的给定输入，不代表真实发动机的完整推力曲线。`,
    variables:
      "m：质量 [kg]；g = 9.80665 m/s²；W：重量 [N]；Treq 与 T：所需及可用推力 [N]；Preq 与 Pavail：有效功率 [W]；Vs：理论失速空速 [m/s]。",
    summary:
      "可行平飞同时需要 CL 不超过上限，且可用推力等于当前阻力。推力与功率的最小值一般对应不同速度。",
    references: [liftReference, flightReference],
    task: {
      id: "perf-level",
      prompt:
        "选一个未达到失速边界的空速，调整可用推力，使其与所需阻力相差小于 50 N，观察平飞判定。",
    },
  },
  {
    id: "climb-glide",
    title: "爬升与滑翔：能量如何交换",
    experiment: "climb",
    objective:
      "沿航迹分解重力，使用余功率计算爬升率，并解释无动力滑翔的角度和航程。",
    observation:
      "固定空速，增加推力，观察正爬升角与爬升率；再把推力降为零，观察飞机沿负航迹角下降。滑翔时仍有升力，维持阻力功来自重力沿航迹的分量。",
    question:
      "无风、无推力的定常直线滑翔中，升力与重量的关系是什么？γ 是向上为正的航迹角。",
    predictionOptions: [
      "L = W，和水平飞行完全相同",
      "L = W cos γ，略小于 W",
      "L = 0，因为发动机没有推力",
    ],
    predictionAnswer: 1,
    explanation:
      "航迹角 γ 描述速度方向相对水平面的角度，不是机头俯仰角。推力沿速度方向，升力垂直速度方向；把重力分别投影到这两个方向，得到精确的定常关系。爬升时余推进功率转化为重力势能；滑翔时势能损失抵消阻力做功。实验联立极曲线与力平衡求小航迹角的解，γ 的适用范围为 ±20°。只有角度较小时，才可用 L ≈ W 简化。",
    steps: [
      {
        formula: "L=W\\cos\\gamma,\\qquad T-D=W\\sin\\gamma",
        law: "沿航迹及垂直航迹方向应用定常力平衡。",
        previous: "合力为零，γ 向上为正",
        reason:
          "爬升或下降时升力不再等于全部重量；两式同时适用于本模型中的定常爬升与滑翔。",
      },
      {
        formula: "C_L=\\frac{W\\cos\\gamma}{qS},\\qquad D=qS C_{D0}+\\frac{kW^2\\cos^2\\gamma}{qS}",
        law: "把垂直航迹平衡代入极曲线。",
        previous: "L = qSCL = W cos γ",
        reason:
          "阻力也取决于未知的航迹角，实验联立求解，不能把平飞阻力冒充为所有角度下的精确阻力。",
      },
      {
        formula: "\\dot h=V\\sin\\gamma=\\frac{(T-D)V}{W}=\\frac{P_{\\mathrm{avail}}-P_{\\mathrm{req}}}{W}",
        law: "把沿航迹平衡乘以 V，并用速度的竖直分量表示爬升率。",
        previous: "T − D = W sin γ",
        reason:
          "余功率为正意味着定常爬升，为负意味着下降；此处 D 是当前航迹解的阻力。",
      },
      {
        formula: "T=0\\quad\\Rightarrow\\quad \\tan|\\gamma|=\\frac{D}{L}=\\frac{1}{E}",
        law: "在无推力下降时，把两方向的力平衡相除。",
        previous: "D = W sin |γ|，L = W cos γ",
        reason:
          "E 越大，下降角越浅；最大升阻比意味着最小无风滑翔角，并非最小下沉率。",
      },
      {
        formula: "\\frac{x}{H}=\\frac{1}{\\tan|\\gamma|}=E",
        law: "用直线滑翔的几何关系计算水平距离与高度损失之比。",
        previous: "tan |γ| = H/x = 1/E",
        reason:
          "只适用于无风、参数不变的定常航迹；地面风、转弯、构型变化和进近余量都会改变实际可达距离。",
      },
    ],
    assumptions:
      `${polarAssumptions} 定常直线航迹、空速固定、推力沿航迹、无侧滑；取 |γ| ≤ 20° 的连续小角度解。无有效解或所需 CL 超限时显示不可行，不推断失速后的运动。`,
    variables:
      "γ：航迹角 [°，计算时转为 rad]，向上为正；ḣ：爬升率 [m/s]，负值表示下降；H：高度损失 [m]；x：无风水平滑翔距离 [m]；E：升阻比。",
    summary:
      "爬升率由余功率决定，滑翔角由升阻比决定。升力存在与飞机上升是两个不同问题。",
    references: [flightReference, liftReference],
    task: {
      id: "perf-climb",
      prompt:
        "在可行且航迹角小于 20° 的范围内调节推力，让爬升率超过 2 m/s；随后试试零推力滑翔，并比较两种航迹的升力与重量。",
    },
  },
  {
    id: "turn",
    title: "协调转弯：倾侧、半径与载荷因数",
    experiment: "turn",
    objective:
      "解释倾侧如何产生向心力，计算水平协调转弯的载荷因数、半径、转弯率与失速速度变化。",
    observation:
      "固定空速，把倾侧角从 0° 增至 60°。升力的水平分量增大，转弯更快、半径更小；为保持高度，总升力必须提高到重量的两倍。观察失速速度也随载荷因数上升。",
    question:
      "保持高度的 60° 倾侧协调转弯，所需载荷因数 n = L/W 是多少？",
    predictionOptions: ["1", "2", "0.5"],
    predictionAnswer: 1,
    explanation:
      "水平协调转弯中的升力倾斜。升力的竖直分量平衡重量，水平分量提供向心力。倾侧本身不能保证保持高度；飞机还必须增加 CL 或空速以提供足够总升力。实验自动计算保持高度所需的 CL，若超过 CLmax 就标记不可行。这里讨论稳态点质点性能，未包含滚转过渡、舵面操纵、侧滑或结构强度限制。",
    steps: [
      {
        formula: "L\\cos\\phi=W,\\qquad L\\sin|\\phi|=\\frac{mV^2}{R}",
        law: "分别应用竖直力平衡与水平方向的向心力关系。",
        previous: "高度与空速不变的圆周运动",
        reason:
          "φ 是倾侧角；半径公式用 |φ| 的大小。左右转的方向由转弯率的符号表示。",
      },
      {
        formula: "n=\\frac{L}{W}=\\frac{1}{\\cos\\phi}",
        law: "由竖直方向的平衡求总升力与重量之比。",
        previous: "L cos φ = W",
        reason:
          "60° 时 cos φ = 0.5，所以 n = 2。载荷因数是无量纲比值；本模型不提供飞机结构过载许可。",
      },
      {
        formula: "R=\\frac{V^2}{g\\tan|\\phi|},\\qquad \\omega=\\frac{g\\tan\\phi}{V}",
        law: "把两方向的方程相除，并用 |ω| = V/R。",
        previous: "tan |φ| = V²/(gR)",
        reason:
          "R 单位为 m，ω 单位为 rad/s。φ = 0 时转弯率为零、半径趋于无穷，不应显示有限小半径。",
      },
      {
        formula: "C_{L,\\mathrm{turn}}=\\frac{nW}{qS}",
        law: "把总升力需求代入升力定义。",
        previous: "L = nW = qSCL",
        reason:
          "同一空速下增加倾侧，需要更大的 CL，同时也增加诱导阻力和维持空速所需推力。",
      },
      {
        formula: "V_{s,n}=\\sqrt{\\frac{2nW}{\\rho S C_{L\\max}}}=V_{s,1}\\sqrt n",
        law: "在转弯所需升力关系中令 CL 达到上限。",
        previous: "nW = ½ρVs,n²SCLmax",
        reason:
          "两倍载荷时理论失速空速增至 √2 倍，而非两倍；假设重量、密度和构型不变。",
      },
    ],
    assumptions:
      `${polarAssumptions} 保持高度和空速的协调圆周转弯、无侧滑，倾侧角限于 ±60°；只检查气动可行性，未建模结构载荷限制、推力余量与操纵过程。`,
    variables:
      "φ：倾侧角 [°]；n = L/W：载荷因数；R：转弯半径 [m]；ω：转弯率 [rad/s，界面也显示 °/s]；Vs,n：相应载荷下理论失速空速 [m/s]。",
    summary:
      "更大的倾侧带来更紧的转弯，也增加升力需求、诱导阻力与失速速度。必须同时检查空速与 CL 上限。",
    references: [flightReference, liftReference],
    task: {
      id: "perf-turn",
      prompt:
        "选择可保持高度的空速，把倾侧调到约 60°，达到约 2 的载荷因数；比较转弯半径与失速空速的变化。",
    },
  },
];
