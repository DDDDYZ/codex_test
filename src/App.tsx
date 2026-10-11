import { useEffect, useState, lazy, Suspense } from "react";
const Lab = lazy(() => import("./components/Lab"));
import Hero from "./components/Hero";
import LessonPage, { type StudyLesson } from "./components/LessonPage";
const PerformanceLab = lazy(() => import("./components/PerformanceLab"));
const PracticePage = lazy(() => import("./components/PracticePage"));
const StabilityLab = lazy(() => import("./components/StabilityLab"));
const DynamicsLab = lazy(() => import("./components/DynamicsLab"));
const ControlLab = lazy(() => import("./components/ControlLab"));
import { lesson, levels } from "./content/curriculum";
import { performanceLessons } from "./content/phase2";
import { stabilityLessons } from "./content/phase3";
import { dynamicsLessons } from "./content/phase4";
import { controlLessons } from "./content/phase5";
import { questionBank, type LearningLevel } from "./content/questions";
import { loadProgress, saveProgress } from "./storage/progress";
import "./course.css";
type Page = "home" | "path" | "lesson" | "practice";
interface Route {
  page: Page;
  lessonId: string;
  level?: LearningLevel;
  practiceLesson?: string;
  review: boolean;
}
function readRoute(): Route {
  const [path, query] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const id = path?.split("/")[2] || "first-flight";
  return {
    page: path?.startsWith("/lesson")
      ? "lesson"
      : path === "/path"
        ? "path"
        : path === "/practice"
          ? "practice"
          : "home",
    lessonId: id,
    level: [1, 2, 3, 4, 5, 6].includes(Number(params.get("level")))
      ? (Number(params.get("level")) as LearningLevel)
      : undefined,
    practiceLesson: params.get("lesson") || undefined,
    review: params.get("review") === "1",
  };
}
const foundation: StudyLesson = {
  id: "first-flight",
  title: lesson.title,
  objective:
    "学习目标：辨认四力，理解升力方程，区分迎角与姿态，用实验验证速度平方律。",
  observation:
    "在下方三个实验中观察四力箭头和姿态，先保持迎角不变，再改变速度，提出你的预测。",
  question: lesson.question,
  predictionOptions: ["2 倍", "4 倍", "保持不变"],
  predictionAnswer: 1,
  explanation: lesson.explanation,
  steps: lesson.steps,
  assumptions:
    "定常水平无侧滑条件下平飞满足 L=W、T=D。四力增量实验固定来流、二维 z 向上；姿态使用机体 x 前、y 右、z 下和 NED 世界轴。迎角与俯仰角不等同。所有参数均为假设教学示例。",
  variables:
    "ρ 密度 [kg/m³]；V 真空速 [m/s]；S 机翼面积 [m²]；CL 无量纲；L、W、T、D [N]；m [kg]；g=9.80665 m/s²。",
  summary:
    "升力方程连接来流、机翼和气动力；四力平衡决定加速度。速度平方律只在 CL、ρ、S 固定时成立，线性 CL 模型不能外推过失速。下一课用动压和阻力极线探索飞机的飞行性能。",
  references: lesson.references,
  task: {
    id: "experiment",
    prompt: "调节质量与推力，使四力实验两个方向的加速度绝对值都小于 0.1 m/s²。",
  },
};
const allLessons: (StudyLesson & {
  level: LearningLevel;
  experiment?: string;
})[] = [
  { ...foundation, level: 1 },
  ...performanceLessons.map((l) => ({ ...l, level: 2 as const })),
  ...stabilityLessons,
  ...dynamicsLessons,
  ...controlLessons,
];

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [progress, setProgress] = useState(loadProgress);
  const [stored, setStored] = useState(true);
  const [guided, setGuided] = useState(true);
  const [homeLab, setHomeLab] = useState<
    "basic" | "performance" | "stability" | "dynamics" | "control"
  >("basic");
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("fdl-theme") === "dark";
    } catch {
      return false;
    }
  });
  const current =
    allLessons.find((l) => l.id === route.lessonId) || allLessons[0];
  const isFoundation = current.id === "first-flight";
  const currentIndex = allLessons.findIndex((l) => l.id === current.id);
  const lessonQuestions = questionBank.filter((q) => q.lessonId === current.id);
  const completed = [
    ...new Set([
      ...(progress.completedLessons || []),
      ...(progress.completed ? ["first-flight"] : []),
    ]),
  ].filter((id) => allLessons.some((l) => l.id === id));
  const masteredQuestions = questionBank.filter(
    (q) => progress.answers[q.id] === true,
  ).length;
  const wrongQuestions = questionBank.filter(
    (q) => progress.answers[q.id] === false,
  ).length;
  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    setStored(saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("fdl-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  function navigate(path: string) {
    if (location.hash === `#${path}`) {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else location.hash = path;
  }
  function study(id = "first-flight") {
    navigate(`/lesson/${id}`);
  }
  function practice(level?: LearningLevel, id?: string, review = false) {
    const params = new URLSearchParams();
    if (level) params.set("level", String(level));
    if (id) params.set("lesson", id);
    if (review) params.set("review", "1");
    navigate(`/practice${params.size ? "?" + params : ""}`);
  }
  function task(id: string) {
    setProgress((p) => ({ ...p, answers: { ...p.answers, [id]: true } }));
  }
  function predict(correct: boolean) {
    setProgress((p) =>
      isFoundation
        ? { ...p, prediction: correct }
        : { ...p, predictions: { ...p.predictions, [current.id]: correct } },
    );
  }
  function complete() {
    setProgress((p) => ({
      ...p,
      completed: p.completed || isFoundation,
      completedLessons: [
        ...new Set([...(p.completedLessons || []), current.id]),
      ],
    }));
  }
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-icon">✈</span>
          <span>
            FLIGHT DYNAMICS <b>LAB</b>
            <small>交互式飞行力学实验室</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {(
            [
              ["home", "概览", "/"],
              ["path", "学习路径", "/path"],
              ["lesson", "课程与实验", `/lesson/${current.id}`],
              ["practice", "在线答题", "/practice"],
            ] as const
          ).map(([p, t, path]) => (
            <button
              key={p}
              className={route.page === p ? "active" : ""}
              onClick={() => navigate(path)}
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
          <button className="progress-pill" onClick={() => navigate("/path")}>
            <span className="live-dot" />
            学习进度 {completed.length} / {allLessons.length}
          </button>
        </div>
      </header>
      <main>
        <Suspense
          fallback={
            <section className="page-section" role="status">
              正在加载课程与实验…
            </section>
          }
        >
          {route.page === "home" && (
            <>
              <Hero
                onStart={() => study()}
                onExplore={() => {
                  setGuided(false);
                  document
                    .getElementById("explore-labs")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              />
              <section className="path-overview">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">YOUR LEARNING FLIGHT PLAN</div>
                    <h2>一条有方向的探索路径</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("/path")}
                  >
                    查看完整课程 →
                  </button>
                </div>
                <div className="level-grid">
                  {levels.map((l, i) => (
                    <button
                      className={`level-card ${l.available ? "available" : ""}`}
                      key={l.name}
                      onClick={() =>
                        l.available
                          ? study(
                              allLessons.find(
                                (course) => course.level === i + 1,
                              )?.id,
                            )
                          : navigate("/path")
                      }
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
              <section id="explore-labs">
                <div className="lab-switcher">
                  <button
                    className={homeLab === "basic" ? "selected" : ""}
                    onClick={() => setHomeLab("basic")}
                  >
                    Level 1 · 飞行原理
                  </button>
                  <button
                    className={homeLab === "performance" ? "selected" : ""}
                    onClick={() => setHomeLab("performance")}
                  >
                    Level 2 · 飞行性能
                  </button>
                  <button
                    className={homeLab === "stability" ? "selected" : ""}
                    onClick={() => setHomeLab("stability")}
                  >
                    Level 3 · 静稳定与配平
                  </button>
                  <button
                    className={homeLab === "dynamics" ? "selected" : ""}
                    onClick={() => setHomeLab("dynamics")}
                  >
                    Level 4–5 · 飞行动力学
                  </button>
                  <button
                    className={homeLab === "control" ? "selected" : ""}
                    onClick={() => setHomeLab("control")}
                  >
                    Level 6 · 控制与综合仿真
                  </button>
                </div>
                {homeLab === "basic" ? (
                  <Lab onTask={() => task("experiment")} />
                ) : homeLab === "performance" ? (
                  <PerformanceLab onTask={task} />
                ) : homeLab === "stability" ? (
                  <StabilityLab onTask={task} />
                ) : homeLab === "dynamics" ? (
                  <DynamicsLab onTask={task} />
                ) : (
                  <ControlLab onTask={task} />
                )}
              </section>
              <section className="next-banner">
                <div>
                  <div className="eyebrow">EXPLORE / PHASES 3–5</div>
                  <h2>从飞行性能，走向稳定与控制。</h2>
                  <p>静稳定与配平 · 模态响应 · PID、自动驾驶仪与六自由度仿真</p>
                </div>
                <button
                  className="primary"
                  onClick={() => study("static-stability")}
                >
                  进入高阶实验 →
                </button>
              </section>
            </>
          )}
          {route.page === "path" && (
            <section className="page-section">
              <div className="eyebrow">CURRICULUM / LEARNING PATH</div>
              <h1>从直觉，走向飞行控制。</h1>
              <p>
                知识依赖：飞行原理 → 气动与性能 → 静稳定与配平 → 运动方程 →
                动态模态 → 控制系统。Level 4
                起还需要微积分、线性代数与常微分方程。
              </p>
              <div className="progress-summary">
                <h3>本地学习档案</h3>
                <div className="path-metrics">
                  <p>
                    已完成课程{" "}
                    <strong>
                      {completed.length} / {allLessons.length}
                    </strong>
                  </p>
                  <p>
                    已掌握题目{" "}
                    <strong>
                      {masteredQuestions} / {questionBank.length}
                    </strong>
                  </p>
                  <p>
                    待复习错题 <strong>{wrongQuestions}</strong>
                  </p>
                </div>
                <progress max={allLessons.length} value={completed.length} />
                <button onClick={() => practice(undefined, undefined, true)}>
                  复习错题 →
                </button>
              </div>
              <h2>已开放课程</h2>
              <div className="path-lesson-list">
                {allLessons.map((l) => (
                  <button key={l.id} onClick={() => study(l.id)}>
                    <span className="eyebrow">
                      LEVEL 0{l.level} / LESSON{" "}
                      {String(
                        allLessons
                          .filter((course) => course.level === l.level)
                          .findIndex((course) => course.id === l.id) + 1,
                      ).padStart(2, "0")}
                    </span>
                    <strong>{l.title}</strong>
                    <small>{l.objective}</small>
                    <span
                      className={`badge ${completed.includes(l.id) ? "task-done" : ""}`}
                    >
                      {completed.includes(l.id)
                        ? "已完成 · 复习"
                        : "进入学习 →"}
                    </span>
                  </button>
                ))}
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
                    <button
                      disabled={!l.available}
                      onClick={() =>
                        study(
                          allLessons.find((course) => course.level === i + 1)
                            ?.id,
                        )
                      }
                    >
                      {l.available ? "进入开放课程" : "后续阶段开发"}
                    </button>
                  </article>
                ))}
              </div>
              <p className="model-note">
                六级学习路径均已开放核心课程。动力学使用明确标注的简化模态模型，六自由度使用假设气动参数；仍不是真实飞机校准模型，也尚未覆盖目录中的每一专题。
              </p>
            </section>
          )}
          {route.page === "lesson" && (
            <>
              <div className="lesson-selector" aria-label="切换课程">
                {allLessons.map((l) => (
                  <button
                    key={l.id}
                    className={current.id === l.id ? "selected" : ""}
                    onClick={() => study(l.id)}
                  >
                    {l.title}
                  </button>
                ))}
              </div>
              <LessonPage
                key={current.id}
                lesson={current}
                level={current.level}
                lessonNumber={
                  allLessons
                    .filter((l) => l.level === current.level)
                    .findIndex((l) => l.id === current.id) + 1
                }
                guided={guided}
                onMode={setGuided}
                predictionCorrect={
                  isFoundation
                    ? progress.prediction
                    : !!progress.predictions?.[current.id]
                }
                onPrediction={predict}
                taskDone={!!progress.answers[current.task.id]}
                quizMastered={
                  lessonQuestions.filter((q) => progress.answers[q.id] === true)
                    .length
                }
                quizTotal={lessonQuestions.length}
                completed={completed.includes(current.id)}
                onComplete={complete}
                onPractice={() => practice(current.level, current.id)}
                onNext={
                  currentIndex < allLessons.length - 1
                    ? () => study(allLessons[currentIndex + 1].id)
                    : undefined
                }
              >
                {isFoundation ? (
                  <Lab onTask={() => task("experiment")} />
                ) : current.level === 2 ? (
                  <PerformanceLab
                    key={current.id}
                    initialExperiment={
                      performanceLessons.find((l) => l.id === current.id)
                        ?.experiment
                    }
                    onTask={task}
                  />
                ) : current.level === 3 ? (
                  <StabilityLab
                    initialExperiment={current.experiment}
                    onTask={task}
                  />
                ) : current.level === 4 || current.level === 5 ? (
                  <DynamicsLab
                    initialExperiment={current.experiment}
                    onTask={task}
                  />
                ) : (
                  <ControlLab
                    initialExperiment={current.experiment}
                    onTask={task}
                  />
                )}
              </LessonPage>
            </>
          )}
          {route.page === "practice" && (
            <PracticePage
              key={`${route.level || "all"}-${route.practiceLesson || "all"}-${route.review}`}
              initialLevel={route.level}
              initialLessonId={route.practiceLesson}
              reviewOnly={route.review}
              mastery={progress.answers}
              onResults={(results) =>
                setProgress((p) => ({
                  ...p,
                  answers: { ...p.answers, ...results },
                }))
              }
              onStudy={(level, id) =>
                study(id || allLessons.find((l) => l.level === level)?.id)
              }
            />
          )}
        </Suspense>
      </main>
      {!stored && (
        <div role="status" className="storage-warning">
          浏览器存储不可用，当前学习进度仅在本次页面会话保留。
        </div>
      )}
      <footer>
        <div className="brand">✈ FLIGHT DYNAMICS LAB</div>
        <p>让物理可见，让理解发生。</p>
        <span>Phases 1–5 · 假设教学模型 / 非飞行训练或工程设计工具</span>
      </footer>
    </>
  );
}
