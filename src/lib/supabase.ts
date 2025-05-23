
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --- DETAILED LOGGING FOR DEBUGGING ---
console.log("======================================================================");
console.log("[Supabase Init Debug] Attempting to initialize Supabase client.");
console.log(`[Supabase Init Debug] Value of process.env.NEXT_PUBLIC_SUPABASE_URL as seen by the app: >>>${supabaseUrlFromEnv}<<<`);
console.log(`[Supabase Init Debug] Value of process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY (first 10 chars) as seen by the app: >>>${supabaseAnonKeyFromEnv ? supabaseAnonKeyFromEnv.substring(0, 10) + '...' : 'Not found or empty'}<<<`);
console.log("======================================================================");

if (!supabaseUrlFromEnv) {
  console.error("FATAL ERROR: NEXT_PUBLIC_SUPABASE_URL is not defined in the environment. Please ensure it is set in your .env file and the server has been restarted.");
  throw new Error("FATAL: Missing env.NEXT_PUBLIC_SUPABASE_URL. Check .env file and restart server.");
}
if (!supabaseAnonKeyFromEnv) {
  console.error("FATAL ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in the environment. Please ensure it is set in your .env file and the server has been restarted.");
  throw new Error("FATAL: Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env file and restart server.");
}

const supabaseUrl = supabaseUrlFromEnv.trim();
const supabaseAnonKey = supabaseAnonKeyFromEnv.trim();

if (supabaseUrl === 'your_supabase_url_here') {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is still THE EXACT PLACEHOLDER STRING 'your_supabase_url_here'. Please update it in your .env file with your actual Supabase project URL and RESTART THE SERVER.");
    throw new Error("Supabase URL is the exact placeholder 'your_supabase_url_here'. Update .env file and restart server.");
}

if (supabaseUrl === '') {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is an EMPTY STRING after trimming. Please provide a valid Supabase project URL in your .env file and RESTART THE SERVER.");
    throw new Error("Supabase URL is an empty string. Update .env file and restart server.");
}

// Check if the Anon Key is still the placeholder value or empty
if (supabaseAnonKey === 'your_supabase_anon_key_here' || supabaseAnonKey === '') {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is still a placeholder or empty. Please update it in your .env file with your actual Supabase project Anon Key and RESTART THE SERVER.");
    throw new Error("Supabase Anon Key is a placeholder or empty. Update .env file and restart server.");
}

try {
    new URL(supabaseUrl); // This will throw an error if the URL format is invalid
    console.log('[Supabase Init] NEXT_PUBLIC_SUPABASE_URL appears to be a validly formatted URL after checks:', supabaseUrl);
} catch (e) {
    console.error(`ERROR: The Supabase URL "${supabaseUrl}" is invalid according to the URL constructor. Please check its format in your .env file. It should start with http:// or https://. Full error:`, e);
    throw new Error(`Invalid Supabase URL format: "${supabaseUrl}". Check your .env file and restart server.`);
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
console.log('[Supabase Init] Supabase client initialized successfully.');
