export type WaypointKind =
  | 'context'
  | 'travel'
  | 'nature'
  | 'pass'
  | 'lodging'
  | 'gorge'
  | 'camp'
  | 'rafting'
  | 'waterfall';

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number | null;
  role: string;
  kind: WaypointKind;
  description: string;
}

export interface DayData {
  day: number;
  title: string;
  difficulty: number;
  color: string;
  highlights: string;
  description: string;
  planB: string;
}

export interface BudgetRow {
  item: string;
  low: string;
  mid: string;
  high: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  critical?: boolean;
  note?: string;
}

export interface RiskItem {
  risk: string;
  prevention: string;
  fallback: string;
}
