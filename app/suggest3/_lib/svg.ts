// Tiny SVG path helpers for sparklines / area charts (no deps).

export function sparkPath(data: number[], w: number, h: number, pad = 2): string {
  if (!data || data.length < 2) return "";
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const span = mx - mn || 1;
  return data
    .map((v, i) => {
      const x = (i * w) / (data.length - 1);
      const y = h - pad - ((v - mn) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// Returns { line, area, lastX, lastY } in viewBox units for the growth chart.
export function lineAndArea(
  data: number[],
  w: number,
  h: number,
  pad = 6,
): { line: string; area: string; lastX: number; lastY: number } | null {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const span = mx - mn || 1;
  const sx = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
  const sy = (v: number) => h - 10 - ((v - mn) / span) * (h - 30);
  let line = "";
  data.forEach((v, i) => {
    line += `${i ? "L" : "M"}${sx(i).toFixed(1)} ${sy(v).toFixed(1)} `;
  });
  const area = `M${pad} ${h - 10} ${line.replace("M", "L")} L${w - pad} ${h - 10} Z`;
  return { line, area, lastX: sx(data.length - 1), lastY: sy(data[data.length - 1]) };
}
