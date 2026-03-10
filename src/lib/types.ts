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

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  has_completed_onboarding: boolean;
  created_at: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
