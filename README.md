# Flight Dynamics Lab

原创中文交互式飞行力学学习网站，当前交付 Phase 1。React + strict TypeScript + Vite + Tailwind CSS + React Three Fiber/Three.js + KaTeX + Recharts。

## Windows 快速启动

在 GitHub 点击 **Code → Download ZIP**，将整个 ZIP 解压到本地文件夹，再双击 `windows-start.cmd`。脚本检查 Node.js 22.12+，必要时尝试通过 winget 安装 LTS，安装依赖、执行类型检查与测试后启动网站并自动打开浏览器。保持终端窗口开启；按 Ctrl+C 停止。

若 winget 不可用，请从 https://nodejs.org/ 安装 Node.js LTS（包含 npm），然后重新运行脚本。详见 `docs/Windows启动说明.txt`。Windows 脚本尚未在实际 Windows 机器验证；项目已在 Linux 云环境通过测试和浏览器验收。

## 开发

需要 Node.js 22.12+（当前验证使用 24.19）。

```sh
npm ci --cache /tmp/fdl-npm-cache
npm run dev
```

默认端口 5173。在本机浏览器访问 Vite 输出的地址。

```sh
npm run typecheck
npm test
npm run build
```

## 已实现

首页、六级知识依赖导航、第一课七段教学流程；四力实验、迎角升力实验、三轴姿态实验；轨道观察和三种外部观察方向；力/轴矢量；参数滑块与数值输入（回车或失焦提交）；单位/公式切换；静态参数快照及升力曲线对比；固定时间步运动、暂停、单步、重置、速度与 CSV 导出；概念/预测/计算/操作题判题；错题过滤；localStorage 进度与主题；响应式浅色/深色布局及错误边界。

仅第一节完整课程已开放，其余课程目录均为规划。静态实验即时响应，时间控制仅用于四力实验。

## 架构和模型

- `src/content/curriculum.ts`：课程、原创问题、推导与公开资料链接。
- `src/physics/models.ts`：不依赖 UI 的纯计算；插件可使用 `Parameters → result` 接口，扩展时将计算接入 Worker 消息接口。
- `src/components/Lab.tsx`：参数、时间推进、图表与实验选择。
- `src/components/Aircraft.tsx`：机体姿态矩阵到渲染坐标/四元数。
- `src/storage/progress.ts`：可替换为账户持久化适配器。
- `tests/physics.test.ts`：解析/手算基准。

所有飞机参数为假设教学示例。内部 SI；迎角显示/模型斜率使用度，有明确转换。CL=0.2+0.08α 在 −10° 至 15°，15° 以后为连续指数衰减示意。没有宣称来自真实飞机数据。CD=0.025+0.055CL² 为假设阻力极线。升力和阻力沿风轴；四力模型为固定来流/迎角的二维增量运动，推力沿来流，z 向上，不能当作自由飞行或 6DOF。显示机体姿态与气动力是独立教学模式，三维力矢量只用于零姿态四力示意。三维位移和矢量有显示缩放/限幅，图表保留实际值。积分 RK4，物理 Δt=0.02 s，最长观察 20 s；数值错误与物理失稳区分。

姿态采用机体 x 前、y 右、z 下及 NED 世界轴，内禀 yaw-pitch-roll，姿态模型无力矩/角速度动力学；俯仰限于 ±80°。旋转矩阵通过正交基变换后转为 Three.js 四元数。

基准：默认 q=1531.25 Pa，CL=0.6，L=14700 N；速度翻倍升力四倍；按 L/g 与 D 设置质量和推力得到零加速度；恒加速度轨迹匹配解析解；RK4 指数方程基准；姿态矩阵正交和俯仰/偏航符号。

## 下一阶段

Phase 2：开放动压、阻力极线、最佳升阻比、平飞/爬升/协调转弯课程和实验。Phase 3–5：静稳定与配平、状态空间模态、PID 与一致坐标的 6DOF。未实现账户/数据库、Worker 数值后端、操纵面运动、动态航迹三维线、真正跟随/仪表相机和高级科学图表。

已提供 `src/physics/experiments.ts` 注册表与纯计算请求/响应接口，未来可以连接 Web Worker 并增加可视化插件与验证基准。
