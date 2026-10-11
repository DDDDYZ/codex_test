# Flight Dynamics Lab

原创中文交互式飞行力学网站。当前交付 **Phase 2**：第一节飞行基础课、5 节飞行性能课、7 组实验和独立在线答题。React、严格 TypeScript、Vite、Tailwind CSS、Three.js/React Three Fiber、KaTeX、Recharts。

## Windows 快速启动与更新

在 GitHub 选择 **Code → Download ZIP**，将整个 ZIP 解压，再双击 `windows-start.cmd`。脚本检查 Node.js 22.12+，必要时尝试用 winget 安装 Node.js LTS，安装锁文件依赖、运行类型检查和所有单元测试，然后启动网站并打开浏览器。保持终端窗口开启；按 Ctrl+C 停止。

若 winget 不可用，从 https://nodejs.org/ 安装 Node.js LTS（包含 npm），重新运行脚本。详见 `docs/Windows启动说明.txt`。脚本未在实际 Windows 机器验证；项目在 Linux 云环境通过模型测试和 Chromium 浏览器验收。

从 Phase 1 更新：先停止原来的服务器，下载最新 ZIP 并解压到新的文件夹，运行启动脚本。保持相同浏览器及访问地址（默认端口 5173），原有本地学习进度会保留。localStorage 按地址隔离；换浏览器、端口或清除浏览器数据会改变进度存储。

## 开发与验证

需要 Node.js 22.12+，本环境为 24.19。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

开发服务默认端口 5173。云环境可用 `npm ci --cache /tmp/fdl-npm-cache` 避开默认缓存权限问题。

可选生产版浏览器验收：

```sh
npx playwright install chromium
npm run test:e2e
```

浏览器脚本会构建并临时启动本地 Vite preview，测试结束后关闭自己启动的服务。Linux 已有 `/usr/bin/chromium` 时直接使用；也可用 `FDL_CHROMIUM_PATH` 指定可执行文件，`FDL_TEST_PORT` 改验收端口。截图和 CSV 写入已忽略的 `test-results/`。浏览器测试只验证本地功能，不部署网站。

## 已实现

- 第一节“飞机为什么能飞”：四力、升力、三轴姿态，逐步公式、预测、实验与总结。
- Level 2 的 5 节完整原创课程：动压、阻力极曲线与最佳升阻比、平飞、爬升与滑翔、协调转弯。
- 3 组基础实验：四力平衡、迎角与升力、三轴姿态。四力动态增量模型使用固定 0.02 s RK4，支持暂停、单步、仿真速度和 CSV 导出。
- 4 组稳态性能实验：阻力极线与 L/D 峰值、平飞需用推力/功率、精确稳态爬升与无动力滑翔、转弯半径/载荷/失速速度。稳态实验参数即时更新，明确没有时间积分。
- 性能滑块与数值输入、有效范围检查、同步受力图与科学曲线、参数快照比较、CSV 导出、可操作任务。
- 独立“在线答题”页面：19 道原创题，综合/阶段/课程/错题筛选，单题作答、答题卡、返回补答、明确交卷、成绩、解析和错题重做。数值题有指定单位与绝对容差，空白/非法输入不算正确。
- 答卷草稿与成绩独立保存，刷新后可继续。学习进度兼容 Phase 1；预测、实验、交卷掌握状态共同决定课程完成。
- 六级目录、前置提示、Hash 页面地址与浏览器返回、浅深主题、响应式手机布局、键盘与屏幕阅读标签、错误边界。

仅 Level 1 第一节和 Level 2 五节课程已经实现；目录不会把 Level 3–6 标为完成。

## 模型、假设与基准

**所有飞机参数均是假设教学示例，不代表真实飞机或经过风洞标定的数据。** 内部力、速度、质量等用 SI；展示角用度，三角计算明确转为弧度。

Phase 1：CL = 0.2 + 0.08α（α 以度表示，−10° 至 15°）；15° 后连续指数下降仅为失速示意。CD = 0.025 + 0.055CL²。四力模型固定来流/迎角，二维增量 z 向上，不能当作自由飞行或 6DOF。三维矢量和位移缩放/限幅，读数保留计算值。姿态使用机体 x 前、y 右、z 下及 NED 世界，内禀 yaw-pitch-roll，渲染转换为四元数，俯仰限于 ±80°。

Phase 2：CD = CD0 + kCL²，默认 CD0=0.025、k=0.055、CLmax=1.4，m=1000 kg、S=16 m²、ρ=1.225 kg/m³、V=50 m/s。无风、固定密度、不可压缩、忽略系数与马赫数/雷诺数关系；推力假设与速度无关且沿航迹。

- 最佳升阻比：CL*=√(CD0/k)，Emax=1/(2√(CD0k))。显示 CLmax 内可实现的值；解析最佳速度超出实验范围会提示。
- 平飞：L=W，所需 CL=W/(qS)，Treq=D。可用推力与所需推力不相等时只报告剩余推力，不宣称匀速平飞。
- 爬升/滑翔：同时求解 L=Wcosγ 和 T−D−Wsinγ=0，阻力随该航迹所需 CL 重算。解析二次方程采用避免消去误差的低角度根；|γ|≤20°。滑翔 T=0，γ/垂直速度为负。超出范围、失速与数值失败分别标记，无适用解时不显示有效预测。
- 水平协调转弯：n=secφ，R=V²/(g|tanφ|)，有符号 ω=g tanφ/V；|φ|≤60°。φ=0 时 R/周期没有有限值，显示直线飞行。CLmax 检查与转弯失速速度 Vs√n 同步；尚无瞬态角动力学。

基准包括：默认 q=1531.25 Pa；Phase 1 L=14700 N，速度翻倍升力四倍；Phase 2 平飞所需推力约 828.393 N，Emax≈13.484，最小阻力平飞速度≈38.526 m/s，默认爬升率≈4.965 m/s；60° 转弯 n=2，失速速度乘 √2。详见 [验收记录](docs/validation.md)。

## 扩展结构

- `src/content/curriculum.ts` / `phase2.ts`：课程及原创推导、公开资料来源。
- `src/content/questions.ts`：统一题目 schema 与判题函数。
- `src/physics/models.ts` / `performance.ts`：独立纯计算及有效范围诊断。
- `src/physics/experiments.ts`：实验注册与请求/响应边界，供后续 Worker 扩展。
- `src/components/LessonPage.tsx`：共享七段教学结构。
- `src/components/PracticePage.tsx`：独立答卷流程，计分/筛选/持久化在 `src/storage/practice.ts`。
- `src/storage/progress.ts`：旧进度兼容和多课程存储。
- `tests/`：解析基准、答题和迁移测试；`scripts/browser-smoke.mjs`：真实生产版浏览器验收。

## 下一阶段与限制

Phase 3：重心、中性点、静稳定裕度、统一力矩符号和配平求解。随后为线性化/动态模态、PID 和一致坐标的 6DOF。

尚未实现 Level 1 其余完整课程、操纵面运动、真实跟随/仪表视角、动态三维航迹、高阶模态图表、账户/云数据库、实际 Worker 或 Python 数值服务。3D 用于基础姿态教学，性能实验使用明确坐标的二维工程示意。当前 JS 仍包含较大的三维/图表依赖，后续可按页面进一步分包。
