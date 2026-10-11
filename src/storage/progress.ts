export interface Progress {
  completed: boolean;
  answers: Record<string, boolean>;
  prediction: boolean;
}
export const emptyProgress: Progress = {
  completed: false,
  answers: {},
  prediction: false,
};
export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem("fdl-progress-v1") || "null");
    if (
      p &&
      typeof p.completed === "boolean" &&
      typeof p.prediction === "boolean" &&
      p.answers &&
      typeof p.answers === "object"
    )
      return {
        ...p,
        answers: Object.fromEntries(
          Object.entries(p.answers).filter(([, v]) => typeof v === "boolean"),
        ),
      };
  } catch {
    /* Unavailable or damaged storage: use session state. */
  }
  return { ...emptyProgress, answers: {} };
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem("fdl-progress-v1", JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
