'use client';

import { ALL_ITEM_IDS } from '../lib/zlutak-items';
import { STATUS_FIELDS, formatCzk, pluralPolozek } from '../lib/zlutak-status';
import { useZlutakItems } from './ZlutakItemsProvider';

type Bucket = { count: number; value: number };

function computeBuckets(items: ReturnType<typeof useZlutakItems>['items']) {
  const buckets: Record<string, Bucket> = {};
  for (const { field } of STATUS_FIELDS) buckets[field] = { count: 0, value: 0 };
  const undecided: Bucket = { count: 0, value: 0 };

  for (const id of ALL_ITEM_IDS) {
    const s = items[id];
    if (!s) continue;
    const value = s.keepValueCzk ?? 0;
    let anyStatus = false;
    for (const { field } of STATUS_FIELDS) {
      if (s[field]) {
        buckets[field].count += 1;
        buckets[field].value += value;
        anyStatus = true;
      }
    }
    if (!anyStatus) {
      undecided.count += 1;
      undecided.value += value;
    }
  }

  return { buckets, undecided };
}

export function ZlutakSummaryMini() {
  const { items } = useZlutakItems();
  const { buckets } = computeBuckets(items);

  return (
    <div className="z-mini-summary">
      {STATUS_FIELDS.map(({ field, cssVar, label }) => (
        <span key={field} className="z-mini-stat" title={label}>
          <span className="z-dot" style={{ background: `var(${cssVar})` }} aria-hidden="true" />
          {formatCzk(buckets[field].value)}
        </span>
      ))}
    </div>
  );
}

export function ZlutakSummaryFull() {
  const { items } = useZlutakItems();
  const { buckets, undecided } = computeBuckets(items);

  return (
    <div className="z-summary">
      <ul className="z-summary-rows">
        {STATUS_FIELDS.map(({ field, cssVar, label }) => (
          <li key={field} className="z-summary-row">
            <span className="z-dot" style={{ background: `var(${cssVar})` }} aria-hidden="true" />
            <span className="z-summary-label">{label}</span>
            <span className="z-summary-figures">
              {buckets[field].count} {pluralPolozek(buckets[field].count)},{' '}
              {formatCzk(buckets[field].value)}
            </span>
          </li>
        ))}
        <li className="z-summary-row">
          <span className="z-dot z-dot-undecided" aria-hidden="true" />
          <span className="z-summary-label">Nerozhodnuto</span>
          <span className="z-summary-figures">
            {undecided.count} {pluralPolozek(undecided.count)}, {formatCzk(undecided.value)}
          </span>
        </li>
      </ul>
    </div>
  );
}
