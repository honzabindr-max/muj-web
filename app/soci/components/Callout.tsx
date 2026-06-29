interface CalloutProps {
  variant?: 'warning' | 'danger' | 'info' | 'tip';
  children: React.ReactNode;
  className?: string;
}

const ICONS: Record<string, string> = {
  warning: '⚠️',
  danger: '🔴',
  info: 'ℹ️',
  tip: '💡',
};

export function Callout({ variant = 'warning', children, className = '' }: CalloutProps) {
  return (
    <div className={`atlas-callout atlas-callout--${variant} ${className}`}>
      <span className="atlas-callout-icon">{ICONS[variant]}</span>
      <div>{children}</div>
    </div>
  );
}
