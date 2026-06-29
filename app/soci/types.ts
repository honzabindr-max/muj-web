export type WaypointCategory = 'reka' | 'vodopad' | 'hory' | 'zaklad' | 'doprava';

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: WaypointCategory;
  description: string;
}

export interface TransportVariant {
  id: string;
  icon: string;
  label: string;
  price: string;
  duration: string;
  steps: string[];
  highlight?: string;
}

export interface DayPlan {
  day: number;
  title: string;
  tags: string[];
  description: string;
  tip?: string;
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
