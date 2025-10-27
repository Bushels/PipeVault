import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
});

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
  conversations: () => supabase.from('conversations'),
  documents: () => supabase.from('documents'),
  notifications: () => supabase.from('notifications'),
  yards: () => supabase.from('yards'),
  racks: () => supabase.from('racks'),
};
