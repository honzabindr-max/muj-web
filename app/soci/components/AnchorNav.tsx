const LINKS = [
  { href: '#cesta', label: 'Cesta' },
  { href: '#mapa', label: 'Mapa' },
  { href: '#plan', label: 'Plán' },
  { href: '#rafting', label: 'Rafting' },
  { href: '#vylety', label: 'Výlety' },
  { href: '#ubytovani', label: 'Ubytování' },
  { href: '#rozpocet', label: 'Rozpočet' },
  { href: '#logistika', label: 'Logistika' },
  { href: '#checklist', label: 'Rezervace' },
  { href: '#vybava', label: 'Výbava' },
  { href: '#tipy', label: 'Tipy' },
  { href: '#kontakty', label: 'Kontakty' },
];

export function AnchorNav() {
  return (
    <nav className="atlas-nav" aria-label="Sekce průvodce">
      <div className="atlas-nav-inner">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="atlas-nav-link">
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
