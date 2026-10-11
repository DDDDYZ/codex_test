import { useEffect, useRef, useState } from "react";
import { questionBank, type LearningLevel, type Question } from "../content/questions";
import {
  isAnswered, loadPracticeState, newPracticeAttempt, retryWrongAttempt,
  savePracticeState, scorePracticeAttempt, selectPracticeQuestions,
  type PracticeAttempt, type PracticeMode, type PracticeSelection,
} from "../storage/practice";
import "../practice.css";

export interface PracticePageProps {
  initialLevel?: LearningLevel;
  initialLessonId?: string;
  reviewOnly?: boolean;
  mastery: Record<string, boolean>;
  onResults: (results: Record<string, boolean>) => void;
  onStudy: (level: LearningLevel, lessonId?: string) => void;
}
const lessonNames: Record<string, string> = {
  "first-flight": "飞机为什么能飞",
  "dynamic-pressure": "动压与气动力",
  polar: "阻力极曲线与升阻比",
  "level-flight": "平飞与性能边界",
  "climb-glide": "爬升与滑翔",
  turn: "转弯与载荷因数",
 "static-stability":"静稳定性与重心",trim:"纵向配平",
 "coordinates-linearization":"坐标系与线性化", "longitudinal-modes":"纵向动态模态", "lateral-modes":"横航向动态模态", "pid-control":"PID 与扰动抑制", "six-dof":"六自由度综合仿真",
};
const modeNames: Record<PracticeMode, string> = {
  all: "综合练习", level: "按阶段", lesson: "按课程", wrong: "错题重练",
};
function firstLesson(level:LearningLevel){return questionBank.find(q=>q.level===level)?.lessonId || "first-flight";}
function lessonName(id: string) { return lessonNames[id] ?? id; }
function formattedAnswer(q: Question, value: string | undefined): string {
  if (value === undefined || !value.trim()) return "未作答";
  if (!isAnswered(q, value)) return `无效输入：${value}`;
  return q.kind === "choice" ? `${String.fromCharCode(65 + Number(value))} · ${q.options[Number(value)]}` : `${value} ${q.unit}`.trim();
}
function correctAnswer(q: Question): string {
  return q.kind === "choice" ? `${String.fromCharCode(65 + q.answer)} · ${q.options[q.answer]}` : `${q.answer} ${q.unit}`.trim();
}

