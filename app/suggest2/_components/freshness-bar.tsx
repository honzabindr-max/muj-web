"use client";

export function FreshnessBar({
  dataTimestamp,
  countdown,
  marketCount,
  runningCount,
  doneCount,
  pendingCount,
  className = "",
}: {
  dataTimestamp: Date;
  countdown: number;
  marketCount: number;
  runningCount: number;
  doneCount: number;
  pendingCount: number;
  className?: string;
}) {
  const timeStr = dataTimestamp.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
        <span className="text-xs text-zinc-500">
          data k{" "}
          <span className="font-mono font-medium text-zinc-700">{timeStr}</span>
          {" · "}další obnovení za{" "}
          <span className="font-mono font-medium text-zinc-700">{countdown} s</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
        <span>{marketCount} trhů</span>
        {runningCount > 0 && (
          <span className="font-medium text-emerald-600">{runningCount} běží</span>
        )}
        {doneCount > 0 && (
          <span className="font-medium text-blue-600">{doneCount} hotovo</span>
        )}
        {pendingCount > 0 && <span>{pendingCount} ve frontě</span>}
      </div>
    </div>
  );
}
