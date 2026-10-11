import type { LearningLevel } from "../content/questions";
import { useState, type ReactNode } from "react";
import { Formula } from "./Formula";
export interface StudyLesson {
  id: string;
  title: string;
  objective: string;
  observation: string;
  question: string;
  predictionOptions: string[];
  predictionAnswer: number;
  explanation: string;
  steps: { formula: string; law: string; previous: string; reason: string }[];
  assumptions: string;
  variables: string;
  summary: string;
  references: { name: string; url: string }[];
  task: { id: string; prompt: string };
}
interface Props {
  lesson: StudyLesson;
  level: LearningLevel;
  lessonNumber: number;
  guided: boolean;
  onMode: (guided: boolean) => void;
  predictionCorrect: boolean;
  onPrediction: (correct: boolean) => void;
  children: ReactNode;
  taskDone: boolean;
  quizMastered: number;
  quizTotal: number;
  completed: boolean;
  onComplete: () => void;
  onPractice: () => void;
  onNext?: () => void;
}
export default function LessonPage({
  lesson,
  level,
  lessonNumber,
  guided,
  onMode,
  predictionCorrect,
  onPrediction,
  children,
  taskDone,
  quizMastered,
  quizTotal,
  completed,
  onComplete,
  onPractice,
  onNext,
}: Props) {
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(
    predictionCorrect ? lesson.predictionAnswer : null,
  );
  const ready = taskDone && predictionCorrect && quizMastered === quizTotal;
  return (
    <>
      <section className="lesson-intro" data-lesson-id={lesson.id}>
        <div className="eyebrow">
          LEVEL 0{level} / LESSON 0{lessonNumber}
        </div>
        <h1>
          {lesson.title}
          <span className="badge">
            {
              [
                "飞行基础",
                "飞行性能",
                "静稳定与配平",
                "运动方程",
                "动态模态",
                "飞行控制",
              ][level - 1]
            }{" "}
            · 引导实验
          </span>
        </h1>
        <p>{lesson.objective}</p>
        {level > 1 && (
          <p className="prerequisite">
            推荐先学习 Level {level - 1} 的核心知识。
            {level >= 4
              ? "此阶段还需要微积分、线性代数和常微分方程基础。"
              : "学习顺序见学习路径；也可以自由探索参数。"}
          </p>
        )}
        <div className="mode-toggle">
          <button
            className={guided ? "selected" : ""}
            onClick={() => onMode(true)}
          >
            引导学习
          </button>
          <button
            className={!guided ? "selected" : ""}
            onClick={() => onMode(false)}
          >
            自由探索
          </button>
        </div>
      </section>
      {guided && (
        <section className="lesson-content">
          <article>
            <div className="eyebrow">01 / 现象观察 &nbsp; 02 / 先作预测</div>
            <h2>{lesson.question}</h2>
            <p>{lesson.observation}</p>
            <div className="prediction">
              {lesson.predictionOptions.map((option, i) => (
                <button
                  key={option}
                  className={prediction === i ? "selected" : ""}
                  onClick={() => {
                    setPrediction(i);
                    onPrediction(i === lesson.predictionAnswer);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            {prediction !== null && (
              <p
                role="status"
                className={
                  prediction === lesson.predictionAnswer ? "success" : "warning"
                }
              >
                {prediction === lesson.predictionAnswer
                  ? "✓ 预测正确，接下来用实验验证。"
                  : "再想一想，观察实验变化并阅读物理解释。"}
              </p>
            )}
          </article>
          <article>
            <div className="eyebrow">03 / 物理解释</div>
            <h2>从现象回到力学关系。</h2>
            <p>{lesson.explanation}</p>
            <div className="model-note">
              <strong>坐标、模型与适用条件</strong>
              <p>{lesson.assumptions}</p>
            </div>
          </article>
          <article className="derivation">
            <div className="eyebrow">04 / 逐步数学推导</div>
            <h2>每一步，都有物理依据。</h2>
            <div className="step-buttons">
              {lesson.steps.map((_, i) => (
                <button
                  key={i}
                  className={step === i ? "selected" : ""}
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
            <div className="small">变量与单位：{lesson.variables}</div>
            <button
              className="text-button"
              disabled={step === lesson.steps.length - 1}
              onClick={() => setStep((s) => s + 1)}
            >
              下一步 →
            </button>
          </article>
        </section>
      )}
      <div className="lesson-lab-label">
        <div className="eyebrow">05 / 交互验证</div>
        <span>参数即时更新 · 先观察，再解释</span>
      </div>
      {children}
      <section className="lesson-task">
        <div>
          <div className="eyebrow">实验操作任务</div>
          <h3>{lesson.task.prompt}</h3>
          <p>
            {taskDone
              ? "✓ 已记录操作任务完成"
              : "达到实验条件后，点击实验内的“记录任务完成”。"}
          </p>
        </div>
        <span className={`badge ${taskDone ? "task-done" : ""}`}>
          {taskDone ? "已完成" : "待实验"}
        </span>
      </section>
      <section className="practice-link">
        <div>
          <div className="eyebrow">06 / 独立在线答题</div>
          <h2>把理解，变成一次完整答卷。</h2>
          <p>
            本课已掌握 {quizMastered} / {quizTotal}{" "}
            题。答题卡、交卷评分和解析都在独立页面中。
          </p>
        </div>
        <button className="primary" onClick={onPractice}>
          进入本课答题 →
        </button>
      </section>
      <section className="lesson-summary">
        <div className="eyebrow">07 / 总结与下一节</div>
        <h2>{lesson.title}：连接你的观察与结论。</h2>
        <p>{lesson.summary}</p>
        <div className="lesson-completion">
          <button
            className="primary"
            disabled={!ready && !completed}
            onClick={onComplete}
          >
            {completed ? "✓ 本课已完成" : "完成本课"}
          </button>
          {onNext && <button onClick={onNext}>下一课 →</button>}
        </div>
        <small>
          完成条件：预测正确、实验操作完成、本课所有题目正确交卷。
          {!ready && !completed ? "继续实验或前往答题页即可推进。" : ""}
        </small>
        <h3>原创内容 · 参考资料</h3>
        {lesson.references.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
            {r.name} ↗
          </a>
        ))}
      </section>
    </>
  );
}
