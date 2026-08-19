import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type User = {
  id: string;
  full_name: string;
  class_name: string;
  display_name: string;
  last_login: string;
  created_at: string;
};

export type Discovery = {
  id: string;
  user_id: string;
  student: string;
  scientific_name: string;
  common_name: string;
  points: number;
  confidence: number;
  found_at: string;
  created_at: string;
};

export type LeaderboardEntry = {
  student: string;
  total_points: number;
  weekly_points: number;
  activity: Record<string, number>;
};

export type UserStats = {
  total_points: number;
  weekly_points: number;
  rank: number;
  unique_species: number;
};