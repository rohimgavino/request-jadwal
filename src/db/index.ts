import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create Supabase client
let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase!;
}

// Check if Supabase is configured
export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

// For backwards compatibility - export db object
export const db = {
  supabase: getSupabase(),
};

// Helper to run queries (for compatibility)
export async function query<T>(sql: string, params?: (string | number)[]): Promise<T> {
  // Not used with Supabase - using Supabase methods directly
  throw new Error("Use Supabase methods directly");
}

export async function execute(sql: string, params?: (string | number)[]): Promise<any> {
  // Not used with Supabase - using Supabase methods directly
  throw new Error("Use Supabase methods directly");
}

// Test connection
export async function testConnection(): Promise<boolean> {
  if (!isConfigured) return false;
  
  try {
    const { data, error } = await getSupabase().from("employees").select("nik").limit(1);
    return !error;
  } catch (error) {
    console.error("Supabase connection error:", error);
    return false;
  }
}
