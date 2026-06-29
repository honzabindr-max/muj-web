interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'info' | 'success';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const cls =
    variant === 'warning' ? 'atlas-pill atlas-pill--amber' :
    variant === 'danger' ? 'atlas-pill atlas-pill--amber' :
    variant === 'success' ? 'atlas-pill atlas-pill--emerald' :
    variant === 'info' ? 'atlas-pill atlas-pill--emerald' :
    'atlas-pill';
  return <span className={`${cls} ${className}`}>{children}</span>;
}
