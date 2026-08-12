export type StepType =
  | 'vlak'
  | 'bus'
  | 'taxi'
  | 'trek'
  | 'highlight'
  | 'jidlo'
  | 'voda'
  | 'kemp'
  | 'plan-b';

export type BadgeLevel = 'red' | 'orange' | 'ok';

export interface TransferBadge {
  minutes: number;
  level: BadgeLevel;
  label: string;
}

export interface Photo {
  src: string;
  alt: string;
  author: string;
  license: string;
  sourceUrl: string;
}

export interface SubPoint {
  name: string;
  photo?: Photo;
  note?: string;
  moreUrl?: string;
}

export interface Step {
  id: string;
  time: string;
  type: StepType;
  place: string;
  instruction: string;
  mapUrl?: string;
  moreUrl?: string;
  transferBadge?: TransferBadge;
  photo?: Photo;
  subPoints?: SubPoint[];
}

export interface DayPlan {
  id: 'ct' | 'pa' | 'so';
  date: string;
  dateLabel: string;
  shortLabel: string;
  title: string;
  stats: string;
  difficulty: string;
  heroPhoto?: Photo;
  steps: Step[];
  doprava: string[];
  trek: string[];
  jidlo: string[];
  voda: string[];
  ubytovani: string[];
  planB: string[];
}

export interface EmergencyItem {
  situace: string;
  reakce: string;
}

export interface ShoppingItem {
  id: string;
  label: string;
}
