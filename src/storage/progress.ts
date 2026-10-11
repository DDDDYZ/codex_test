export interface Progress {
  completed: boolean;
  answers: Record<string, boolean>;
  prediction: boolean;
  completedLessons?: string[];
  predictions?: Record<string, boolean>;
}
export const emptyProgress: Progress = {
  completed: false,
  answers: {},
  prediction: false,
};
function booleanRecord(value: unknown): Record<string, boolean> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(([, v]) => typeof v === "boolean"),
      )
    : {};
}
export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem("fdl-progress-v1") || "null");
    if (
      p &&
      typeof p.completed === "boolean" &&
      typeof p.prediction === "boolean" &&
      p.answers &&
      typeof p.answers === "object"
    ) {
      const result: Progress = {
        completed: p.completed,
        prediction: p.prediction,
        answers: booleanRecord(p.answers),
      };
      if (Array.isArray(p.completedLessons))
        result.completedLessons = [
          ...new Set(
            p.completedLessons.filter((id: unknown) => typeof id === "string"),
          ),
        ] as string[];
      if (p.predictions) result.predictions = booleanRecord(p.predictions);
      return result;
    }
  } catch {}
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
