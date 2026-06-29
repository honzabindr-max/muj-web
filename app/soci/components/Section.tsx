interface SectionProps {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, kicker, children, className = '' }: SectionProps) {
  return (
    <section id={id} className={`atlas-section ${className}`}>
      <div className="atlas-section-head">
        {kicker && <div className="atlas-kicker" style={{ marginBottom: 6 }}>{kicker}</div>}
        <h2 className="atlas-h2">{title}</h2>
      </div>
      <div className="atlas-panel">
        <div className="atlas-panel-inner">
          {children}
        </div>
      </div>
    </section>
  );
}
