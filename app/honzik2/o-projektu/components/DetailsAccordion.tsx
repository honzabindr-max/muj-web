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
        title="Jak poznám, že mi něco opravdu funguje"
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
        title="Čím začnu"
        isOpen={open === 'priorita'}
        onToggle={() => toggle('priorita')}
      >
        <p className="h2-accordion-lead">Jako první chci řešit výběr a rozhodování.</p>
        <p className="h2-accordion-lead">
          Protože když dokážu líp poznat, čemu dát ano a čemu ne, může to současně pomoct práci,
          času, hlavě i našemu společnému prostoru.
        </p>
        <p className="h2-accordion-lead">
          Potom pravděpodobně přijdou:
          <br />
          dotahování,
          <br />
          přetížení a návrat do pohody,
          <br />
          hranice a komunikace,
          <br />
          energie.
        </p>
        <p className="h2-accordion-caption">
          Nejdřív chci řešit věci, které mají největší dopad na normální život.
        </p>
      </AccordionItem>
    </div>
  );
}
