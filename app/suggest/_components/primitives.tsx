"use client";

import { useAnimatedNumber } from "../_hooks/use-animated-number";
import { formatNumber } from "../_lib/utils";

export function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border border-white/70 bg-white/55 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] ${className}`}
    >
      {children}
    </div>
  );
}

export function AnimatedNumber({
  value,
  className = "",
  prefix = "",
  suffix = "",
}: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatNumber(animated)}
      {suffix}
    </span>
  );
}

export function DonutProgress({
  value,
  size = 82,
  stroke = 8,
  color,
  track,
  label,
  subtitle,
  pulse = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  label: string;
  subtitle: string;
  pulse?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${progress}%`}
    >
      {pulse && (
        <div
          className="absolute inset-0 animate-pulse rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: color }}
        />
      )}

      <svg width={size} height={size} className="relative -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 900ms ease" }} />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[0.9rem] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">{progress}%</div>
        <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
        <div className="mt-1 text-[10px] text-zinc-500">{subtitle}</div>
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  color,
  fill,
}: {
  values: number[];
  color: string;
  fill: string;
}) {
  const width = 280;
  const height = 72;
  const padding = 6;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[72px] w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Graf aktivity">
      <polygon points={area} fill={fill} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatMiniCard({
  label,
  value,
  hint,
  shimmer = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  shimmer?: boolean;
}) {
  return (
    <GlassCard
      className={`relative overflow-hidden rounded-2xl p-3.5 ${
        shimmer
          ? "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.8s_linear_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent"
          : ""
      }`}
    >
      <div className="relative text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="relative mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.4vw,1.6rem)] font-semibold leading-[1] tracking-tight text-zinc-950 tabular-nums">{value}</div>
      {hint && <div className="relative mt-1.5 text-sm text-zinc-500">{hint}</div>}
    </GlassCard>
  );
}

export function TopMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <GlassCard className="min-w-0 overflow-hidden rounded-3xl p-4">
      <div className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.35vw,1.9rem)] font-semibold leading-[1] tracking-tight text-zinc-950 tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-sm text-zinc-500">{hint}</div>}
    </GlassCard>
  );
}

export function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm tabular-nums text-right ${emphasize ? "font-semibold text-zinc-950" : "font-medium text-zinc-900"}`}>{value}</span>
    </div>
  );
}
