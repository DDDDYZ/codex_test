export const levels = [
  {
    name: "飞行原理与物理直觉",
    tag: "从观察开始",
    topics: [
      "飞机为什么能飞",
      "迎角、翼型与失速",
      "俯仰、滚转与偏航",
      "操纵面的作用",
    ],
    available: true,
  },
  {
    name: "空气动力学与飞行性能",
    tag: "理解性能边界",
    topics: [
      "动压与气动力",
      "阻力极曲线与升阻比",
      "平飞、爬升与滑翔",
      "转弯与载荷因数",
    ],
    available: false,
  },
  {
    name: "静稳定性与配平",
    tag: "寻找平衡",
    topics: [
      "重心、气动中心与中性点",
      "静稳定裕度",
      "俯仰力矩与尾翼",
      "纵向配平",
    ],
    available: false,
  },
  {
    name: "飞机运动方程",
    tag: "建立运动模型",
    topics: [
      "坐标系与变换",
      "欧拉角与四元数",
      "牛顿—欧拉与六自由度",
      "小扰动与线性化",
    ],
    available: false,
  },
  {
    name: "飞机动稳定性",
    tag: "读懂动态响应",
    topics: [
      "稳定性导数与状态空间",
      "短周期与长周期",
      "横航向模态",
      "特征值、阻尼与频率",
    ],
    available: false,
  },
  {
    name: "飞行控制与综合仿真",
    tag: "让飞机听从指令",
    topics: [
      "PID 与状态反馈",
      "姿态、高度与速度保持",
      "风扰动与阵风",
      "综合飞行仿真",
    ],
    available: false,
  },
];
export const lesson = {
  title: "飞机为什么能飞",
  question: "保持空气密度、机翼面积和迎角不变，速度增加一倍，升力会怎样变化？",
  explanation:
    "机翼使周围气流的速度与方向发生变化。压力分布在机翼表面的积分产生气动力，其垂直于相对来流的分量称为升力。不能用“两侧空气必须同时到达后缘”来解释升力。平飞时，升力抵消重力、推力抵消阻力；有升力并不意味着飞机必然上升。",
  steps: [
    {
      formula: "q=\\frac{1}{2}\\rho V^2",
      law: "以动压定义衡量来流的惯性尺度。",
      previous: "来流密度 ρ 与速度 V",
      reason:
        "单位为 kg/m³ × m²/s² = Pa；这是参考压力，不是翼面处处的实际压差。",
    },
    {
      formula: "C_L=\\frac{L}{qS}",
      law: "定义无量纲升力系数。",
      previous: "q = ½ρV²",
      reason: "用动压与参考机翼面积归一化升力，翼型、迎角等影响包含在 CL 内。",
    },
    {
      formula: "L=qSC_L=\\frac{1}{2}\\rho V^2 SC_L",
      law: "重排升力系数的定义，并代入动压。",
      previous: "CL = L / (qS)",
      reason:
        "只有在 ρ、S、CL 固定时，速度翻倍才得到四倍升力。实际自由飞行中迎角可能改变。",
    },
    {
      formula: "L=W=mg,\\qquad T=D",
      law: "牛顿第二定律：合力为零时加速度为零。",
      previous: "ΣF = ma",
      reason:
        "假设定常、水平、无侧滑飞行，推力沿来流，升力垂直来流。不涉及转弯或爬升。",
    },
  ],
  references: [
    {
      name: "NASA Glenn · Lift Equation",
      url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/",
    },
    {
      name: "NASA Glenn · Four Forces on an Airplane",
      url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/four-forces-on-an-airplane/",
    },
    {
      name: "MIT OCW 16.333 · Aircraft Stability and Control",
      url: "https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/",
    },
  ],
};
export const quizzes = [
  {
    id: "balance",
    type: "概念",
    prompt: "飞机做定常水平直线飞行时，哪一组关系成立？",
    options: ["L = W 且 T = D", "L > W 且 T > D", "只有 L = W 即可"],
    answer: 0,
    explain: "两个方向的合力都为零，才满足定常水平直线飞行。",
  },
  {
    id: "speed",
    type: "预测",
    prompt:
      "CL、ρ、S 固定，速度从 40 m/s 增加到 80 m/s，升力变为原来的多少倍？",
    options: ["2 倍", "4 倍", "8 倍"],
    answer: 1,
    explain: "升力正比于 V²，所以 (80/40)² = 4。",
  },
  {
    id: "stall",
    type: "概念",
    prompt: "在本实验的失速区，继续增大迎角会怎样？",
    options: ["升力系数永远线性增加", "升力系数开始下降", "空气密度变为零"],
    answer: 1,
    explain:
      "分离流动使升力降低。失速区曲线只是教学示意，不能用于真实飞机预测。",
  },
];
