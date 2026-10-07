'use client';

import type { ChangeEvent } from 'react';
import type { ChecklistItemData, ChecklistSectionData } from '../lib/checklist-data';
import { useZlutakItems } from './ZlutakItemsProvider';
import type { ZlutakItemState } from '../lib/zlutak-items';
import { STATUS_FIELDS } from '../lib/zlutak-status';

function ItemRow({ item }: { item: ChecklistItemData }) {
  const { items, updateItem } = useZlutakItems();
  const state = items[item.id];
  if (!state) return null;

  function toggle(field: keyof ZlutakItemState) {
    updateItem(item.id, { [field]: !state[field] } as Partial<ZlutakItemState>);
  }

  function handleValueChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const value = raw === '' ? null : Math.max(0, Number(raw));
    updateItem(item.id, { keepValueCzk: Number.isFinite(value) ? value : null });
  }

  function handleNoteChange(e: ChangeEvent<HTMLTextAreaElement>) {
    updateItem(item.id, { note: e.target.value });
  }

  return (
    <li className="z-item" data-resolved={state.resolved}>
      <div className="z-item-text">{item.label}</div>
      <div className="z-item-chips">
        {STATUS_FIELDS.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            className="z-chip"
            data-field={field}
            data-active={!!state[field]}
            onClick={() => toggle(field)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="z-item-value">
        Odhad hodnoty (Kč)
        <input
          type="number"
          name={`${item.id}-value`}
          inputMode="numeric"
          min={0}
          defaultValue={state.keepValueCzk ?? ''}
          onChange={handleValueChange}
        />
      </label>
      <textarea
        className="z-item-note"
        name={`${item.id}-note`}
        aria-label="Poznámka"
        placeholder="Poznámka (kdo si vezme, kde visí inzerát…)"
        defaultValue={state.note}
        onChange={handleNoteChange}
        rows={2}
      />
    </li>
  );
}

export function ItemChecklist({ section }: { section: ChecklistSectionData }) {
  const { loaded } = useZlutakItems();
  return (
    <ul className="z-item-list">
      {section.items.map((item) => (
        // key obsahuje `loaded`, aby se po načtení z localStorage (useEffect, běží po
        // prvním renderu) remountly nekontrolované vstupy (defaultValue note/number).
        <ItemRow key={`${item.id}-${loaded}`} item={item} />
      ))}
    </ul>
  );
}
