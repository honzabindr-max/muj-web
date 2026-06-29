interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, children, className = '' }: SectionProps) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
