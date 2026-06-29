import type { CSSProperties, ReactNode } from "react";

// Binding tokens from the hifi handoff README.
export const MONO = "'Geist Mono', ui-monospace, monospace";

export const GLASS: CSSProperties = {
  background: "rgba(255,255,255,.56)",
  backdropFilter: "blur(20px) saturate(1.5)",
  WebkitBackdropFilter: "blur(20px) saturate(1.5)",
  boxShadow: "0 8px 26px rgba(32,33,36,.09)",
  border: "1px solid rgba(255,255,255,.72)",
  borderRadius: 16,
};

export function GlassCard({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={{ ...GLASS, ...style }}>
      {children}
    </div>
  );
}

export const KPI_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#9aa09c",
};
