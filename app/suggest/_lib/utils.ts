// formatNumber is imported by primitives.tsx — keep signature stable
export function formatNumber(value: number): string {
  return value.toLocaleString("cs-CZ");
}

export function flagEmoji(gl: string): string {
  return Array.from(gl.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}
