import { ITEM_SECTIONS } from './checklist-data';

export type ZlutakItemState = {
  resolved: boolean;
  discard: boolean;
  sellOnline: boolean;
  keepAtZlutak: boolean;
  keepValueCzk: number | null;
  someoneTakes: boolean;
  note: string;
  updatedAt: string | null;
};

export const EMPTY_ZLUTAK_ITEM_STATE: ZlutakItemState = {
  resolved: false,
  discard: false,
  sellOnline: false,
  keepAtZlutak: false,
  keepValueCzk: null,
  someoneTakes: false,
  note: '',
  updatedAt: null,
};

export const ALL_ITEM_IDS: string[] = ITEM_SECTIONS.flatMap((s) => s.items.map((i) => i.id));

// Položky seznamu zelené (zaškrtnuté) v původní statické datech před zavedením evidence —
// jediná je "zvirata-0" (Grace). Promítá se jako výchozí "resolved", dokud ji nepřepíše
// localStorage (uložený stav nebo migrace ze starého ChecklistProvider).
const ITEM_DEFAULT_RESOLVED: Record<string, boolean> = Object.fromEntries(
  ITEM_SECTIONS.flatMap((s) => s.items.map((i) => [i.id, !!i.defaultChecked])),
);

export function defaultZlutakItemState(id: string): ZlutakItemState {
  return { ...EMPTY_ZLUTAK_ITEM_STATE, resolved: !!ITEM_DEFAULT_RESOLVED[id] };
}
