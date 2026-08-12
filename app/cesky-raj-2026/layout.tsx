import type { ReactNode } from 'react';
import './raj.css';

export default function CeskyRajLayout({ children }: { children: ReactNode }) {
  return (
    <div className="raj-root">
      <div className="raj-column">{children}</div>
    </div>
  );
}
