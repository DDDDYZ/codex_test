import type { Question } from "./questions";

export interface DynamicsLesson {
  id: string;
  title: string;
  experiment: string;
  level: 4 | 5;
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

const stabilityReference = {
  name: "MIT OCW 16.333 · Aircraft Stability and Control（运动方程与动态模态）",
  url: "https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/",
};
const rotationReference = {
  name: "NASA Glenn · Aircraft Rotations",
  url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/aircraft-rotations/",
};
const flightReference = {
  name: "FAA · Pilot’s Handbook of Aeronautical Knowledge（稳定性与飞行操纵）",
  url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak",
};
const modalAssumptions =
  "假想教学模型，SI 单位，小扰动、固定参数、无外部输入。实验直接给定独立模态的频率、阻尼或增长率，再积分 ẋ = Ax；这些参数并非从某架飞机的气动导数、质量或惯量辨识所得。η 是以 rad 表示的教学模态幅值，不直接等于真实飞机的迎角、俯仰角、侧滑角或偏航角；二阶状态为 [η, η̇]，不等于 [α, q] 或 [β, r]。各模态彼此独立，不模拟真实飞机的耦合六自由度运动、失速或飞行包线。";

export const dynamicsLessons: DynamicsLesson[] = [
  {
    id: "coordinates-linearization",
    title: "坐标变换与小扰动：从机体轴到状态方程",
    experiment: "coordinates",
    level: 4,
    objective:
      "能按机体与 NED 轴的约定解释姿态旋转，区分向量分量变化和真实运动；在假想非线性俯仰振子的配平点计算数值 Jacobian，并用同一扰动比较非线性响应与一阶近似。",
    observation:
      "先改变姿态，观察三个单位基向量的 NED 分量变化，长度与正交关系保持不变；只改变滚转时，前轴方向不变。再在同页的线性化实验选择配平角 θ0，检查配平残差接近零以及数值 A、B 与解析 Jacobian 一致。用默认 3° 初始扰动积分 10 s，比较非线性与线性角度扰动曲线；把扰动增至 35°，观察近似误差如何变化。坐标显示与振子计算使用各自的输入，不会由显示姿态自动生成气动力或航迹。",
    question:
      "滚转与偏航均为 0°，俯仰设为 +30°。机体前轴单位向量在 NED 中的“地向下”分量是什么？",
    predictionOptions: [
      "+0.5，机头指向地面",
      "−0.5，机头抬起",
      "0，俯仰只改变右轴",
    ],
    predictionAnswer: 1,
    explanation:
      "机体轴为 x 向前、y 向右、z 向下；世界轴为北、东、地向下。正俯仰把前轴抬起，因此其地向下分量为负。内禀偏航—俯仰—滚转对应的 R 把机体分量变成 NED 分量，三列分别是三个机体单位轴的 NED 坐标；四元数也能表示同一姿态。位置与速度仍需力学和运动学方程，不能仅从姿态判断迎角、航迹角或加速度。线性化实验实际积分一个带 sinθ 恢复项的假想二状态振子：先找到静止配平点，再用中央差分得到 A、B，并与解析导数比较。保持配平输入，给非线性状态 θ0 + δθ0 和线性扰动 δθ0 相同的初始偏差，比较的是 θNL − θ0 与 δθLIN，而非两个绝对角度。小扰动时一阶近似通常较好，较大扰动会暴露被忽略的非线性项；误差同时包含积分与数值微分误差。这个实际对照展示局部线性化，不代表完整飞机的六自由度响应。",
    steps: [
      {
        formula:
          "\\mathbf v_N=R\\mathbf v_B,\\qquad R=R_z(\\psi)R_y(\\theta)R_x(\\phi),\\qquad R^{-1}=R^{\\mathsf T}",
        law: "用正交旋转矩阵把同一向量从机体分量转换为 NED 分量。",
        previous: "机体 x 前、y 右、z 下；NED 北、东、地向下",
        reason:
          "φ、θ、ψ 分别是滚转、俯仰、偏航。输入用度，计算前乘 π/180 变成 rad；R 保持长度与内积。反向转换应使用 R 的转置。",
      },
      {
        formula:
          "R=\\begin{bmatrix}c_\\theta c_\\psi&s_\\phi s_\\theta c_\\psi-c_\\phi s_\\psi&c_\\phi s_\\theta c_\\psi+s_\\phi s_\\psi\\\\c_\\theta s_\\psi&s_\\phi s_\\theta s_\\psi+c_\\phi c_\\psi&c_\\phi s_\\theta s_\\psi-s_\\phi c_\\psi\\\\-s_\\theta&s_\\phi c_\\theta&c_\\phi c_\\theta\\end{bmatrix}",
        law: "按既定顺序相乘三个基本旋转矩阵。",
        previous: "R = Rz(ψ)Ry(θ)Rx(φ)，c 表示 cos，s 表示 sin",
        reason:
          "第一列 R[1,0,0]ᵀ = [cosθ cosψ, cosθ sinψ, −sinθ]ᵀ 对应前轴。旋转乘法通常不可交换，改变顺序会改变姿态。",
      },
      {
        formula:
          "m(\\dot{\\mathbf v}_B+\\boldsymbol\\omega_B\\times\\mathbf v_B)=\\mathbf F_B+mR^{\\mathsf T}\\mathbf g_N,\\qquad I_B\\dot{\\boldsymbol\\omega}_B+\\boldsymbol\\omega_B\\times(I_B\\boldsymbol\\omega_B)=\\mathbf M_B",
        law: "在随刚体转动的机体坐标中应用牛顿第二定律和角动量定理。",
        previous: "惯性系的平动与转动平衡，以及旋转坐标的导数变换",
        reason:
          "F_B 为除重力外的合力，避免重复计入重力；g_N = [0,0,g]ᵀ。ω×v 是坐标旋转带来的项；ω×(Iω) 是转动耦合项。假定质量与机体惯量恒定，力矩关于质心计算。",
      },
      {
        formula:
          "\\dot{\\mathbf r}_N=R\\mathbf v_B,\\qquad\\begin{bmatrix}\\dot\\phi\\\\\\dot\\theta\\\\\\dot\\psi\\end{bmatrix}=\\begin{bmatrix}1&s_\\phi\\tan\\theta&c_\\phi\\tan\\theta\\\\0&c_\\phi&-s_\\phi\\\\0&s_\\phi/\\cos\\theta&c_\\phi/\\cos\\theta\\end{bmatrix}\\begin{bmatrix}p\\\\q\\\\r\\end{bmatrix}",
        law: "用位置和姿态运动学补全刚体状态方程。",
        previous: "机体速度 v_B 与角速度 ω_B = [p,q,r]ᵀ",
        reason:
          "机体角速度不一般等于欧拉角导数。θ = ±90° 时，这个欧拉角速率映射奇异；四元数可避免这种姿态表示奇异，旋转矩阵本身仍有意义。坐标显示不积分这套完整运动学；下方振子的 q 专门定义为其单一角度 θ 的导数。",
      },
      {
        formula:
          "\\dot{\\delta\\mathbf x}=f(\\mathbf x_0+\\delta\\mathbf x,\\mathbf u_0+\\delta\\mathbf u)-f(\\mathbf x_0,\\mathbf u_0)\\approx A\\delta\\mathbf x+B\\delta\\mathbf u,\\qquad A=\\left.\\frac{\\partial f}{\\partial\\mathbf x}\\right|_0,\\quad B=\\left.\\frac{\\partial f}{\\partial\\mathbf u}\\right|_0",
        law: "围绕名义解作一阶 Taylor 展开，减去名义状态的运动。",
        previous: "非线性状态方程 ẋ = f(x,u)，扰动 δx = x − x0",
        reason:
          "A 与 B 是工作点处的 Jacobian。名义平飞位置仍随时间变化，不能要求完整状态的 f(x0,u0) 全部为零；使用满足名义运动的 x0(t) 后，相减才得到扰动方程。只在小扰动和固定工作点近似下，把矩阵冻结为常量。",
      },
      {
        formula:
          "\\mathbf x=\\begin{bmatrix}\\theta\\\\q\\end{bmatrix},\\quad f(\\mathbf x,u)=\\begin{bmatrix}q\\\\-2\\zeta\\omega q-\\omega^2\\sin\\theta+Ku\\end{bmatrix},\\qquad\\mathbf x_0=\\begin{bmatrix}\\theta_0\\\\0\\end{bmatrix},\\quad u_0=\\frac{\\omega^2\\sin\\theta_0}{K},\\quad f(\\mathbf x_0,u_0)=\\mathbf0",
        law: "为实际交互定义一个非线性俯仰振子，并由零角加速度求静止配平输入。",
        previous: "一般状态方程 ẋ = f(x,u) 与工作点的概念",
        reason:
          "取 ω = 1.5 rad/s、ζ = 0.4、K = 4 s⁻²；θ 用 rad，q 用 rad/s，u 是正向增加俯仰角加速度的虚拟输入 [rad]，不代表机械升降舵角。θ0 在 ±45° 内，q0 = 0。本例的名义解为静止平衡，所以全部配平残差为零；它的恢复项和输入系数是人为设定，未来自飞机气动导数。",
      },
      {
        formula:
          "A_{ij}^{\\mathrm{num}}=\\frac{f_i(\\mathbf x_0+\\varepsilon\\mathbf e_j,u_0)-f_i(\\mathbf x_0-\\varepsilon\\mathbf e_j,u_0)}{2\\varepsilon},\\quad B_i^{\\mathrm{num}}=\\frac{f_i(\\mathbf x_0,u_0+\\varepsilon)-f_i(\\mathbf x_0,u_0-\\varepsilon)}{2\\varepsilon},\\qquad A=\\begin{bmatrix}0&1\\\\-\\omega^2\\cos\\theta_0&-2\\zeta\\omega\\end{bmatrix},\\quad B=\\begin{bmatrix}0\\\\K\\end{bmatrix}",
        law: "用中央差分逐列计算 Jacobian，再与解析导数核对。",
        previous: "配平点 (x0,u0)、坐标方向 ej，以及 A = ∂f/∂x、B = ∂f/∂u",
        reason:
          "每个分量在其 SI 单位下采用 ε = 10⁻⁵ 的数值步长。保持输入 u0，即 δu = 0，非线性系统从 [θ0 + δθ0,0]ᵀ 开始，线性系统 δẋ = Aδx 从 [δθ0,0]ᵀ 开始。两者用 RK4、步长 0.01 s 积分 10 s；对照误差为 (θNL − θ0) − δθLIN。默认 δθ0 = 3°，可选 1° 至 35°，积分前均转换为 rad。",
      },
    ],
    assumptions:
      "坐标显示复用精确的 bodyToNed 旋转，输入为 degree，展示单位基向量的 NED 分量与等价姿态表示；几何旋转没有小角近似。牛顿—欧拉推导假设刚体、固定质量与惯量、局部平坦不转动的 NED，忽略地球曲率和自转；欧拉角速率映射在俯仰 ±90° 处奇异。实际线性化对照仅使用独立的假想非线性俯仰振子，参数固定为 ω = 1.5 rad/s、ζ = 0.4、K = 4 s⁻²，配平角范围 ±45°、输入固定在 u0。数值 Jacobian 使用中央差分 ε = 10⁻⁵，响应使用 RK4 步长 0.01 s、时长 10 s；初始角度扰动默认 3°，范围 1°–35°。SI 计算中的角度转换为 rad。该对照未使用真实飞机导数，不积分完整六自由度运动；线性近似只在工作点附近适用，不能用来预测大迎角或失速。",
    variables:
      "φ、θ、ψ：滚转、俯仰、偏航 [rad；界面 degree]；R：无量纲；r_N：位置 [m]；v_B：速度 [m/s]；p、q、r：机体角速度 [rad/s]；m：[kg]；I_B：[kg·m²]；F_B：[N]；M_B：[N·m]；g_N：[m/s²]。振子另定义 θ、δθ：[rad]；q = θ̇：[rad/s]；u：[rad]，虚拟正抬头输入；ω：[rad/s]；ζ：无量纲；K：[s⁻²]。A 各元素的单位由所连接的状态决定，不全都相同。",
    summary:
      "先约定坐标方向与旋转顺序，再写力学和运动学。用配平残差检查工作点，用数值与解析 Jacobian 相互核对，再把非线性绝对角度减去配平角后与线性扰动比较。扰动增大时的偏差说明一阶近似的局限；这个假想振子的结果不等于飞机运动预测。下一节用独立模态模型学习特征值如何决定响应。",
    references: [rotationReference, stabilityReference],
    task: {
      id: "dynamics-coordinate",
      prompt:
        "把俯仰设为至少 +20°、偏航设为至少 +30°，应用姿态并检查三个单位轴的 NED 分量。观察前轴的地向下分量为负，以及基向量仍等长、正交，然后记录任务完成。",
    },
  },
  {
    id: "longitudinal-modes",
    title: "短周期与长周期：特征值怎样决定响应",
    experiment: "longitudinal",
    level: 5,
    objective:
      "从二阶模态方程求特征值，区分自然频率、阻尼振荡频率与衰减率，并理解纵向短周期和长周期的典型时间尺度。",
    observation:
      "默认短周期 ωn = 3 rad/s、ζ = 0.55，长周期 ωn = 0.25 rad/s、ζ = 0.08。给两种独立模态一个初始扰动并积分：短周期很快振荡并衰减，长周期变化缓慢，观察它需要更长的时间窗。固定短周期 ωn，提高正阻尼比，比较响应和特征值；若把 ζ 调为负值，振荡包络会增长。",
    question:
      "同为欠阻尼，固定短周期 ωn = 3 rad/s，把 ζ 从 0.55 增到 0.70，特征值实部与振荡包络如何变化？",
    predictionOptions: [
      "实部更负，包络衰减更快",
      "实部更正，包络增长更快",
      "实部不变，阻尼只影响初始幅值",
    ],
    predictionAnswer: 0,
    explanation:
      "真实飞机的短周期主要涉及迎角与俯仰角速度，通常比长周期更快；长周期主要涉及空速与高度的能量交换，往往阻尼较弱。本实验借用这些模态名称和时间尺度，但直接模拟两个互不耦合的教学幅值 [η,η̇]，没有求解实际的 [α,q] 或空速—高度状态。对于欠阻尼模型，λ 的实部 σ = −ζωn 决定包络 e^(σt)，虚部的绝对值是阻尼振荡频率 ωd；ωn 是方程参数，不能当作所有阻尼下都存在的振荡频率。ζ 为零时等幅振荡，为负时增长；临界阻尼和过阻尼时须读取实根，不能继续使用欠阻尼周期公式。",
    steps: [
      {
        formula:
          "\\ddot\\eta+2\\zeta\\omega_n\\dot\\eta+\\omega_n^2\\eta=0,\\qquad\\mathbf x=\\begin{bmatrix}\\eta\\\\\\dot\\eta\\end{bmatrix},\\qquad\\dot{\\mathbf x}=\\begin{bmatrix}0&1\\\\-\\omega_n^2&-2\\zeta\\omega_n\\end{bmatrix}\\mathbf x",
        law: "把给定的二阶模态方程改写为一阶状态空间。",
        previous: "ωn > 0，ζ 是允许为负的无量纲阻尼比",
        reason:
          "第一行是 η 的导数定义，第二行来自二阶方程。短周期与长周期各有一个这样的 2×2 块，组合矩阵为两个块的对角拼接，交叉耦合项为零。",
      },
      {
        formula:
          "\\det(\\lambda I-A)=\\lambda^2+2\\zeta\\omega_n\\lambda+\\omega_n^2=0,\\qquad\\lambda_{1,2}=-\\zeta\\omega_n\\pm\\omega_n\\sqrt{\\zeta^2-1}",
        law: "由特征多项式解析求二阶模态的两个根。",
        previous: "无输入线性系统 ẋ = Ax",
        reason:
          "λ 的单位为 s⁻¹。ζ² < 1 时平方根产生共轭虚部；ζ² > 1 时是两个实根。判断稳定性看全部根的实部，不只看是否振荡。",
      },
      {
        formula:
          "|\\zeta|<1:\\quad\\lambda=\\sigma\\pm i\\omega_d,\\quad\\sigma=-\\zeta\\omega_n,\\quad\\omega_d=\\omega_n\\sqrt{1-\\zeta^2},\\quad\\eta(t)=e^{\\sigma t}(C_1\\cos\\omega_dt+C_2\\sin\\omega_dt)",
        law: "由共轭特征根写出欠阻尼的实响应。",
        previous: "λ1,2 的实部与虚部",
        reason:
          "0 < ζ < 1 时包络衰减，ζ = 0 时等幅，−1 < ζ < 0 时包络增长。C1、C2 由初始 η 和 η̇ 决定；幅值大或曲线穿过零不能单独说明稳定性。",
      },
      {
        formula:
          "0<\\zeta<1:\\quad\\tau=\\frac{1}{\\zeta\\omega_n},\\qquad T_d=\\frac{2\\pi}{\\omega_d}",
        law: "用衰减至 e⁻¹ 的包络时间和一次振荡周期描述时间尺度。",
        previous: "包络 e^(−ζωnt)，振荡频率 ωd",
        reason:
          "默认短周期 σ = −1.65 s⁻¹、ωd ≈ 2.5055 rad/s、τ ≈ 0.606 s；长周期 σ = −0.020 s⁻¹、ωd ≈ 0.2492 rad/s、τ = 50 s。短周期数秒的时间窗看不完整长周期。",
      },
      {
        formula:
          "|\\zeta|=1:\\quad\\eta=(C_1+C_2t)e^{-\\zeta\\omega_nt};\\qquad|\\zeta|>1:\\quad\\eta=C_1e^{\\lambda_1t}+C_2e^{\\lambda_2t}",
        law: "对重复实根和不同实根分别写解析解。",
        previous: "ζ² − 1 为零或正数",
        reason:
          "ζ = +1 为临界阻尼；ζ > 1 为过阻尼，均无持续正弦振荡。ζ = −1 的重复根及 ζ < −1 的两个实根为正，响应会增长。ζ 很大时，一个负实根靠近零，增加阻尼不保证每一种意义下都更快回到平衡。",
      },
    ],
    assumptions: `${modalAssumptions} 默认短周期 ωn = 3 rad/s、ζ = 0.55；默认长周期 ωn = 0.25 rad/s、ζ = 0.08。ωn 必须大于零；线性模型的增长只用于辨认不稳定趋势，幅值变大后不能继续解释为真实飞机的小扰动运动。`,
    variables:
      "η：独立模态幅值 [rad]；η̇：[rad/s]；ωn、ωd：[rad/s]；ζ：无量纲；λ、σ：[s⁻¹]；τ、Td、t：[s]。二阶 A 的 A12 无量纲、A21 单位 s⁻²、A22 单位 s⁻¹，因状态分量单位不同，不能给整个矩阵统一标成 s⁻¹。",
    summary:
      "频率描述变化快慢，特征值实部描述增长或衰减。先检查模型状态是什么，再解释曲线；短周期和长周期的名称不等于完整飞机状态已经被模拟。下一节把同样的特征值判断用于横航向的振荡和非振荡模态。",
    references: [stabilityReference, flightReference],
    task: {
      id: "dynamics-damping",
      prompt:
        "把短周期阻尼比从默认 0.55 改为 0.70（也可选择 0.70 ≤ ζ < 1），保持 ωn = 3 rad/s，应用参数并积分至少 2 s。检查欠阻尼特征值实部更负与响应衰减，再记录任务完成。",
    },
  },
  {
    id: "lateral-modes",
    title: "横航向模态：荷兰滚、滚转衰减与螺旋",
    experiment: "lateral",
    level: 5,
    objective:
      "区分横航向振荡与实根模态，能从增长率符号预测滚转衰减和螺旋趋势，并辨认不同模态的时间尺度。",
    observation:
      "默认荷兰滚 ωn = 1.3 rad/s、ζ = 0.18，滚转衰减率 kr = 1.2 s⁻¹，螺旋增长率 ks = +0.025 s⁻¹。给每个独立模态一个非零初值并积分：荷兰滚振荡衰减，滚转角速度很快减小，螺旋幅值缓慢增长。把 ks 改为负值，观察螺旋幅值转为缓慢衰减；ks = 0 时保持初值。",
    question:
      "独立螺旋模态满足 η̇s = ksηs，ks = +0.025 s⁻¹，初始幅值非零。它属于哪一种响应？",
    predictionOptions: [
      "缓慢衰减的振荡",
      "缓慢指数增长，不出现正弦振荡",
      "很快衰减到零",
    ],
    predictionAnswer: 1,
    explanation:
      "真实横航向运动中，侧滑、滚转和偏航通过气动导数及惯量耦合。荷兰滚通常表现为侧滑与偏航的振荡并伴随滚转；滚转模态和螺旋模态通常对应实特征根。本实验以一个二阶振子和两个独立标量方程说明这些响应形式，没有构造真实飞机的 [β,p,r,φ] 耦合状态矩阵。滚转标量 p 以 rad/s 表示，螺旋标量 ηs 以 rad 表示，两者在这里互不耦合，不能额外假定 η̇s = p。单个正实根已足以使组合系统不稳定，即使其余模态都衰减；螺旋变化慢，短时间看起来近乎平直也不能判为稳定。",
    steps: [
      {
        formula:
          "\\mathbf x=\\begin{bmatrix}\\eta_d&\\dot\\eta_d&p&\\eta_s\\end{bmatrix}^{\\mathsf T},\\qquad\\dot{\\mathbf x}=\\begin{bmatrix}0&1&0&0\\\\-\\omega_{n,d}^{2}&-2\\zeta_d\\omega_{n,d}&0&0\\\\0&0&-k_r&0\\\\0&0&0&k_s\\end{bmatrix}\\mathbf x",
        law: "把荷兰滚二阶模态、滚转标量和螺旋标量拼接为解耦状态方程。",
        previous: "荷兰滚 η̈d + 2ζdωn,dη̇d + ωn,d²ηd = 0；ṗ = −krp；η̇s = ksηs",
        reason:
          "下标 d 表示荷兰滚，ωn,d 是其自然频率。所有跨模态项为零，这是人为规定的降阶模型。kr > 0 表示滚转衰减，ks 保留正负号。",
      },
      {
        formula:
          "\\lambda_{d,1,2}=-\\zeta_d\\omega_{n,d}\\pm\\omega_{n,d}\\sqrt{\\zeta_d^2-1},\\qquad|\\zeta_d|<1:\\quad\\omega_{d,\\mathrm{osc}}=\\omega_{n,d}\\sqrt{1-\\zeta_d^2}",
        law: "荷兰滚振子沿用二阶特征根公式。",
        previous: "荷兰滚的 2×2 状态块",
        reason:
          "默认根的实部为 −0.234 s⁻¹，振荡频率约 1.2788 rad/s。ζd < 0 导致增长；临界或过阻尼应使用重复实根或两个实根，不能把不存在的正弦振荡赋予它。",
      },
      {
        formula:
          "\\lambda_r=-k_r,\\qquad p(t)=p_0e^{-k_rt},\\qquad\\tau_r=\\frac{1}{k_r}\\quad(k_r>0)",
        law: "直接积分独立滚转角速度的一阶衰减方程。",
        previous: "ṗ = −krp",
        reason:
          "默认 kr = 1.2 s⁻¹，时间常数 τr ≈ 0.833 s。该模态无共轭虚根，因此没有振荡频率；p 的曲线是角速度，不是滚转角曲线。",
      },
      {
        formula:
          "\\lambda_s=k_s,\\qquad\\eta_s(t)=\\eta_{s0}e^{k_st},\\qquad t_2=\\frac{\\ln2}{k_s}\\quad(k_s>0)",
        law: "直接积分螺旋标量，并由指数增长求幅值翻倍时间。",
        previous: "η̇s = ksηs，初始幅值非零",
        reason:
          "ks > 0 增长，ks < 0 衰减，ks = 0 中性。默认 +0.025 s⁻¹ 给出翻倍时间约 27.73 s；5 s 时只增加约 13.31%，慢增长仍是不稳定。零初值在无输入系统中始终为零，不能靠这条零曲线判断稳定性。",
      },
      {
        formula:
          "\\{\\lambda(A)\\}=\\{\\lambda_{d,1},\\lambda_{d,2},-k_r,k_s\\},\\qquad\\text{渐近稳定}\\iff\\max_j\\operatorname{Re}(\\lambda_j)<0",
        law: "块对角系统的特征值来自各独立块；连续时间渐近稳定要求全部实部为负。",
        previous: "已分别求出二阶与一阶模态的根",
        reason:
          "默认荷兰滚和滚转衰减，但螺旋正实根使整体模型不渐近稳定。边界实部为零时须进一步检查；本例 ks = 0 是简单的中性标量。这里的判定只针对当前固定参数的教学模型。",
      },
    ],
    assumptions: `${modalAssumptions} 默认荷兰滚自然频率 1.3 rad/s、阻尼比 0.18；滚转方程 ṗ = −1.2p；螺旋方程 η̇s = 0.025ηs。p 是独立的滚转角速度示意，ηs 是独立的螺旋角幅值，两者没有角度—角速度积分关系。增长到大幅值后的结果不用于真实飞机预测。`,
    variables:
      "ηd：荷兰滚模态幅值 [rad]；η̇d：[rad/s]；ωn,d：荷兰滚自然频率 [rad/s]；ωd,osc：荷兰滚振荡频率 [rad/s]；ζd：无量纲；p：[rad/s]；ηs：[rad]；kr：滚转衰减率 [s⁻¹]；ks：有符号螺旋增长率 [s⁻¹]；λ：[s⁻¹]；τr、t2：[s]。",
    summary:
      "振荡模态看实部和虚部，实根模态看增长率的符号。衰减快的滚转模态无法抵消正实根的慢螺旋增长。掌握模态判断后，再学习反馈怎样改变闭环特征值与扰动响应。",
    references: [stabilityReference, flightReference],
    task: {
      id: "dynamics-lateral",
      prompt:
        "将螺旋增长率设为正值，给螺旋幅值一个非零初值，应用参数并积分至少 5 s。比较螺旋幅值的增长与荷兰滚、滚转模态的衰减，然后记录任务完成。",
    },
  },
];

export const dynamicsQuestions: Question[] = [
  {
    id: "p4-coordinate-front-axis",
    level: 4,
    lessonId: "coordinates-linearization",
    kind: "numeric",
    title:
      "机体 x 前、y 右、z 下，世界为 NED。滚转与偏航均为 0°、俯仰为 +30°，机体前轴单位向量的地向下分量是多少？",
    answer: -0.5,
    tolerance: 0.001,
    unit: "无量纲",
    explanation:
      "R 的第一列为 [cosθ cosψ, cosθ sinψ, −sinθ]ᵀ。地向下分量 = −sin30° = −0.5，负号表示机头抬起。允许误差 ±0.001。",
  },
  {
    id: "p4-coordinate-orthogonal",
    level: 4,
    lessonId: "coordinates-linearization",
    kind: "choice",
    title: "R 把机体向量分量变为 NED 分量。下列哪一组关系正确？",
    options: [
      "反向变换使用 Rᵀ，旋转保持向量长度与夹角",
      "反向变换仍使用 R，旋转会改变单位向量长度",
      "任意交换滚转、俯仰、偏航的顺序都得到相同 R",
    ],
    answer: 0,
    explanation:
      "正交旋转满足 RᵀR = I，所以 R⁻¹ = Rᵀ，并保持内积、长度和夹角。三维旋转通常不满足交换律。",
  },
  {
    id: "p4-linearization-jacobian",
    level: 4,
    lessonId: "coordinates-linearization",
    kind: "choice",
    title: "对 ẋ = f(x,u) 在名义运动附近作一阶线性化，A 矩阵来自哪里？",
    options: [
      "在任意状态下都相同的姿态旋转矩阵 R",
      "在工作点求出的 ∂f/∂x；扰动方程需减去名义运动",
      "直接把全部非线性项删掉，不需要指定工作点",
    ],
    answer: 1,
    explanation:
      "A = (∂f/∂x)|0，B = (∂f/∂u)|0。用满足原方程的名义解 x0(t) 相减后，才有 δẋ ≈ Aδx + Bδu；完整平飞状态的位置导数不必为零。",
  },
  {
    id: "p5-longitudinal-decay-rate",
    level: 5,
    lessonId: "longitudinal-modes",
    kind: "numeric",
    title:
      "独立短周期教学振子 ωn = 3 rad/s、ζ = 0.55。两个特征值共同的实部是多少 s⁻¹？",
    answer: -1.65,
    tolerance: 0.01,
    unit: "s⁻¹",
    explanation:
      "欠阻尼根为 λ = −ζωn ± iωn√(1−ζ²)。实部 σ = −0.55 × 3 = −1.65 s⁻¹；负值对应衰减包络。允许误差 ±0.01 s⁻¹。",
  },
  {
    id: "p5-longitudinal-state-meaning",
    level: 5,
    lessonId: "longitudinal-modes",
    kind: "choice",
    title: "本实验的短周期与长周期状态 [η,η̇] 应怎样解释？",
    options: [
      "是由某架真实飞机气动数据计算的迎角与俯仰角速度",
      "是互不耦合的假想模态幅值与其导数，不能直接当作真实飞机状态",
      "是完整六自由度状态，能预测大迎角与失速",
    ],
    answer: 1,
    explanation:
      "实验直接给定两个二阶块的 ωn、ζ，η 的单位是 rad、η̇ 的单位是 rad/s。单位相同不意味着它们就是 α、q；模型没有实际飞机的气动导数与模态转换。",
  },
  {
    id: "p5-longitudinal-damping-regimes",
    level: 5,
    lessonId: "longitudinal-modes",
    kind: "choice",
    title: "ωn > 0 的二阶模态，哪一句正确区分阻尼情形？",
    options: [
      "ζ < 0 仍然衰减，只是比 ζ > 0 慢",
      "ζ = 1 有重复负实根，ζ > 1 有两个负实根；ζ < 0 则不稳定",
      "所有 ζ 的振荡周期都等于 2π/ωn",
    ],
    answer: 1,
    explanation:
      "λ = −ζωn ± ωn√(ζ²−1)。正临界阻尼和正过阻尼都不具有持续正弦振荡；负阻尼给出正实部。只有 |ζ| < 1 才有振荡频率 ωn√(1−ζ²)。",
  },
  {
    id: "p5-lateral-spiral-double",
    level: 5,
    lessonId: "lateral-modes",
    kind: "numeric",
    title:
      "非零初值的独立螺旋模态满足 η̇s = 0.025ηs，增长率单位为 s⁻¹。幅值翻倍需要多少 s？",
    answer: 27.725887222397812,
    tolerance: 0.05,
    unit: "s",
    explanation:
      "ηs(t)/ηs(0) = e^(0.025t)。令其等于 2，得 t = ln2/0.025 ≈ 27.726 s。允许误差 ±0.05 s。",
  },
  {
    id: "p5-lateral-whole-stability",
    level: 5,
    lessonId: "lateral-modes",
    kind: "choice",
    title:
      "荷兰滚特征根实部为负、滚转根为 −1.2 s⁻¹、螺旋根为 +0.025 s⁻¹，组合模型如何判断？",
    options: [
      "两个模态衰减，所以整体渐近稳定",
      "存在正实根，整体不稳定，即使螺旋增长很慢",
      "把三个模态实部平均为负，就一定渐近稳定",
    ],
    answer: 1,
    explanation:
      "连续时间线性系统渐近稳定要求所有特征值实部为负。块对角模型中的一个正螺旋根就会让相应非零扰动增长，不能用其他衰减模态的根来抵消。",
  },
  {
    id: "p5-lateral-roll-time",
    level: 5,
    lessonId: "lateral-modes",
    kind: "numeric",
    title:
      "独立滚转角速度满足 ṗ = −1.2p，系数单位为 s⁻¹。p 的幅值降到初值的 1/e 所需时间是多少 s？",
    answer: 0.8333333333333334,
    tolerance: 0.005,
    unit: "s",
    explanation:
      "p(t) = p0e^(−1.2t)，时间常数 τ = 1/1.2 ≈ 0.8333 s。这是角速度的衰减，不是滚转角的振荡周期。允许误差 ±0.005 s。",
  },
];
