'use client';

import dynamic from 'next/dynamic';

const GuideMapClient = dynamic(() => import('./GuideMapClient'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400"
      style={{ height: '420px' }}
    >
      Načítám mapu…
    </div>
  ),
});

export function GuideMapDynamic() {
  return <GuideMapClient />;
}
