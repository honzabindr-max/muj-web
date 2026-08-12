'use client';

import { useEffect, useState } from 'react';

export function StickyHeader({ title, dates }: { title: string; dates: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById('masthead');
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="raj-sticky-header" data-visible={visible}>
      {title} · {dates}
    </div>
  );
}
