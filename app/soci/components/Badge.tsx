import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'info' | 'success';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-slate-100 text-slate-700': variant === 'default',
          'bg-amber-100 text-amber-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'danger',
          'bg-sky-100 text-sky-800': variant === 'info',
          'bg-emerald-100 text-emerald-800': variant === 'success',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
