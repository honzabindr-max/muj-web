import type { ZlutakItemState } from './zlutak-items';

export type ZlutakStatusField = Extract<
  keyof ZlutakItemState,
  'resolved' | 'discard' | 'sellOnline' | 'keepAtZlutak' | 'someoneTakes'
>;

export const STATUS_FIELDS: Array<{ field: ZlutakStatusField; label: string; cssVar: string }> = [
  { field: 'resolved', label: 'Vyřešené komplet', cssVar: '--z-status-resolved' },
  { field: 'discard', label: 'Vyhodit', cssVar: '--z-status-discard' },
  { field: 'sellOnline', label: 'Prodat online', cssVar: '--z-status-sell' },
  { field: 'keepAtZlutak', label: 'Nechat na Žluťáku', cssVar: '--z-status-keep' },
  { field: 'someoneTakes', label: 'Někdo si vezme', cssVar: '--z-status-someone' },
];

export function formatCzk(n: number): string {
  return new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';
}

export function pluralPolozek(n: number): string {
  if (n === 1) return 'položka';
  if (n >= 2 && n <= 4) return 'položky';
  return 'položek';
}
