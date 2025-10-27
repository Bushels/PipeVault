// Database types - Auto-generated from Supabase schema
// To regenerate: npx supabase gen types typescript --project-id cvevhvjxnklbbhtqzyvw > lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          domain: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      storage_requests: {
        Row: {
          id: string;
          company_id: string;
          user_email: string;
          reference_id: string;
          status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
          request_details: Json | null;
          trucking_info: Json | null;
          assigned_location: string | null;
          assigned_rack_ids: string[] | null;
          approval_summary: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          rejected_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_email: string;
          reference_id: string;
          status?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
          request_details?: Json | null;
          trucking_info?: Json | null;
          assigned_location?: string | null;
          assigned_rack_ids?: string[] | null;
          approval_summary?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          rejected_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_email?: string;
          reference_id?: string;
          status?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
          request_details?: Json | null;
          trucking_info?: Json | null;
          assigned_location?: string | null;
          assigned_rack_ids?: string[] | null;
          approval_summary?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          rejected_at?: string | null;
        };
      };
      inventory: {
        Row: {
          id: string;
          company_id: string;
          request_id: string | null;
          reference_id: string;
          type: 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe';
          grade: string;
          outer_diameter: number;
          weight: number;
          length: number;
          quantity: number;
          status: 'PENDING_DELIVERY' | 'IN_STORAGE' | 'PICKED_UP' | 'IN_TRANSIT';
          drop_off_timestamp: string | null;
          pickup_timestamp: string | null;
          storage_area_id: string | null;
          assigned_uwi: string | null;
          assigned_well_name: string | null;
          delivery_truck_load_id: string | null;
          pickup_truck_load_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          request_id?: string | null;
          reference_id: string;
          type: 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe';
          grade: string;
          outer_diameter: number;
          weight: number;
          length: number;
          quantity: number;
          status?: 'PENDING_DELIVERY' | 'IN_STORAGE' | 'PICKED_UP' | 'IN_TRANSIT';
          drop_off_timestamp?: string | null;
          pickup_timestamp?: string | null;
          storage_area_id?: string | null;
          assigned_uwi?: string | null;
          assigned_well_name?: string | null;
          delivery_truck_load_id?: string | null;
          pickup_truck_load_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          request_id?: string | null;
          reference_id?: string;
          type?: 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe';
          grade?: string;
          outer_diameter?: number;
          weight?: number;
          length?: number;
          quantity?: number;
          status?: 'PENDING_DELIVERY' | 'IN_STORAGE' | 'PICKED_UP' | 'IN_TRANSIT';
          drop_off_timestamp?: string | null;
          pickup_timestamp?: string | null;
          storage_area_id?: string | null;
          assigned_uwi?: string | null;
          assigned_well_name?: string | null;
          delivery_truck_load_id?: string | null;
          pickup_truck_load_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      truck_loads: {
        Row: {
          id: string;
          type: 'DELIVERY' | 'PICKUP';
          trucking_company: string;
          driver_name: string;
          driver_phone: string | null;
          arrival_time: string;
          departure_time: string | null;
          joints_count: number;
          storage_area_id: string | null;
          related_request_id: string | null;
          related_pipe_ids: string[] | null;
          assigned_uwi: string | null;
          assigned_well_name: string | null;
          notes: string | null;
          photo_urls: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: 'DELIVERY' | 'PICKUP';
          trucking_company: string;
          driver_name: string;
          driver_phone?: string | null;
          arrival_time: string;
          departure_time?: string | null;
          joints_count: number;
          storage_area_id?: string | null;
          related_request_id?: string | null;
          related_pipe_ids?: string[] | null;
          assigned_uwi?: string | null;
          assigned_well_name?: string | null;
          notes?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: 'DELIVERY' | 'PICKUP';
          trucking_company?: string;
          driver_name?: string;
          driver_phone?: string | null;
          arrival_time?: string;
          departure_time?: string | null;
          joints_count?: number;
          storage_area_id?: string | null;
          related_request_id?: string | null;
          related_pipe_ids?: string[] | null;
          assigned_uwi?: string | null;
          assigned_well_name?: string | null;
          notes?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_email: string;
          company_id: string;
          reference_id: string | null;
          request_id: string | null;
          messages: Json;
          conversation_type: string | null;
          is_completed: boolean;
          started_at: string;
          last_message_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_email: string;
          company_id: string;
          reference_id?: string | null;
          request_id?: string | null;
          messages?: Json;
          conversation_type?: string | null;
          is_completed?: boolean;
          started_at?: string;
          last_message_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_email?: string;
          company_id?: string;
          reference_id?: string | null;
          request_id?: string | null;
          messages?: Json;
          conversation_type?: string | null;
          is_completed?: boolean;
          started_at?: string;
          last_message_at?: string;
          completed_at?: string | null;
        };
      };
      racks: {
        Row: {
          id: string;
          area_id: string;
          name: string;
          capacity: number;
          capacity_meters: number;
          occupied: number;
          occupied_meters: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          area_id: string;
          name: string;
          capacity?: number;
          capacity_meters?: number;
          occupied?: number;
          occupied_meters?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          name?: string;
          capacity?: number;
          capacity_meters?: number;
          occupied?: number;
          occupied_meters?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      request_status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
      pipe_type: 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe';
      pipe_status: 'PENDING_DELIVERY' | 'IN_STORAGE' | 'PICKED_UP' | 'IN_TRANSIT';
      truck_load_type: 'DELIVERY' | 'PICKUP';
      notification_type: 'NEW_REQUEST' | 'DELIVERY_SCHEDULED' | 'PICKUP_SCHEDULED' | 'URGENT_REQUEST' | 'CUSTOMER_MESSAGE';
    };
  };
}
