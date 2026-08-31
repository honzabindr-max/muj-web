'use client';

import { useState, type ReactNode } from 'react';
import { AreaMap } from './AreaMap';
import { ArchitectureFlow } from './ArchitectureFlow';

type ItemId = 'mapa' | 'living-os' | 'priorita';

function AccordionItem({
  id,
  num,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: ItemId;
  num: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="h2-accordion-item">
      <button
        type="button"
        className="h2-accordion-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`h2-accordion-panel-${id}`}
      >
        <span className="h2-accordion-num">{num}</span>
        <span className="h2-accordion-title">{title}</span>
        <span className="h2-accordion-icon" data-open={isOpen} aria-hidden="true" />
      </button>
      <div className="h2-accordion-panel" data-open={isOpen} id={`h2-accordion-panel-${id}`}>
        <div className="h2-accordion-panel-inner">
          <div className="h2-accordion-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function DetailsAccordion() {
  const [open, setOpen] = useState<ItemId | null>(null);

  const toggle = (id: ItemId) => setOpen((prev) => (prev === id ? null : id));

  return (
    <div className="h2-accordion">
      <AccordionItem
        id="mapa"
        num="01"
        title="24 oblastí života"
        isOpen={open === 'mapa'}
        onToggle={() => toggle('mapa')}
      >
        <p className="h2-accordion-lead">
          Nejsou to nezávislá témata — stejná vlastnost přetéká napříč. A neznamená to, že
          analyzuju všechno najednou.
        </p>
        <AreaMap />
      </AccordionItem>

      <AccordionItem
        id="living-os"
        num="02"
        title="Jak se hypotéza dostane do mého „Living OS“"
        isOpen={open === 'living-os'}
        onToggle={() => toggle('living-os')}
      >
        <p className="h2-accordion-lead">
          Ne všechno, co o sobě zjistím, se rovnou stane pravidlem. Musí projít pár kroky.
        </p>
        <ArchitectureFlow />
      </AccordionItem>

      <AccordionItem
        id="priorita"
        num="03"
        title="Co budeme řešit jako první"
        isOpen={open === 'priorita'}
        onToggle={() => toggle('priorita')}
      >
        <p className="h2-accordion-lead">
          <strong>05 — Výběr, rozhodování a overthinking.</strong> Jeden dobrý filtr na výběr
          může současně ovlivnit práci, projekty, čas, stres i náš společný prostor.
        </p>
        <p className="h2-accordion-lead">Další pravděpodobné oblasti: dotahování, přetížení a
          recovery, hranice a komunikace, energie.</p>
        <p className="h2-accordion-caption">
          Priorita není to, co je nejzajímavější analyzovat. Priorita = dopad × ovlivnitelnost ×
          aktuálnost.
        </p>
      </AccordionItem>
    </div>
  );
}
