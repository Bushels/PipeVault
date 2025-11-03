import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Using placeholder values. Data operations will not work until configured.');
}

// Use placeholder values if not set (allows app to load)
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any): never {
  console.error('Supabase error:', error);
  throw new Error(error.message || 'An unexpected error occurred');
}

// Type-safe query builders
export const db = {
  companies: () => supabase.from('companies'),
  requests: () => supabase.from('storage_requests'),
  inventory: () => supabase.from('inventory'),
  truckLoads: () => supabase.from('truck_loads'),
  shipments: () => supabase.from('shipments'),
  shipmentTrucks: () => supabase.from('shipment_trucks'),
  dockAppointments: () => supabase.from('dock_appointments'),
  shipmentDocuments: () => supabase.from('shipment_documents'),
  shipmentItems: () => supabase.from('shipment_items'),
  conversations: () => supabase.from('conversations'),
  documents: () => supabase.from('documents'),
  notifications: () => supabase.from('notifications'),
  yards: () => supabase.from('yards'),
  racks: () => supabase.from('racks'),
};
