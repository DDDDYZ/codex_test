import { aerodynamics, bodyToNed, type Parameters } from "./models";
export type ExperimentId = "forces" | "lift" | "attitude";
export interface ExperimentPlugin {
  id: ExperimentId;
  title: string;
  dynamic: boolean;
  parameterKeys: (keyof Parameters)[];
  evaluate: (p: Parameters) => unknown;
}
/** Registry boundary for future experiments and a Worker request/response adapter. */
export const experiments: Record<ExperimentId, ExperimentPlugin> = {
  forces: {
    id: "forces",
    title: "四力平衡",
    dynamic: true,
    parameterKeys: ["speed", "alpha", "mass", "thrust"],
    evaluate: aerodynamics,
  },
  lift: {
    id: "lift",
    title: "迎角与升力",
    dynamic: false,
    parameterKeys: ["alpha", "speed", "density", "area"],
    evaluate: aerodynamics,
  },
  attitude: {
    id: "attitude",
    title: "三轴姿态",
    dynamic: false,
    parameterKeys: ["pitch", "roll", "yaw"],
    evaluate: (p) => bodyToNed(p.roll, p.pitch, p.yaw),
  },
};
export interface PhysicsRequest {
  requestId: number;
  experimentId: ExperimentId;
  parameters: Parameters;
}
export interface PhysicsResponse {
  requestId: number;
  result?: unknown;
  error?: string;
}
export function solveRequest(request: PhysicsRequest): PhysicsResponse {
  try {
    return {
      requestId: request.requestId,
      result: experiments[request.experimentId].evaluate(request.parameters),
    };
  } catch (e) {
    return { requestId: request.requestId, error: String(e) };
  }
}
