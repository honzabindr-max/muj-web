import { EngineId } from "./types";

export type EngineTheme = {
  dot: string;
  panelBorder: string;
  panelGlow: string;
  topTint: string;
  progress: string;
  progressTrack: string;
  accentText: string;
  miniPill: string;
  sparkFill: string;
  ambientA: string;
  ambientB: string;
};

const themes: Record<EngineId, EngineTheme> = {
  seznam: {
    dot: "bg-red-500",
    panelBorder: "border-red-100/80",
    panelGlow: "shadow-[0_8px_30px_rgba(239,68,68,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
    topTint: "from-red-50/95 via-white/75 to-white/65",
    progress: "#ef4444",
    progressTrack: "#fee2e2",
    accentText: "text-red-600",
    miniPill: "border-red-100/80 bg-red-50/80 text-red-700",
    sparkFill: "rgba(239,68,68,0.10)",
    ambientA: "bg-red-200/16",
    ambientB: "bg-orange-200/12",
  },
  google: {
    dot: "bg-blue-500",
    panelBorder: "border-blue-100/80",
    panelGlow: "shadow-[0_8px_30px_rgba(59,130,246,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
    topTint: "from-blue-50/95 via-white/75 to-white/65",
    progress: "#0ea5e9",
    progressTrack: "#dbeafe",
    accentText: "text-blue-600",
    miniPill: "border-blue-100/80 bg-blue-50/80 text-blue-700",
    sparkFill: "rgba(14,165,233,0.10)",
    ambientA: "bg-blue-200/16",
    ambientB: "bg-cyan-200/12",
  },
};

export function getEngineTheme(engine: EngineId): EngineTheme {
  return themes[engine];
}
