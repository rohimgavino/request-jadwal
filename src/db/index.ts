import { createClient } from "@supabase/supabase-js";

// Supabase client - URL and key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create client (only if credentials are provided)
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Check if Supabase is configured
export const isConfigured = supabase !== null;

// For backward compatibility - will use in-memory fallback if not configured
export const db = {
  // This is a no-op for Supabase since we use the client directly
  // Kept for type compatibility with old code
};