export default function PracticePage({ initialLevel, initialLessonId, reviewOnly, mastery, onResults, onStudy }: PracticePageProps) {
  const [restored] = useState(loadPracticeState);
  const [selection, setSelection] = useState<PracticeSelection>(() => {
    const level = initialLevel ?? restored?.selection.level ?? 1;
    if (reviewOnly || initialLessonId || initialLevel) return {
      mode: reviewOnly ? "wrong" : initialLessonId ? "lesson" : "level",
      level,
      lessonId: initialLessonId ?? firstLesson(level),
    };
    return restored?.selection ?? { mode: "all", level: 1, lessonId: "first-flight" };
  });
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(restored?.attempt ?? null);
  const [screen, setScreen] = useState<"select" | "attempt">("select");
  const [stored, setStored] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const selectedQuestions = selectPracticeQuestions(selection, mastery);
  const lessons = [...new Set(questionBank.filter((q) => q.level === selection.level).map((q) => q.lessonId))];
  const wrongCount = questionBank.filter((q) => mastery[q.id] === false).length;
  const questions = attempt?.questionIds.flatMap((id) => {
    const q = questionBank.find((item) => item.id === id);
    return q ? [q] : [];
  }) ?? [];
  const score = attempt ? scorePracticeAttempt(attempt) : null;
  const submitted = attempt?.submittedAt !== undefined;
  const currentQuestion = questions[attempt?.cursor ?? 0];
  useEffect(() => {
    setStored(savePracticeState({ version: 1, selection, attempt }));
  }, [selection, attempt]);
  useEffect(() => {
    if (screen === "attempt" && !submitted) questionHeading.current?.focus({ preventScroll: true });
  }, [screen, attempt?.cursor, submitted]);

  function updateSelection(next: PracticeSelection) {
    setSelection(next);
    setConfirmReplace(false);
  }
  function start(replace = false) {
    if (!selectedQuestions.length) return;
    if (!replace && attempt && !submitted && Object.keys(attempt.answers).length > 0) {
      setConfirmReplace(true);
      return;
    }
    setAttempt(newPracticeAttempt(selectedQuestions.map((q) => q.id)));
    setConfirmReplace(false);
    setConfirmSubmit(false);
    setScreen("attempt");
  }
  function setAnswer(value: string) {
    if (!attempt || !currentQuestion || submitted) return;
    setAttempt({ ...attempt, answers: { ...attempt.answers, [currentQuestion.id]: value } });
    setConfirmSubmit(false);
  }
  function jump(cursor: number) {
    if (!attempt) return;
    setAttempt({ ...attempt, cursor });
    setConfirmSubmit(false);
  }
  function submit(confirmed = false) {
    if (!attempt || !score || submitted) return;
    if (score.answered < score.total && !confirmed) {
      setConfirmSubmit(true);
      return;
    }
    const completed = { ...attempt, submittedAt: Math.max(Date.now(), attempt.startedAt) };
    setAttempt(completed);
    setConfirmSubmit(false);
    onResults(scorePracticeAttempt(completed).results);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function chooseSet() {
    setScreen("select");
    setConfirmSubmit(false);
    setConfirmReplace(false);
  }
  return (
    <section className="practice-page page-section" aria-label="在线答题">
      <header className="practice-heading">
        <div>
          <div className="eyebrow">FLIGHT KNOWLEDGE CHECK</div>
          <h1>在线答题</h1>
          <p>让理解接受一次检验。先独立作答，交卷后查看成绩与解析。</p>
        </div>
        {screen === "attempt" && <button onClick={chooseSet}>返回题库</button>}
      </header>
      {!stored && <p className="storage-warning" role="status">浏览器无法保存答题记录。当前页面仍可使用，刷新或关闭后记录可能丢失。</p>}

      {screen === "select" && (
        <div className="practice-select-layout">
          <div className="practice-panel practice-selector">
            <h2>选择练习范围</h2>
            <p className="practice-muted">每题等权计分，没有限时。作答中可以跳题和修改答案。</p>
            <fieldset className="practice-modes">
              <legend>练习方式</legend>
              {(Object.entries(modeNames) as [PracticeMode, string][]).map(([mode, title]) => (
                <label className={selection.mode === mode ? "chosen" : ""} key={mode}>
                  <input type="radio" name="practice-mode" checked={selection.mode === mode} onChange={() => updateSelection({ ...selection, mode })} />
                  <span>{title}{mode === "wrong" ? `（${wrongCount}）` : ""}</span>
                </label>
              ))}
            </fieldset>
            {(selection.mode === "level" || selection.mode === "lesson") && (
              <div className="practice-filters">
                <label htmlFor="practice-level">学习阶段
                  <select id="practice-level" value={selection.level} onChange={(event) => {
                    const level = Number(event.target.value) as LearningLevel;
                    updateSelection({ ...selection, level, lessonId: firstLesson(level) });
                  }}>
                    {[...new Set(questionBank.map(q=>q.level))].map(level=><option key={level} value={level}>Level {level} · {["飞行原理","飞行性能","静稳定与配平","运动方程","动态模态","飞行控制"][level-1]}</option>)}
                  </select>
                </label>
                {selection.mode === "lesson" && <label htmlFor="practice-lesson">课程
                  <select id="practice-lesson" value={selection.lessonId} onChange={(event) => updateSelection({ ...selection, lessonId: event.target.value })}>
                    {lessons.map((id) => <option value={id} key={id}>{lessonName(id)}</option>)}
                  </select>
                </label>}
              </div>
            )}
            <div className="practice-set-summary">
              <span>本次练习</span><strong>{selectedQuestions.length}<small>道题</small></strong>
              <span>概念选择 + 数值计算</span>
            </div>
            {!selectedQuestions.length && <p role="status" className="practice-empty">{selection.mode === "wrong" ? "目前没有错题。先完成一次练习，错题会出现在这里。" : "该范围暂无题目，请选择其他范围。"}</p>}
            <button className="primary" disabled={!selectedQuestions.length} onClick={() => start()}>开始答题 →</button>
            {confirmReplace && <div className="practice-confirm" role="alert">
              <p>你还有一份未提交的答卷。开始新练习会替换这份草稿。</p>
              <div className="practice-actions"><button onClick={() => setConfirmReplace(false)}>保留草稿</button><button className="primary" onClick={() => start(true)}>开始新练习</button></div>
            </div>}
          </div>
          <aside className="practice-sidebar">
            {attempt && score && <div className="practice-panel practice-resume">
              <span className="eyebrow">{submitted ? "LAST RESULT" : "SAVED DRAFT"}</span>
              <h2>{submitted ? "上次练习结果" : "继续上次练习"}</h2>
              <p>{submitted ? `答对 ${score.correct} / ${score.total} 题，得分 ${score.percentage} 分。` : `已作答 ${score.answered} / ${score.total} 题，草稿已保留。`}</p>
              <button onClick={() => { setScreen("attempt"); setConfirmReplace(false); }}>{submitted ? "查看成绩与解析" : "继续作答 →"}</button>
            </div>}
            <div className="practice-panel practice-how">
              <h2>练习说明</h2>
              <ol><li>选择题选一项，计算题填写指定单位的数值。</li><li>答题卡可随时跳题，交卷前可以修改。</li><li>交卷后统一评分，未答或无效输入计为错误。</li><li>答案草稿、上次成绩与错题保存在当前浏览器。</li></ol>
              <button className="text-button" onClick={() => onStudy(selection.level, selection.mode === "lesson" ? selection.lessonId : undefined)}>回到课程学习 →</button>
            </div>
          </aside>
        </div>
      )}

      {screen === "attempt" && attempt && score && !submitted && currentQuestion && (
        <div className="practice-workspace">
          <div className="practice-main-column">
            <article className="practice-panel practice-question">
              <div className="practice-question-meta"><span>第 {attempt.cursor + 1} / {questions.length} 题</span><span>Level {currentQuestion.level} · {lessonName(currentQuestion.lessonId)}</span><span className="badge">{currentQuestion.kind === "choice" ? "单项选择" : "数值计算"}</span></div>
              <h2 id="practice-question-title" ref={questionHeading} tabIndex={-1}>{currentQuestion.title}</h2>
              {currentQuestion.kind === "choice" ? <fieldset className="practice-options" aria-labelledby="practice-question-title">
                <legend className="practice-sr-only">选择一个答案</legend>
                {currentQuestion.options.map((option, index) => <label className={attempt.answers[currentQuestion.id] === String(index) ? "chosen" : ""} key={index}>
                  <input type="radio" name={currentQuestion.id} value={index} checked={attempt.answers[currentQuestion.id] === String(index)} onChange={() => setAnswer(String(index))} />
                  <span className="practice-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>
                </label>)}
              </fieldset> : <div className="practice-numeric">
                <label htmlFor={`answer-${currentQuestion.id}`}>你的答案{currentQuestion.unit ? `（${currentQuestion.unit}）` : "（无量纲）"}</label>
                <div><input id={`answer-${currentQuestion.id}`} type="text" inputMode="decimal" autoComplete="off" value={attempt.answers[currentQuestion.id] ?? ""} onChange={(event) => setAnswer(event.target.value.slice(0, 100))} aria-describedby="practice-number-help" aria-invalid={Boolean(attempt.answers[currentQuestion.id]?.trim()) && !isAnswered(currentQuestion, attempt.answers[currentQuestion.id])} /><span>{currentQuestion.unit}</span></div>
                <p id="practice-number-help">填写有限数值，不填写单位或算式。支持负数和小数。</p>
                {Boolean(attempt.answers[currentQuestion.id]?.trim()) && !isAnswered(currentQuestion, attempt.answers[currentQuestion.id]) && <p className="practice-invalid" role="status">输入不是有效数值，请检查格式。</p>}
              </div>}
              <div className="practice-question-bottom"><span>{isAnswered(currentQuestion, attempt.answers[currentQuestion.id]) ? "已作答 · 交卷前可修改" : "未作答"}</span><button className="text-button" disabled={!attempt.answers[currentQuestion.id]} onClick={() => setAnswer("")}>清除本题答案</button></div>
            </article>
            <div className="practice-actions practice-next"><button disabled={attempt.cursor === 0} onClick={() => jump(attempt.cursor - 1)}>← 上一题</button>{attempt.cursor < questions.length - 1 ? <button className="primary" onClick={() => jump(attempt.cursor + 1)}>下一题 →</button> : <button className="primary" onClick={() => submit()}>提交答卷</button>}</div>
            {confirmSubmit && <div className="practice-confirm" role="alert"><p>还有 {score.total - score.answered} 道题未作答或输入无效。继续交卷时，这些题计为错误。</p><div className="practice-actions"><button onClick={() => { setConfirmSubmit(false); const index = questions.findIndex((q) => !isAnswered(q, attempt.answers[q.id])); if (index >= 0) jump(index); }}>返回补答</button><button className="primary" onClick={() => submit(true)}>确认交卷</button></div></div>}
          </div>
          <aside className="practice-panel practice-answer-card" aria-label="答题卡">
            <div className="practice-card-title"><h2>答题卡</h2><span>{score.answered} / {score.total}</span></div>
            <progress max={score.total} value={score.answered} aria-label="已作答题数" />
            <div className="practice-card-grid">{questions.map((q, index) => {
              const answered = isAnswered(q, attempt.answers[q.id]);
              return <button key={q.id} onClick={() => jump(index)} className={`${answered ? "answered" : ""} ${attempt.cursor === index ? "current" : ""}`} aria-current={attempt.cursor === index ? "step" : undefined} aria-label={`第 ${index + 1} 题，${answered ? "已作答" : "未作答"}`}>{index + 1}</button>;
            })}</div>
            <div className="practice-card-legend"><span><i className="answered" />已作答</span><span><i />未作答</span><span><i className="current" />当前题</span></div>
            <p>答案会自动保存。提交前不会显示对错或解析。</p>
            <button className="primary" onClick={() => submit()}>提交答卷</button>
          </aside>
        </div>
      )}

      {screen === "attempt" && attempt && score && submitted && (
        <div className="practice-results">
          <section className="practice-panel practice-score" aria-label="练习成绩">
            <div className="practice-score-value"><strong>{score.percentage}</strong><span>分 / 100</span></div>
            <div><div className="eyebrow">PRACTICE COMPLETE</div><h2>{score.correct === score.total ? "全部答对，继续探索" : "练习完成，看看哪些还需要巩固"}</h2><p>每题等权计分。未作答和无效输入计为错误。</p><div className="practice-result-stats"><span>已作答 <strong>{score.answered} / {score.total}</strong></span><span>正确 <strong>{score.correct}</strong></span><span>错误 <strong>{score.wrongIds.length}</strong></span><span>未答 / 无效 <strong>{score.total - score.answered}</strong></span></div></div>
          </section>
          <div className="practice-actions practice-result-actions"><button className="primary" disabled={!score.wrongIds.length} onClick={() => { setAttempt(retryWrongAttempt(attempt)); setConfirmSubmit(false); }}>重练本次错题（{score.wrongIds.length}）</button><button onClick={chooseSet}>选择新的练习</button></div>
          <div className="section-heading"><h2>答题解析</h2><span className="practice-muted">共 {score.total} 道题</span></div>
          <div className="practice-review-list">{questions.map((q, index) => <article className={`practice-panel practice-review ${score.results[q.id] ? "correct" : "incorrect"}`} key={q.id}>
            <div className="practice-question-meta"><span>第 {index + 1} 题 · {q.kind === "choice" ? "单项选择" : "数值计算"}</span><strong className="practice-result-badge">{score.results[q.id] ? "答对" : "答错"}</strong></div>
            <h3>{q.title}</h3><dl><div><dt>你的答案</dt><dd>{formattedAnswer(q, attempt.answers[q.id])}</dd></div><div><dt>参考答案</dt><dd>{correctAnswer(q)}{q.kind === "numeric" && <small>（绝对容差 ±{q.tolerance}{q.unit ? ` ${q.unit}` : ""}）</small>}</dd></div></dl>
            <div className="practice-explanation"><strong>解析</strong><p>{q.explanation}</p></div><button className="text-button" onClick={() => onStudy(q.level, q.lessonId)}>学习：{lessonName(q.lessonId)} →</button>
          </article>)}</div>
        </div>
      )}
    </section>
  );
}
