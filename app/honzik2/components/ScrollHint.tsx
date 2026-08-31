'use client';

export function ScrollHint() {
  return (
    <button
      type="button"
      className="h2-scroll-hint"
      aria-label="Posunout na další sekci"
      onClick={() => {
        const next = document.querySelector('[data-section="osobni-uvod"]');
        next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      <span aria-hidden="true">↓ pojď dál</span>
    </button>
  );
}
