import type { ReactNode } from 'react';

export type CalloutVariant = 'red' | 'yellow' | 'green' | 'blue' | 'gray';

export function Callout({
  variant,
  icon,
  children,
}: {
  variant: CalloutVariant;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="z-callout" data-variant={variant}>
      <span className="z-callout-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="z-callout-body">{children}</div>
    </div>
  );
}
