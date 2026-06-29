import clsx from 'clsx';

interface CalloutProps {
  variant?: 'warning' | 'danger' | 'info' | 'tip';
  children: React.ReactNode;
  className?: string;
}

const STYLES = {
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const ICONS = {
  warning: '⚠️',
  danger: '🔴',
  info: 'ℹ️',
  tip: '💡',
};

export function Callout({ variant = 'warning', children, className }: CalloutProps) {
  return (
    <div
      className={clsx(
        'flex gap-2.5 rounded-lg border px-4 py-3 text-sm leading-relaxed',
        STYLES[variant],
        className,
      )}
    >
      <span className="mt-0.5 flex-shrink-0 text-base leading-none">{ICONS[variant]}</span>
      <div>{children}</div>
    </div>
  );
}
