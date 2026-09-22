export type ListingId =
  | "sam-01"
  | "sam-02"
  | "sam-03"
  | "sam-04"
  | "sam-05"
  | "sam-06"
  | "sam-07"
  | "sam-08"
  | "sam-09"
  | "sam-10"
  | "sam-11";

export interface DisplayMonthlyPrice {
  known_min_czk: number;
  known_max_czk: number;
  is_complete: boolean;
  monthly_costs_unknown: boolean;
  label: string;
  price_per_m2_from_czk: number | null;
  price_per_m2_to_czk: number | null;
  note: string | null;
}

export interface ManualReview {
  decision: string;
  round: number;
  balcony_status: string;
  furnishing_for_filter: string;
  notes: string;
  review_source: string;
}

export interface Listing {
  id: ListingId;
  checked_at: string;
  alternative_urls: string[];
  listing_status: string;
  pets_status: string;
  pets_exact_quote: string | null;
  pets_conditions: string | null;
  australian_shepherd_explicitly_approved: boolean;
  pets_requires_confirmation: boolean;
  balcony_status: string;
  balcony_type: string | null;
  balcony_area_m2: number | null;
  furnished_status: string;
  kitchen: string | null;
  refrigerator: boolean | string | null;
  dishwasher: boolean | string | null;
  washing_machine: boolean | string | null;
  sofa: boolean | string | null;
  bed: boolean | string | null;
  wardrobes: boolean | string | null;
  other_equipment: string[];
  cellar: string | null;
  parking: string | null;
  surroundings: string | null;
  available_from: string | null;
  rent_czk: number;
  services_czk: number | null;
  electricity_czk: number | null;
  gas_czk: number | null;
  other_mandatory_czk: number | null;
  known_monthly_total_czk: number;
  monthly_total_complete: boolean;
  missing_monthly_costs: string[];
  deposit_czk: number | null;
  agency_fee_czk: number | null;
  other_one_time_fees_czk: number | null;
  missing_one_time_costs?: string[];
  image_url_main: string;
  image_urls: string[];
  image_source_page: string | null;
  images_verified_for_this_listing: boolean;
  evidence: string[];
  discrepancies: string[];
  extraction_errors: string[];
  facts_to_verify: string[];
  source_url: string;
  source_name: string;
  district: "Brno-Bystrc" | "Brno-Komín" | "Brno-Jundrov" | string;
  street: string | null;
  house_number: string | null;
  disposition: string;
  area_m2: number | null;
  floor: string | null;
  elevator: boolean | null;
  card_title: string;
  card_subtitle: string;
  benefits: string[];
  compromises: string[];
  price_per_m2_czk: number | null;
  manual_review: ManualReview;
  original_extraction_values: Record<string, unknown>;
  display_balcony_status: string;
  display_furnished_status: string;
  dog_approval_for_sam: string;
  image_fallback_url: string | null;
  image_loading_policy: string;
  display_monthly_price: DisplayMonthlyPrice;
  image_url_main_validated_live: boolean;
  source_data_checked_at: string;
  display_price_per_m2_is_final: boolean;
}

export type Username = "sam" | "honzik";

export type Decision = "unreviewed" | "favorite" | "maybe" | "want_viewing" | "reject";

export const DECISIONS: Decision[] = ["unreviewed", "favorite", "maybe", "want_viewing", "reject"];

export interface ListingState {
  userId: string;
  username: Username;
  listingId: ListingId;
  favorite: boolean;
  decision: Decision;
  notes: string;
  ratingPrice: number | null;
  ratingPet: number | null;
  ratingLocation: number | null;
  ratingBalcony: number | null;
  ratingFurnishing: number | null;
  version: number;
  updatedAt: string;
}

export interface DecisionEvent {
  id: number;
  userId: string;
  username: Username;
  listingId: ListingId;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export type PetCategory = "po_dohode" | "neuvedeno" | "schvaleno" | "zakazano";
