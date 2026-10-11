import type { Question } from "./questions";

export interface ControlLesson {
  id: string;
  level: 6;
  title: string;
  experiment: string;
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

const feedbackReference = {
  name: "Åström & Murray · Feedback Systems（反馈、PID 与执行器限制）",
  url: "https://fbsbook.org/",
};
const flightDynamicsReference = {
  name: "MIT OCW 16.333 · Aircraft Stability and Control",
  url: "https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/",
};
const simulationReference = {
  name: "JSBSim · Reference Manual（坐标系与飞行动力学建模）",
  url: "https://jsbsim-team.github.io/jsbsim-reference-manual/",
};

export const controlLessons: ControlLesson[] = [
  {
    id: "pid-control",
    level: 6,
    title: "俯仰闭环：PID、执行器与抗积分饱和",
    experiment: "pid",
    objective:
      "把指令、误差、控制律、执行器和被控对象连成闭环；用同一初始条件比较 P、I、D 的作用，识别虚拟执行器限幅、速率限制与有限观察窗的影响。",
    observation:
      "重置后用默认 10° 俯仰阶跃运行至少 4 s。先看俯仰角 θ 与俯仰角速度 q，再看虚拟执行器指令与实际虚拟操纵角：大误差时它们可能因 ±20° 限幅、±60°/s 速率限制和 0.05 s 执行器滞后而不同。暂停并记录当前观察窗的峰值、超调和调节时间；重置，在相同目标、扰动与运行时长下修改一个增益后重做。",
    question:
      "虚拟执行器已达到 +20° 上限且误差仍为正，继续无条件累加积分通常会带来什么问题？",
    predictionOptions: [
      "积分越大越好，虚拟执行器能立即超过物理上限",
      "积分继续积累，误差反向后仍可能推动虚拟执行器保持正向饱和，延迟恢复",
      "积分会自动清零，因此执行器限制没有影响",
    ],
    predictionAnswer: 1,
    explanation:
      "闭环根据俯仰误差算出虚拟操纵角指令，再通过一个有位置、速率和滞后限制的虚拟执行器作用于教学俯仰对象。P 对当前误差作出响应，I 对持续偏差累加，D 使用实测俯仰角速度提供阻尼。此处用 −Kdq，而不是直接对阶跃误差求导，因此目标突变不会直接产生理想微分冲击。默认被控对象有恢复项 −ωn²θ，维持非零俯仰需要持续虚拟操纵角；只有比例反馈时通常仍有稳态误差。积分可补偿这个持续需求，但执行器饱和时必须限制继续向饱和方向积累。增益、执行器和扰动共同决定响应，不能只凭“增益越大，控制越好”判断。",
    steps: [
      {
        formula:
          "\\dot\\theta=q,\\qquad\\dot q=-2\\zeta\\omega_n q-\\omega_n^2\\theta+Ku+d_g(t)",
        law: "用带阻尼的二阶小角度对象说明俯仰控制。",
        previous: "俯仰状态为 θ 与 q；实际虚拟操纵角为 u",
        reason:
          "默认 ωn = 1.5 rad/s、ζ = 0.55、K = 4 s⁻²。dg 是加入角加速度方程的教学扰动，单位 rad/s²；这里的“阵风”没有从真实空气速度和气动导数推导。此二阶对象不等同于后面的非线性六自由度飞机。",
      },
      {
        formula:
          "e=\\theta_{\\mathrm{cmd}}-\\theta,\\qquad u_{\\mathrm{raw}}=K_pe+K_i\\int e\\,dt-K_dq",
        law: "比例、积分与测量微分构成 PID 控制律。",
        previous: "俯仰目标 θcmd 与实测 θ、q",
        reason:
          "内部角度均为 rad。默认 Kp = 2.8、Ki = 0.9 s⁻¹、Kd = 0.9 s；这些数值的单位必须与当前对象一致。目标为常值时误差导数等于 −q；目标阶跃处使用实测 q 可避免对目标求导的冲击。",
      },
      {
        formula:
          "u_{\\mathrm{cmd}}=\\operatorname{clip}(u_{\\mathrm{raw}},-u_{\\max},u_{\\max}),\\qquad u_{\\max}=20^\\circ",
        law: "把控制器要求的虚拟执行器位置限制在可实现范围。",
        previous: "未限幅指令 u_raw",
        reason:
          "执行器还含 0.05 s 一阶滞后与 |u̇| ≤ 60°/s 的速率约束。大指令不能立即变成实际虚拟操纵角；曲线应区分指令和实际值。单步与连续运行均采用固定 Δt = 0.01 s 的物理步长，运行按钮只决定是否重复这些步。",
      },
      {
        formula:
          "\\dot I_e=\\begin{cases}0,&|u_{\\mathrm{raw}}|\\geq u_{\\max}\\ \\text{且}\\ e u_{\\mathrm{raw}}>0\\\\e,&\\text{其他情况}\\end{cases}",
        law: "条件积分抑制继续向位置饱和方向累积。",
        previous: "Ie = ∫e dt，Ki ≥ 0；指令限幅且误差还要求更多同向虚拟操纵角",
        reason:
          "若正向饱和且误差为正，就冻结积分；若误差反向，则允许积分减小以帮助退出饱和。该教学抗饱和策略针对位置限幅，不代表完全补偿了速率限制、滞后或所有执行器非线性。重置会清除状态、积分和响应记录，让两次比较有相同起点。",
      },
      {
        formula:
          "\\dot\\theta=\\dot q=0\\quad\\Rightarrow\\quad u_{\\mathrm{eq}}=\\frac{\\omega_n^2}{K}\\theta_{\\mathrm{cmd}}",
        law: "在无扰动的目标平衡点求持续虚拟操纵角需求。",
        previous: "q = 0，θ = θcmd，dg = 0",
        reason:
          "默认 10° 目标需要 5.625° 实际虚拟操纵角，位于限幅内。稳定、可实现且 Ki > 0 时，积分项可保留这个非零输出并使误差趋零。目标需要的虚拟操纵角超出上限时，任何积分增益都不能使该目标成为可实现的静态平衡。",
      },
      {
        formula:
          "M_p=\\frac{\\max(0,\\max_t[\\operatorname{sgn}(\\Delta\\theta)(\\theta(t)-\\theta_{\\mathrm{cmd}})])}{|\\Delta\\theta|}\\times100\\%,\\quad\\Delta\\theta=\\theta_{\\mathrm{cmd}}-\\theta(0)",
        law: "按非零阶跃幅度定义观察窗内的百分比超调。",
        previous: "固定初始条件、目标、扰动与记录时长的阶跃实验",
        reason:
          "下降阶跃沿相反方向寻找超调；零幅阶跃没有此百分比定义。2% 调节带为 |θ − θcmd| ≤ 0.02|Δθ|，至少连续驻留 1 s 并保持至当前观察窗结束才报告已观察到的调节时间。未满足时显示未观察到；有限窗结果不能保证此后永不出带。不同扰动或不同记录时长的数值不宜直接用来排名。",
      },
    ],
    assumptions:
      "假想二阶俯仰教学对象，小角度、参数不随空速变化；内部 SI 与 rad，界面角度为 °。采用固定 0.01 s 步长、有限运行与记录窗，默认目标为从 0° 到 10° 的阶跃。虚拟操纵角范围 ±20°、速率 ±60°/s、滞后 0.05 s；条件积分仅处理位置饱和。u 是抽象的正机头上仰虚拟操纵角；若映射到正后缘下偏的机械升降舵，则 δe = −u。PID 与状态反馈均为教学比较，未经过真实飞机辨识、适航或自动驾驶验证。",
    variables:
      "θ、θcmd、e：俯仰角、指令与误差 [rad]；q：俯仰角速度 [rad/s]；u、u_cmd：实际与指令虚拟操纵角 [rad]，正值产生机头上仰；机械升降舵正值为后缘下偏，映射为 δe = −u；Ie：误差积分 [rad·s]；Kp：无量纲；Ki：[s⁻¹]；Kd：[s]；ωn：[rad/s]；ζ：无量纲阻尼比；K：[s⁻²]；dg：[rad/s²]；Mp：观察窗百分比超调。",
    summary:
      "控制器要求的虚拟操纵角必须经过执行器才能改变飞机状态。调增益时同时观察误差、角速度、积分与实际虚拟操纵角；超调和调节时间只有在同一阶跃、同一扰动与同一观察条件下才有可比性。",
    references: [feedbackReference, flightDynamicsReference],
    task: {
      id: "control-pid",
      prompt:
        "选择 PID，重置，用默认非零 10° 阶跃运行至少 4 s，暂停并检查记录的超调与调节时间（显示未观察到调节也可完成观察）。重置后只改一个增益，按同样时长重做并比较；也可用“单步 +0.01 s”核对虚拟执行器指令与实际虚拟操纵角。最后记录 PID 任务。",
    },
  },
  {
    id: "six-dof",
    level: 6,
    title: "综合仿真：六自由度、相对气流与手动操纵",
    experiment: "sixdof",
    objective:
      "从机体系合力和合力矩积分平移、转动与姿态，检查坐标系、四元数、重力和风的方向；将近似配平与小舵面扰动联系到实际轨迹。",
    observation:
      "重置到默认 50 m/s、无风、水平姿态与近似配平推力，先运行至少 2 s，观察速度、姿态和 NED 位置。再次重置，在手动模式给约 −2° 机械升降舵小指令（后缘上偏、机头上仰），运行至少 2 s，比较俯仰角速度、俯仰角、迎角与高度的先后变化。用单步查看最初 0.01 s 的状态变化；姿态变化与航迹变化不必同步。",
    question:
      "机头朝北、水平飞行，地面速度向北 50 m/s，均匀风也向北 10 m/s。用于动压和迎角计算的空速是多少？",
    predictionOptions: ["60 m/s", "50 m/s", "40 m/s"],
    predictionAnswer: 2,
    explanation:
      "六自由度指三个平移自由度与三个转动自由度；姿态可以由四元数的四个分量表示，但单位长度约束使它仍只有三个独立自由度。模型在地面 NED 系记录位置，在随机体转动的机体系记录速度、角速度、合力与合力矩。风先从地面系转换到机体系，再从机体对地速度中扣除，气动力由这个相对空气速度计算。合力改变速度，合力矩改变角速度，角速度再改变姿态；俯仰上仰不会强制把速度立即旋转到机头方向。因此手动加舵时要同时看角速度、迎角和航迹，而不能只看机头朝向。",
    steps: [
      {
        formula:
          "\\mathbf{p}^{N}=(x_N,y_E,z_D)^T,\\quad\\mathbf{v}^{b}=(u,v,w)^T,\\quad\\dot{\\mathbf p}^{N}=R_b^N\\mathbf v^b",
        law: "固定地面坐标与随机体旋转坐标分别记录位置和速度。",
        previous: "NED：北、东、地；机体：前、右、下",
        reason:
          "R 将机体系向量转到 NED，Rᵀ 反向转换。NED 的 z 向下为正，高度变化率是 −żD；正机体 w 也朝机腹下方，但飞机倾斜时 w 并不等于地面下降速度。",
      },
      {
        formula:
          "\\mathbf v_a^b=\\mathbf v^b-R^T\\mathbf v_w^N,\\quad V_a=\\|\\mathbf v_a^b\\|,\\quad\\alpha=\\operatorname{atan2}(w_a,u_a),\\quad\\beta=\\arcsin(v_a/V_a)",
        law: "从对地速度减去风速，求气动所用的相对空气速度。",
        previous: "风向量 vwN 表示空气相对地面实际移动的方向与速度",
        reason:
          "机体系 Va 向量的三个分量为 ua、va、wa。风向输入在这里是速度向量方向，不是气象学“风从哪里来”的命名。低空速时角度和动压模型的适用性变差，需要停止或标记边界；不能除以零。",
      },
      {
        formula:
          "\\bar q=\\tfrac12\\rho V_a^2,\\quad C_L=0.40027+5\\alpha,\\quad C_D=0.025+0.055C_L^2,\\quad L=\\bar qSC_L,\\quad D=\\bar qSC_D",
        law: "用低速附着流近似计算气动力，并按气流方向转换到机体系。",
        previous: "α 以 rad 计算；S = 16 m²、ρ = 1.225 kg/m³",
        reason:
          "阻力沿相对速度反向，升力沿气流坐标的向上法向；必须使用 α、β 的方向变换，不能在大迎角或侧滑时固定把 −D、−L 填进机体 x、z。CL0 调到约 0.40027，使 1000 kg 飞机在 50 m/s、α = 0 附近 L ≈ mg；相应阻力与配平推力约为 828.39 N。CLmax = 1.4 只定义教学附着流边界，越过近似失速范围会停止推演。",
      },
      {
        formula:
          "\\dot{\\mathbf v}^{b}=\\frac{\\mathbf F^{b}}{m}-\\boldsymbol\\omega\\times\\mathbf v^{b}+R^T\\mathbf g^{N},\\qquad\\mathbf g^{N}=(0,0,g)^T",
        law: "牛顿第二定律在旋转的机体系中包含运输项。",
        previous: "Fb 是推进与气动力之和，不含重力；ω = (p, q, r)ᵀ",
        reason:
          "−ω × v 来自机体坐标轴本身的旋转；它不能删去，也不能当作额外气动力。重力由 NED 系转换后加一次。默认质量 1000 kg、g = 9.80665 m/s²。恒定风不直接改变重力或坐标变换，风通过相对气流改变气动力。",
      },
      {
        formula:
          "\\dot{\\boldsymbol\\omega}=I^{-1}(\\mathbf M^b-\\boldsymbol\\omega\\times I\\boldsymbol\\omega),\\quad C_m=-0.8\\alpha-12\\frac{q\\bar c}{2V_a}-1.0\\delta_e",
        law: "欧拉刚体方程把合力矩与角速度变化相联系。",
        previous: "俯仰力矩 My = q̄Sc̄Cm；完整方程同时积分三个转动轴",
        reason:
          "教学惯性张量设为对角阵 diag(1200, 1800, 2500) kg·m²，保留陀螺耦合 ω × Iω。Cmα = −0.8 rad⁻¹ 提供恢复趋势，Cmq = −12 为俯仰阻尼，Cmδe = −1 rad⁻¹；机械升降舵 δe 以尾翼后缘下偏为正，正指令产生机头下俯力矩，负指令后缘上偏产生机头上仰力矩，与前面配平章节的机械符号一致。",
      },
      {
        formula:
          "\\dot{\\mathbf q}_{\\mathrm{att}}=\\tfrac12\\mathbf q_{\\mathrm{att}}\\otimes(0,p,q,r)^T,\\qquad\\|\\mathbf q_{\\mathrm{att}}\\|=1",
        law: "用机体系角速度更新从机体到 NED 的单位四元数。",
        previous:
          "标量在前的四元数 qatt = [w, x, y, z]；⊗ 为 Hamilton 四元数乘积",
        reason:
          "位置、速度、角速度与四元数用固定 Δt = 0.01 s 的 RK4 同步积分，步后归一化四元数以控制数值漂移。单位姿态是 [1, 0, 0, 0]；四元数分量不能当作欧拉角。有限步长、归一化和边界检查不能证明真实气动模型正确，需在有效范围内观察结果。",
      },
    ],
    assumptions:
      "假想刚性飞机、平坦局部 NED 地面、均匀恒定重力与密度，不含地球旋转和曲率；固定质量与对角惯性张量，低速、附着流气动近似。机械升降舵 δe 以后缘下偏为正，产生负俯仰力矩；负 δe 为后缘上偏，产生正俯仰力矩。风通过空气相对速度参与气动力，舵面与推进采用简化教学关系。CL0 的调整使默认状态近似配平，不是实测飞机的配平数据；遇到低空速、近似失速或数值边界会停止，未建模失速后的非定常分离流。所有参数和手动、PID、状态反馈控制均未经真实飞机或自动驾驶系统验证，不能用于飞行操作或安全判断。",
    variables:
      "pN：[m]，NED 位置；vb = [u,v,w]：[m/s]，机体表示的对地速度；vwN：[m/s]，NED 风向量；Va：[m/s]，空速；α、β：[rad]，迎角与侧滑角；ω = [p,q,r]：[rad/s]；I：[kg·m²]；Fb：[N]；Mb：[N·m]；q̄：[Pa]，动压；c̄：[m]，参考弦长；qatt：单位四元数，标量在前；δe：[rad]，机械升降舵偏角，后缘下偏为正。",
    summary:
      "六自由度仿真把气动、推进、重力与刚体运动连起来。先核对坐标和相对气流，再核对合力与合力矩；用重置后的近似配平和小舵角对比，区分姿态、迎角与航迹。",
    references: [flightDynamicsReference, simulationReference],
    task: {
      id: "control-sixdof",
      prompt:
        "重置，在手动模式保持默认近似配平并运行至少 2 s，检查速度、俯仰与高度。再重置，把机械升降舵设为约 −2°（后缘上偏、机头上仰），运行至少 2 s，暂停并观察俯仰角速度、迎角与 NED 轨迹；可先用“单步 +0.01 s”查看最初响应。完成任一至少 2 s 的有效观察后记录六自由度任务。",
    },
  },
  {
    id: "altitude-speed-hold",
    level: 6,
    title: "速度与高度保持：两个反馈环如何协作",
    experiment: "autopilot",
    objective:
      "在简化纵向点质点模型中，用推力调节空速，用升力调节航迹角，再用航迹角改变高度；识别能量耦合、执行器滞后、积分饱和与垂直风的建模边界。",
    observation:
      "重置到 V = 50 m/s、h = 1000 m、γ = 0 的平衡初态，开启“速度保持”和“高度保持”，保留目标 55 m/s、1020 m，运行至少 8 s。观察实际推力、CL、航迹角与误差，查看起始加速是否触发推力上限。暂停后逐一关闭两个保持开关并重置作比较；关闭后的手动默认值是初态配平推力与 CL。再设一个小垂直阵风，它会在 t = 3 s 后加入高度变化率，比较高度环的补偿与饱和。",
    question:
      "在正空速的点质点模型中，瞬时升力大于 mg cos γ 时，最直接的运动变化是什么？",
    predictionOptions: [
      "空速必定立即增加，航迹角不变",
      "航迹角变化率为正，速度方向逐渐向上转动",
      "高度瞬间跳到目标值",
    ],
    predictionAnswer: 1,
    explanation:
      "速度保持和高度保持各有反馈环，但共享同一飞机运动。推力与阻力的差以及重力沿航迹的分量决定空速变化；升力与重力法向分量的差决定航迹弯曲；当前航迹角决定垂直速度。因此增加 CL 首先改变航迹角变化率，随后才改变高度，爬升也会消耗沿航迹的可用加速能力。这里是单独的二维点质点教学模型，只积分 V、h、γ 与执行器状态，没有六自由度姿态、俯仰惯性或真实升降舵内环；它用一个有滞后的 CL 指令代替那些过程。轨迹由运动方程积分得到，控制器只提出推力与 CL 要求。",
    steps: [
      {
        formula:
          "\\dot V=\\frac{T-D}{m}-g\\sin\\gamma,\\qquad\\dot\\gamma=\\frac{L-mg\\cos\\gamma}{mV},\\qquad\\dot h=V\\sin\\gamma+w_{\\mathrm{up}}",
        law: "沿航迹和垂直航迹应用牛顿第二定律，并积分向上为正的高度。",
        previous: "V > 0；γ 向上为正；T 沿航迹，L 垂直航迹",
        reason:
          "γ 是速度方向相对水平面的角度，不是机头俯仰角。wup 只作为该简化模型的垂直平流速度加入高度变化率；它不会另行产生阵风气动力。wup > 0 表示向上，与上一课 NED 的 z 向下为正相反。",
      },
      {
        formula:
          "\\bar q=\\tfrac12\\rho V^2,\\qquad L=\\bar qSC_L,\\qquad D=\\bar qS(0.025+0.055C_L^2)",
        law: "根据当前空速与实际 CL 更新升力、阻力。",
        previous: "固定 ρ = 1.225 kg/m³、m = 1000 kg、S = 16 m²",
        reason:
          "默认 V = 50 m/s 时，CLtrim = mg/(q̄S) ≈ 0.4002714，Ttrim = D ≈ 828.39 N，L = mg、T = D 构成无风水平平衡。爬升指令提高升力需求时，诱导阻力也会改变，速度环需要响应这种耦合。",
      },
      {
        formula:
          "e_V=V_{\\mathrm{cmd}}-V,\\qquad T_{\\mathrm{raw}}=D+mg\\sin\\gamma+m\\left(k_{pV}e_V+k_{iV}\\int e_V\\,dt\\right)",
        law: "速度 PI 在阻力和爬升重力前馈基础上要求额外加速度。",
        previous: "将 V̇ 方程重排为所需推力",
        reason:
          "默认 kpV = 0.6 s⁻¹、kiV = 0.12 s⁻²；括号内单位为 m/s²，乘质量后才得到 N。推力指令限制为 0～3500 N，实际推力以 0.3 s 一阶滞后跟随。位置饱和且误差还推动同向饱和时冻结积分，误差反向时允许积分帮助退出饱和。",
      },
      {
        formula:
          "e_h=h_{\\mathrm{cmd}}-h,\\qquad v_{h,\\mathrm{cmd}}=\\operatorname{clip}\\left(k_he_h+k_{ih}\\int e_h\\,dt,-5,5\\right),\\qquad\\gamma_{\\mathrm{cmd}}=\\operatorname{clip}\\left(\\arcsin\\frac{v_{h,\\mathrm{cmd}}}{V},-10^\\circ,10^\\circ\\right)",
        law: "高度外环先要求垂直速度，再转换为有界航迹角指令。",
        previous: "无垂直风时 ḣ = V sin γ",
        reason:
          "默认 kh = 0.12 s⁻¹、kih = 0.004 s⁻²；高度误差单位为 m，输出单位为 m/s。±5 m/s 和 ±10° 是教学指令限制，不是飞机性能许可。存在垂直风时，高度反馈通过持续误差补偿平流影响；它不能让任意风或高度指令都可实现。",
      },
      {
        formula:
          "C_{L,\\mathrm{raw}}=\\frac{m\\left[g\\cos\\gamma+Vk_\\gamma(\\gamma_{\\mathrm{cmd}}-\\gamma)\\right]}{\\bar qS},\\qquad k_\\gamma=1.2\\ \\mathrm{s}^{-1}",
        law: "把航迹角内环所需的变化率转换为升力系数要求。",
        previous: "希望 γ̇ ≈ kγ(γcmd − γ)，代入航迹角动力学",
        reason:
          "实际 CL 以 0.1 s 滞后跟随限幅后的指令，范围 −0.2～1.4。达到爬升率、航迹角或 CL 限制且高度误差仍要求更多同向动作时，高度积分停止进一步累积；能帮助退出饱和的积分更新仍允许。CL 上限不能代表完整失速后响应，低空速时升力需求可能先达到边界。",
      },
      {
        formula:
          "\\dot T=\\frac{T_{\\mathrm{cmd}}-T}{0.3\\ \\mathrm{s}},\\qquad\\dot C_L=\\frac{C_{L,\\mathrm{cmd}}-C_L}{0.1\\ \\mathrm{s}},\\qquad\\Delta t=0.01\\ \\mathrm{s}",
        law: "让执行器与运动状态一起按固定物理步长推进。",
        previous: "推力和 CL 指令已经过限幅；重置恢复初态并清除两个误差积分",
        reason:
          "仿真使用 RK4 积分，每次“单步 +0.01 s”与连续运行中的一个物理步相同。界面改变目标或参数会从相同初始状态重跑，控制器再通过推力与 CL 的连续动态改变实际速度和高度。两次比较要使用相同初态、开关、风和运行时长；8 s 的记录只用于观察，不要求已经精确收敛。",
      },
    ],
    assumptions:
      "单独的二维纵向点质点教学模型，与六自由度飞机分开；只有空速、航迹角、高度、两个执行器与 PI 积分状态，没有机体姿态、俯仰力矩、真实舵面或完整发动机。质量、密度、机翼面积固定，气动采用低速附着流极曲线；推力限幅 0～3500 N、滞后 0.3 s，CL 限幅 −0.2～1.4、滞后 0.1 s。目标输入空速 25～80 m/s、高度 800～1200 m，输入范围不是验证过的飞行包线。垂直阵风设为 −3～3 m/s，在 3 s 后阶跃加入高度运动学，未模拟阵风载荷或非定常气动。控制效果与性能均未经真实飞机或自动驾驶验证。",
    variables:
      "V、Vcmd、eV：[m/s]，空速、目标与误差；h、hcmd、eh：[m]，高度、目标与误差，向上为正；γ、γcmd：[rad]，航迹角与指令；wup：[m/s]，向上为正的垂直平流；T：[N]；CL：无量纲；kpV、kh、kγ：[s⁻¹]；kiV、kih：[s⁻²]；∫eV dt：[m]；∫eh dt：[m·s]。",
    summary:
      "推力控制空速，升力先改变航迹角，再改变高度；爬升与阻力把两个反馈环耦合起来。观察目标、实际状态、执行器和饱和，才能解释为何开着保持功能仍会有暂态误差或无法实现的指令。",
    references: [feedbackReference, flightDynamicsReference],
    task: {
      id: "control-autopilot",
      prompt:
        "重置，开启“速度保持”和“高度保持”，保留默认目标 55 m/s 与 1020 m，运行至少 8 s 后暂停。检查空速、高度、航迹角、推力与 CL，识别是否发生饱和；无需精确收敛即可记录任务。可再重置，单独关闭一个保持开关，或加入 3 s 后出现的小垂直阵风，按相同时长比较响应。",
    },
  },
];

export const controlQuestions: Question[] = [
  {
    id: "p6-pid-measurement-derivative",
    level: 6,
    lessonId: "pid-control",
    kind: "choice",
    title:
      "本课 PID 使用 u_raw = Kpe + Ki∫e dt − Kdq。用实测角速度 q 做微分项，对阶跃俯仰目标有什么直接作用？",
    options: [
      "避免直接对目标阶跃求导产生的微分冲击，同时对俯仰运动提供阻尼反馈",
      "保证任意增益都不会振荡",
      "保证实际虚拟执行器立即达到指令值",
    ],
    answer: 0,
    explanation:
      "目标突变不会使实测角速度在该瞬间产生理想冲激，因此 −Kdq 避免了目标微分冲击。闭环稳定性和实际虚拟执行器响应仍取决于增益、对象与执行器限制。",
  },
  {
    id: "p6-pid-conditional-integration",
    level: 6,
    lessonId: "pid-control",
    kind: "choice",
    title:
      "Ki > 0，未限幅虚拟执行器指令超过 +20° 上限，误差 e > 0。条件积分应如何处理？",
    options: [
      "继续积分，直到要求的虚拟执行器达到无限大",
      "暂时冻结误差积分；误差反向并帮助退出饱和时允许积分更新",
      "删除俯仰恢复力矩，使目标自动实现",
    ],
    answer: 1,
    explanation:
      "e > 0 会进一步增加正向积分输出，加重饱和，所以冻结这一更新。e < 0 有助于减小正向输出，允许更新。抗积分饱和不能让执行器超过物理上限，也不保证补偿所有速率或滞后影响。",
  },
  {
    id: "p6-pid-equilibrium-elevator",
    level: 6,
    lessonId: "pid-control",
    kind: "numeric",
    title:
      "无扰动教学对象 θ̇ = q，q̇ = −2ζωnq − ωn²θ + Ku，ωn = 1.5 rad/s、K = 4 s⁻²。维持 θ = 10°、q = 0，需要多少度实际虚拟操纵角？",
    answer: 5.625,
    tolerance: 0.01,
    unit: "°",
    explanation:
      "平衡要求 Ku = ωn²θ，所以 u = (1.5²/4) × 10° = 5.625°。θ 与虚拟操纵角 u 均由 rad 转为 °，比例不变；阻尼项因 q = 0 消失。该需求低于 ±20° 限幅。允许误差 ±0.01°。",
  },
  {
    id: "p6-sixdof-ned-height",
    level: 6,
    lessonId: "six-dof",
    kind: "choice",
    title:
      "局部 NED 坐标中 zD 向下为正，位置 zD 从 −100 m 变为 −90 m，飞机高度怎样变化？",
    options: ["上升 10 m", "下降 10 m", "只由俯仰角决定，无法判断"],
    answer: 1,
    explanation:
      "相对同一基准，高度 h = −zD。高度从 100 m 变为 90 m，因此下降 10 m；机头俯仰不能代替位置的高度变化。",
  },
  {
    id: "p6-sixdof-wind-airspeed",
    level: 6,
    lessonId: "six-dof",
    kind: "numeric",
    title:
      "水平朝北，机体系与 NED 对齐。飞机对地向北 50 m/s，均匀风向量为 [10, 0, 0] m/s（空气向北移动）。用于动压的空速是多少 m/s？",
    answer: 40,
    tolerance: 0.01,
    unit: "m/s",
    explanation:
      "相对空气速度为 va = vground − vwind = [50,0,0] − [10,0,0] = [40,0,0] m/s，其长度为 40 m/s。这里风向量表示空气运动方向，区别于气象风的来向名称。允许误差 ±0.01 m/s。",
  },
  {
    id: "p6-sixdof-quaternion-convention",
    level: 6,
    lessonId: "six-dof",
    kind: "choice",
    title:
      "本课四元数为标量在前的 [w,x,y,z]，表示机体到 NED 的旋转。哪一项正确表示零旋转？",
    options: ["[0,0,0,0]", "[0,0,0,1]", "[1,0,0,0]"],
    answer: 2,
    explanation:
      "标量在前的单位四元数 [1,0,0,0] 表示零旋转，[−1,0,0,0] 表示相同姿态。零向量不满足单位长度约束；[0,0,0,1] 在当前约定下表示绕 z 轴旋转 180°。",
  },
  {
    id: "p6-hold-lift-flight-path",
    level: 6,
    lessonId: "altitude-speed-hold",
    kind: "choice",
    title:
      "简化纵向点质点模型中 V > 0，升力 L > mg cos γ。由 γ̇ = (L − mg cos γ)/(mV) 可直接得出什么？",
    options: [
      "γ̇ > 0，速度方向向更大的向上航迹角转动",
      "γ̇ = 0，只有机头俯仰角改变",
      "高度立即等于目标高度",
    ],
    answer: 0,
    explanation:
      "分母 mV 为正、分子为正，所以 γ̇ > 0。高度随后由 ḣ = V sin γ + wup 积分变化；该点质点模型不包含机头俯仰状态。",
  },
  {
    id: "p6-hold-thrust-saturation",
    level: 6,
    lessonId: "altitude-speed-hold",
    kind: "numeric",
    title:
      "初态 V = 50 m/s、γ = 0、m = 1000 kg、D = 828.39 N，积分为零。速度目标 55 m/s，kpV = 0.6 s⁻¹，推力范围 0～3500 N。按 Traw = D + mg sin γ + mkpV(Vcmd − V)，限幅后的推力指令是多少 N？",
    answer: 3500,
    tolerance: 1,
    unit: "N",
    explanation:
      "Traw = 828.39 + 1000 × 0.6 × (55 − 50) = 3828.39 N，超过上限，所以 Tcmd = 3500 N。实际推力还要经过 0.3 s 滞后，不能在初始瞬间直接变为 3500 N。允许误差 ±1 N。",
  },
  {
    id: "p6-hold-vertical-wind-model",
    level: 6,
    lessonId: "altitude-speed-hold",
    kind: "choice",
    title:
      "本课点质点模型只把垂直风 wup 加入 ḣ = V sin γ + wup。γ = 0、wup = +2 m/s 时，瞬时高度变化率是多少，风代表什么？",
    options: [
      "−2 m/s，风立即改变机体俯仰力矩",
      "0 m/s，保持高度时风自动消失",
      "+2 m/s，风在此仅代表向上的垂直平流",
    ],
    answer: 2,
    explanation:
      "γ = 0 时 V sin γ = 0，因此 ḣ = +2 m/s，向上为正。高度反馈会在后续根据误差调整航迹；本模型没有把该风作为阵风气动力或俯仰力矩，不能与六自由度风模型混用。",
  },
];
