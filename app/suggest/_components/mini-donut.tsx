type Props = {
  pct: number | null;
  size?: number;
  stroke?: number;
  color?: string;
};

export function MiniDonut({ pct, size = 24, stroke = 3, color = "currentColor" }: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = pct !== null ? Math.max(0, Math.min(100, pct) / 100) * circ : 0;

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: "stroke-dasharray 700ms ease" }}
      />
    </svg>
  );
}
