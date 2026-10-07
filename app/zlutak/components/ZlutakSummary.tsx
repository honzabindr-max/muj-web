'use client';

import { ALL_ITEM_IDS } from '../lib/zlutak-items';
import { useZlutakItems } from './ZlutakItemsProvider';

function formatCzk(n: number): string {
  return new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';
}

function computeSummary(items: ReturnType<typeof useZlutakItems>['items']) {
  let resolved = 0;
  let discard = 0;
  let sellOnline = 0;
  let keepAtZlutak = 0;
  let someoneTakes = 0;
  let undecided = 0;
  let keepValueTotal = 0;

  for (const id of ALL_ITEM_IDS) {
    const s = items[id];
    if (!s) continue;
    if (s.resolved) resolved += 1;
    if (s.discard) discard += 1;
    if (s.sellOnline) sellOnline += 1;
    if (s.keepAtZlutak) {
      keepAtZlutak += 1;
      keepValueTotal += s.keepValueCzk ?? 0;
    }
    if (s.someoneTakes) someoneTakes += 1;
    if (!s.resolved && !s.discard && !s.sellOnline && !s.keepAtZlutak && !s.someoneTakes) undecided += 1;
  }

  return { resolved, discard, sellOnline, keepAtZlutak, someoneTakes, undecided, keepValueTotal, total: ALL_ITEM_IDS.length };
}

export function ZlutakSummaryMini() {
  const { items } = useZlutakItems();
  const { keepAtZlutak, keepValueTotal } = computeSummary(items);
  return (
    <div className="z-mini-summary">
      Zůstane na Žluťáku: <strong>{keepAtZlutak}</strong> položek, odhad celkem{' '}
      <strong>{formatCzk(keepValueTotal)}</strong>
    </div>
  );
}

export function ZlutakSummaryFull() {
  const { items } = useZlutakItems();
  const s = computeSummary(items);

  return (
    <div className="z-summary">
      <p className="z-summary-headline">
        Zůstane na Žluťáku: <strong>{s.keepAtZlutak}</strong> položek, odhad celkem{' '}
        <strong>{formatCzk(s.keepValueTotal)}</strong>
      </p>
      <ul className="z-summary-counts">
        <li>
          Vyřešeno: <strong>{s.resolved}</strong>
        </li>
        <li>
          K vyhození: <strong>{s.discard}</strong>
        </li>
        <li>
          K prodeji: <strong>{s.sellOnline}</strong>
        </li>
        <li>
          Někdo si vezme: <strong>{s.someoneTakes}</strong>
        </li>
        <li>
          Nerozhodnuto: <strong>{s.undecided}</strong>
        </li>
        <li>
          Celkem položek: <strong>{s.total}</strong>
        </li>
      </ul>
    </div>
  );
}
