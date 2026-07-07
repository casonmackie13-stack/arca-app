export type ThemeMode = "dark" | "light";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type PanelVariant = "default" | "elevated" | "featured" | "interactive";
export type BadgeTone =
  | "neutral"
  | "gold"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "trade";

export type CardImage = { id?: string; image_url: string; image_type?: string | null };

export type CardSummary = {
  id: string;
  owner_id?: string;
  collection_id?: string;
  created_at?: string;
  player_name: string;
  sport?: string | null;
  year?: string | null;
  brand?: string | null;
  set_name?: string | null;
  card_number?: string | null;
  team?: string | null;
  parallel?: string | null;
  rookie_card?: boolean | null;
  serial_number?: string | null;
  condition?: string | null;
  grader?: string | null;
  grade?: string | null;
  estimated_value?: string | number | null;
  status?: string | null;
  notes?: string | null;
  original_image_url?: string | null;
  front_image_url?: string | null;
  back_image_url?: string | null;
  original_front_image_url?: string | null;
  original_back_image_url?: string | null;
  display_image_url?: string | null;
  image_source?: string | null;
  image_source_url?: string | null;
  image_replacement_status?: string | null;
  card_images?: CardImage[];
  collection?: { id: string; name: string } | null;
};

export type CollectionSummary = {
  id: string;
  owner_id?: string;
  name: string;
  category?: string | null;
  visibility?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  created_at?: string;
  cards?: CardSummary[] | { id?: string; display_image_url?: string | null; front_image_url?: string | null; back_image_url?: string | null; card_images?: CardImage[] }[];
};

export type CollectorProfile = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  rank?: string | null;
  avatar_url?: string | null;
};
