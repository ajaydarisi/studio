
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrlFromEnv) {
  throw new Error("FATAL: Missing env.NEXT_PUBLIC_SUPABASE_URL. Check .env file and restart server.");
}
if (!supabaseAnonKeyFromEnv) {
  throw new Error("FATAL: Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env file and restart server.");
}

const supabaseUrl = supabaseUrlFromEnv.trim();
const supabaseAnonKey = supabaseAnonKeyFromEnv.trim();

if (supabaseUrl === 'your_supabase_url_here') {
    throw new Error("Supabase URL is the exact placeholder 'your_supabase_url_here'. Update .env file and restart server.");
}

if (supabaseUrl === '') {
    throw new Error("Supabase URL is an empty string. Update .env file and restart server.");
}

if (supabaseAnonKey === 'your_supabase_anon_key_here' || supabaseAnonKey === '') {
    throw new Error("Supabase Anon Key is a placeholder or empty. Update .env file and restart server.");
}

try {
    new URL(supabaseUrl); 
} catch (e) {
    throw new Error(`Invalid Supabase URL format: "${supabaseUrl}". Check your .env file and restart server.`);
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
