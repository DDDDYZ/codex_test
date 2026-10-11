import { useEffect, useState } from "react";
import Lab from "./components/Lab";
import { Formula } from "./components/Formula";
import { lesson, levels, quizzes } from "./content/curriculum";
import { loadProgress, saveProgress } from "./storage/progress";
export default function App() {
  const [page, setPage] = useState<"home" | "lesson" | "path">("home");
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("fdl-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [mode, setMode] = useState("guided");
  const [progress, setProgress] = useState(loadProgress);
  const [stored, setStored] = useState(true);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [calculation, setCalculation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [review, setReview] = useState(false);
  const passed = Object.values(progress.answers).filter(Boolean).length;
  const completedCount =
    passed + (progress.prediction ? 1 : 0) + (progress.completed ? 1 : 0);
  useEffect(() => {
    setStored(saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("fdl-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  function go(p: typeof page) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function answer(id: string, correct: boolean) {
    setProgress((p) => ({ ...p, answers: { ...p.answers, [id]: correct } }));
  }
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-icon">✈</span>
          <span>
            FLIGHT DYNAMICS <b>LAB</b>
            <small>交互式飞行力学实验室</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {[
            ["home", "概览"],
            ["path", "学习路径"],
            ["lesson", "课程与实验"],
          ].map(([p, t]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p as typeof page)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="theme-button"
            aria-label="切换明暗主题"
            onClick={() => setDark(!dark)}
          >
            {dark ? "☀" : "◐"}
          </button>
          <button className="progress-pill" onClick={() => go("path")}>
            <span className="live-dot" />
            学习进度 {progress.completed ? "1" : "0"} / 1
          </button>
        </div>
      </header>
      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" /> FROM INTUITION TO EQUATIONS
                </div>
                <h1>
                  飞行，不止于想象。
                  <br />
                  <span>
                    让每一个原理，
                    <br />
                    都可以亲手验证。
                  </span>
                </h1>
                <p>
                  从机翼上的第一份升力，到飞机的稳定与控制。
                  <br />
                  用交互实验连接物理直觉、数学模型与真实理解。
                </p>
                <div className="hero-buttons">
                  <button className="primary" onClick={() => go("lesson")}>
                    开始第一节课 <span>↗</span>
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setMode("free");
                      document
                        .getElementById("lab")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    自由探索实验室 →
                  </button>
                </div>
                <div className="hero-meta">
                  <span>
                    06 <small>学习阶段</small>
                  </span>
                  <span>
                    03 <small>开放实验</small>
                  </span>
                  <span>
                    SI <small>科学计算体系</small>
                  </span>
                </div>
              </div>
              <div className="hero-art">
                <div className="art-top">
                  FLIGHT STUDY / 001 <span>ENGINEERING MODEL</span>
                </div>
                <svg
                  viewBox="0 0 640 420"
                  role="img"
                  aria-label="机翼与四力示意图"
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="30"
                      height="30"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 30 0 L 0 0 0 30"
                        fill="none"
                        stroke="#d1dce4"
                        strokeWidth=".5"
                      />
                    </pattern>
                    <marker
                      id="head"
                      markerWidth="8"
                      markerHeight="8"
                      refX="4"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M0 0L8 4L0 8" fill="#3c889f" />
                    </marker>
                  </defs>
                  <rect width="640" height="420" fill="url(#grid)" />
                  <ellipse cx="324" cy="325" rx="172" ry="27" fill="#dbe4eb" />
                  <g transform="translate(315 225) rotate(-20)">
                    <path
                      d="M-18 115L-14-95Q0-150 16-95L18 115Z"
                      fill="#e9eff3"
                      stroke="#849ba9"
                      strokeWidth="2"
                    />
                    <path
                      d="M-12-35L-216 50L-215 77L-10 15L10 15L215 77L216 50L12-35"
                      fill="#b7ccd9"
                      stroke="#849ba9"
                      strokeWidth="2"
                    />
                    <path
                      d="M-15 78L-77 116L-76 130L0 108L76 130L77 116L15 78"
                      fill="#d9e4eb"
                      stroke="#849ba9"
                    />
                    <path d="M0 76L0 132L12 113L12 77" fill="#197f77" />
                    <ellipse cy="-66" rx="11" ry="26" fill="#365468" />
                  </g>
                  <g
                    fill="none"
                    stroke="#3c889f"
                    strokeWidth="2"
                    markerEnd="url(#head)"
                  >
                    <path d="M320 215V67" />
                    <path d="M318 242V366" />
                    <path d="M275 226L137 267" />
                    <path d="M350 208L474 174" />
                  </g>
                  <g fontFamily="sans-serif" fontSize="14" fill="#416377">
                    <text x="334" y="73">
                      LIFT / 升力
                    </text>
                    <text x="330" y="371">
                      WEIGHT / 重力
                    </text>
                    <text x="89" y="290">
                      DRAG / 阻力
                    </text>
                    <text x="470" y="161">
                      THRUST / 推力
                    </text>
                  </g>
                  <circle cx="319" cy="228" r="5" fill="#197f77" />
                </svg>
                <div className="art-bottom">
                  <span>01 / FOUR FORCES OF FLIGHT</span>
                  <span>
                    L = ½ρV²SC<sub>L</sub>
                  </span>
                </div>
              </div>
            </section>
            <div className="principle-strip">
              <span>观察现象</span>
              <i>→</i>
              <span>提出预测</span>
              <i>→</i>
              <span>建立模型</span>
              <i>→</i>
              <span>动手验证</span>
              <i>→</i>
              <span>形成理解</span>
            </div>
            <section className="path-overview">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">YOUR LEARNING FLIGHT PLAN</div>
                  <h2>一条有方向的探索路径</h2>
                </div>
                <button className="text-button" onClick={() => go("path")}>
                  查看完整课程 →
                </button>
              </div>
              <div className="level-grid">
                {levels.map((l, i) => (
                  <button
                    className={`level-card ${l.available ? "available" : ""}`}
                    key={l.name}
                    onClick={() => go(l.available ? "lesson" : "path")}
                  >
                    <div>
                      <span className="level-number">0{i + 1}</span>
                      <span className="badge">
                        {l.available ? "已开放" : "规划中"}
                      </span>
                    </div>
                    <h3>{l.name}</h3>
                    <p>{l.tag}</p>
                    <span className="card-arrow">
                      {l.available ? "进入课程 ↗" : "查看知识路线 →"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <Lab onTask={() => answer("experiment", true)} />
            <section className="next-banner">
              <div>
                <div className="eyebrow">LEARN BY DOING</div>
                <h2>先预测，再用实验找到答案。</h2>
                <p>第一课：飞机为什么能飞 · 约 20 分钟 · 无需前置知识</p>
              </div>
              <button className="primary" onClick={() => go("lesson")}>
                进入引导学习 →
              </button>
            </section>
          </>
        )}
        {page === "path" && (
          <section className="page-section">
            <div className="eyebrow">CURRICULUM / LEARNING PATH</div>
            <h1>从直觉，走向飞行控制。</h1>
            <p>
              前置依赖：Level 1 → 2 → 3 → 4 → 5 →
              6。高阶学习还需要微积分、线性代数与常微分方程。
            </p>
            <div className="progress-summary">
              <h3>本地学习档案</h3>
              <p>
                第一课任务：{completedCount} / 7 ·{" "}
                {progress.completed ? "已完成第一课" : "进行中"} · {passed}{" "}
                个已掌握任务
              </p>
              <progress max={7} value={completedCount} />
              <button
                onClick={() => {
                  setReview(true);
                  go("lesson");
                }}
              >
                复习错题 →
              </button>
            </div>
            <div className="course-list">
              {levels.map((l, i) => (
                <article key={l.name}>
                  <div className="level-number">0{i + 1}</div>
                  <div>
                    <h2>{l.name}</h2>
                    <p>{l.topics.join(" / ")}</p>
                    <small>
                      前置：
                      {i === 0
                        ? "无需基础"
                        : `Level ${i}${i >= 3 ? "，以及大学数学基础" : ""}`}
                    </small>
                  </div>
                  <button disabled={!l.available} onClick={() => go("lesson")}>
                    {l.available
                      ? progress.completed
                        ? "复习第一课"
                        : "开始第一课"
                      : "后续阶段开发"}
                  </button>
                </article>
              ))}
            </div>
            <p className="model-note">
              Phase 1
              仅开放第一节完整课程和三个实验。其余条目为课程规划，尚无已完成课程或实验。
            </p>
          </section>
        )}
        {page === "lesson" && (
          <>
            <section className="lesson-intro">
              <div className="eyebrow">LEVEL 01 / LESSON 01</div>
              <h1>
                {lesson.title}
                <span className="badge">入门 · 20 分钟</span>
              </h1>
              <p>
                学习目标：辨认四力，理解升力方程，区分迎角与姿态，用实验验证速度平方律。
              </p>
              <div className="mode-toggle">
                <button
                  className={mode === "guided" ? "selected" : ""}
                  onClick={() => setMode("guided")}
                >
                  引导学习
                </button>
                <button
                  className={mode === "free" ? "selected" : ""}
                  onClick={() => setMode("free")}
                >
                  自由探索
                </button>
              </div>
            </section>
            {mode === "guided" && (
              <section className="lesson-content">
                <article>
                  <div className="eyebrow">
                    01 / 现象观察 &nbsp; 02 / 引导提问
                  </div>
                  <h2>速度加倍，升力也加倍吗？</h2>
                  <p>
                    先在下方实验中观察四力箭头，再作预测。你可以暂时保持迎角不变。
                  </p>
                  <p>{lesson.question}</p>
                  <div className="prediction">
                    {["2 倍", "4 倍", "保持不变"].map((t, i) => (
                      <button
                        key={t}
                        className={prediction === i ? "selected" : ""}
                        onClick={() => {
                          setPrediction(i);
                          setProgress((p) => ({ ...p, prediction: i === 1 }));
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {prediction !== null && (
                    <p className={prediction === 1 ? "success" : "warning"}>
                      {prediction === 1 ? "正确！" : "再想一想："}
                      速度平方是关键。V 翻倍时 V² 变成四倍；请在迎角实验中验证。
                    </p>
                  )}
                </article>
                <article>
                  <div className="eyebrow">03 / 物理解释</div>
                  <h2>升力来自机翼与气流的相互作用。</h2>
                  <p>{lesson.explanation}</p>
                  <p>
                    升力按风轴定义，俯仰角是机体相对地平的角度，迎角是机体参考轴与来流的夹角。两者在一般运动中不相等。
                  </p>
                </article>
                <article className="derivation">
                  <div className="eyebrow">04 / 数学推导</div>
                  <h2>从动压出发，一步步推导。</h2>
                  <div className="step-buttons">
                    {lesson.steps.map((_, i) => (
                      <button
                        className={step === i ? "selected" : ""}
                        key={i}
                        onClick={() => setStep(i)}
                      >
                        0{i + 1}
                      </button>
                    ))}
                  </div>
                  <small>上一步：{lesson.steps[step].previous}</small>
                  <Formula value={lesson.steps[step].formula} />
                  <h3>{lesson.steps[step].law}</h3>
                  <p>{lesson.steps[step].reason}</p>
                  <button
                    className="text-button"
                    disabled={step === 3}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    下一步 →
                  </button>
                </article>
              </section>
            )}
            <Lab onTask={() => answer("experiment", true)} />
            <section className="exercises">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">06 / CHECK YOUR UNDERSTANDING</div>
                  <h2>
                    {review ? "错题复习" : "用你的理解，完成一次小测试。"}
                  </h2>
                </div>
                <button onClick={() => setReview(!review)}>
                  {review ? "显示全部" : "只看错题"}
                </button>
              </div>
              <div className="quiz-grid">
                {quizzes
                  .filter((q) => !review || progress.answers[q.id] === false)
                  .map((q, i) => (
                    <article className="quiz" key={q.id}>
                      <span className="badge">{q.type}题</span>
                      <h3>
                        {i + 1}. {q.prompt}
                      </h3>
                      {q.options.map((option, j) => (
                        <button
                          key={option}
                          className={choices[q.id] === j ? "selected" : ""}
                          onClick={() => {
                            setChoices((c) => ({ ...c, [q.id]: j }));
                            answer(q.id, j === q.answer);
                          }}
                        >
                          {String.fromCharCode(65 + j)}. {option}
                        </button>
                      ))}
                      {choices[q.id] !== undefined && (
                        <p
                          className={
                            choices[q.id] === q.answer ? "success" : "warning"
                          }
                        >
                          {choices[q.id] === q.answer ? "✓ 正确" : "请再尝试"} ·{" "}
                          {q.explain}
                        </p>
                      )}
                    </article>
                  ))}
                {review &&
                  !quizzes.some((q) => progress.answers[q.id] === false) &&
                  progress.answers.calculation !== false && (
                    <p>目前没有需要复习的错题。</p>
                  )}
                {(!review || progress.answers.calculation === false) && (
                  <article className="quiz">
                    <span className="badge">计算题</span>
                    <h3>
                      ρ = 1.225 kg/m³，V = 50 m/s，S = 16 m²，CL =
                      0.6。升力是多少 N？
                    </h3>
                    <label>
                      升力 L [N]
                      <input
                        type="number"
                        value={calculation}
                        onChange={(e) => setCalculation(e.target.value)}
                      />
                    </label>
                    <button
                      onClick={() => {
                        const correct =
                          calculation.trim() !== "" &&
                          Math.abs(Number(calculation) - 14700) <= 1;
                        answer("calculation", correct);
                        setFeedback(
                          correct
                            ? "✓ 正确：L = ½ × 1.225 × 50² × 16 × 0.6 = 14700 N。"
                            : "未通过，请代入升力公式；答案容差 ±1 N。",
                        );
                      }}
                    >
                      检查答案
                    </button>
                    <p role="status">{feedback}</p>
                  </article>
                )}
                {!review && (
                  <article className="quiz">
                    <span className="badge">实验操作题</span>
                    <h3>找到四力近似平衡。</h3>
                    <p>
                      在四力实验中调节质量与推力，使两个方向的加速度绝对值均小于
                      0.1 m/s²。达到条件后点击“记录实验任务完成”。
                    </p>
                    <p className={progress.answers.experiment ? "success" : ""}>
                      {progress.answers.experiment
                        ? "✓ 实验任务已完成"
                        : "提示：保持默认速度与迎角，质量接近 1500 kg，推力接近 1100 N。"}
                    </p>
                    <a href="#lab">返回实验 ↑</a>
                  </article>
                )}
              </div>
            </section>
            <section className="lesson-summary">
              <div className="eyebrow">07 / 总结与下一步</div>
              <h2>飞行的第一步，是理解力的平衡。</h2>
              <p>
                本课连接了气流、升力和牛顿第二定律。你已认识速度平方律、失速模型的限制，以及俯仰、滚转和偏航。下一阶段将用这些工具探索升阻比和飞行性能。
              </p>
              <button
                className="primary"
                disabled={passed < 5 || !progress.prediction}
                onClick={() => setProgress((p) => ({ ...p, completed: true }))}
              >
                {progress.completed ? "✓ 第一课已完成" : "完成第一课"}
              </button>
              <small>需完成预测、3 道概念题、计算题和实验任务。</small>
              <h3>原创内容 · 参考学习资料</h3>
              {lesson.references.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
                  {r.name} ↗
                </a>
              ))}
              <p className="small">
                知识体系参考 Anderson《Introduction to
                Flight》的飞行基础主题；后续稳定性课程规划参考 Etkin &
                Reid、Nelson、Cook 及 Stevens
                等教材。未复制教材正文、插图或习题。
              </p>
            </section>
          </>
        )}
      </main>
      {!stored && (
        <div role="status" className="storage-warning">
          浏览器存储不可用，当前进度仅在本次页面会话保留。
        </div>
      )}
      <footer>
        <div className="brand">✈ FLIGHT DYNAMICS LAB</div>
        <p>让物理可见，让理解发生。</p>
        <span>Phase 1 · 教学模型 / 非飞行训练或工程设计工具</span>
      </footer>
    </>
  );
}
