'use client';

export function ScrollHint() {
  return (
    <button
      type="button"
      className="h2-scroll-hint"
      aria-label="Posunout na další sekci"
      onClick={() => {
        const next = document.querySelector('[data-section="proc-ted"]');
        next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      <span className="h2-scroll-hint-line" aria-hidden="true" />
    </button>
  );
}
