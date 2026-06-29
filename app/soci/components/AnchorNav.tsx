const LINKS = [
  { href: '#cesta', label: 'Cesta' },
  { href: '#mapa', label: 'Mapa' },
  { href: '#plan', label: 'Plán 7 dní' },
  { href: '#rafting', label: 'Rafting' },
  { href: '#vylety', label: 'Výlety' },
  { href: '#ubytovani', label: 'Ubytování' },
  { href: '#rozpocet', label: 'Rozpočet' },
  { href: '#checklist', label: 'Rezervace' },
  { href: '#vybava', label: 'Výbava' },
  { href: '#kontakty', label: 'Kontakty' },
];

export function AnchorNav() {
  return (
    <nav className="sticky top-0 z-30 -mx-4 overflow-x-auto bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex gap-1 text-sm">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex-shrink-0 rounded-md px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
