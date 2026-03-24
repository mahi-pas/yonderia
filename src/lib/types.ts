export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InviteCodeType = "join" | "join_planner" | "view";
export type TripParticipantRole = "organizer" | "planner" | "member";
export type ItineraryItemType = "event" | "hotel" | "commute";
export type RsvpStatus = "going" | "interested" | "not_going";

export interface EventRsvp {
  id: string;
  itinerary_item_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  updated_at: string;
}

export interface EventComment {
  id: string;
  trip_id: string;
  itinerary_item_id: string | null;
  user_id: string;
  content: string | null;
  gif_url: string | null;
  is_announcement: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventCommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface NotificationRead {
  user_id: string;
  notification_id: string;
  read_at: string;
}

export interface CommentReactionSummary {
  emoji: string;
  count: number;
  reactors: Array<{
    user_id: string;
    display_name: string | null;
    nickname: string | null;
  }>;
}

export interface RsvpSummary {
  going: number;
  interested: number;
  not_going: number;
  userStatus: RsvpStatus | null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  has_completed_onboarding: boolean;
  created_at: string;
}

export type TripThemeBackgroundType = "gradient" | "image" | "solid";
export type TripThemeEffect = "none" | "confetti" | "sparkles" | "snow" | "fireflies" | "aurora";
export type TripThemeCardStyle = "glass" | "solid" | "outline";

export interface TripTheme {
  background?: {
    type: TripThemeBackgroundType;
    value: string;
    overlay_opacity?: number;
  };
  font?: {
    display: string;
    body: string;
  };
  accent_color?: string;
  effect?: TripThemeEffect;
  card_style?: TripThemeCardStyle;
  /** Card/button background. When set, cards and buttons use this for thematic consistency. */
  surface_color?: string;
  /** Slightly elevated surface (e.g. hover states). Defaults to a lighter surface if unset. */
  surface_elevated_color?: string;
  /** Text color for content on cards/surface. Use a light color on dark cards (e.g. #fafafa). */
  surface_foreground?: string;
  /** Primary text (headings, main content). */
  text_primary?: string;
  /** Secondary/muted text (dates, descriptions). */
  text_secondary?: string;
  /** Section titles and accent text (e.g. "ABOUT THIS TRIP"). Uses accent_color when unset. */
  text_accent?: string;
  /** Border color for cards and buttons. */
  border_color?: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string;
  default_planner_permission: boolean;
  created_by: string | null;
  created_at: string;
  theme?: TripTheme | null;
}

export interface InviteCode {
  id: string;
  trip_id: string;
  code: string;
  code_type: InviteCodeType;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TripParticipant {
  id: string;
  trip_id: string;
  user_id: string;
  nickname: string | null;
  role: TripParticipantRole;
  arrival_time: string | null;
  departure_time: string | null;
  arrival_location: string | null;
  departure_location: string | null;
  joined_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  item_type: ItineraryItemType;
  title: string;
  description: string | null;
  image_url: string | null;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  destination_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      trips: {
        Row: Trip;
        Insert: Omit<Trip, "created_at"> & { created_at?: string };
        Update: Partial<Trip>;
        Relationships: [];
      };
      invite_codes: {
        Row: InviteCode;
        Insert: Omit<InviteCode, "created_at"> & { created_at?: string };
        Update: Partial<InviteCode>;
        Relationships: [];
      };
      trip_participants: {
        Row: TripParticipant;
        Insert: Omit<TripParticipant, "joined_at"> & { joined_at?: string };
        Update: Partial<TripParticipant>;
        Relationships: [];
      };
      itinerary_items: {
        Row: ItineraryItem;
        Insert: Omit<ItineraryItem, "created_at"> & { created_at?: string };
        Update: Partial<ItineraryItem>;
        Relationships: [];
      };
      event_rsvps: {
        Row: EventRsvp;
        Insert: Omit<EventRsvp, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EventRsvp>;
        Relationships: [];
      };
      event_comments: {
        Row: EventComment;
        Insert: Omit<EventComment, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EventComment>;
        Relationships: [];
      };
      notification_reads: {
        Row: NotificationRead;
        Insert: Omit<NotificationRead, "read_at"> & { read_at?: string };
        Update: Partial<NotificationRead>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
