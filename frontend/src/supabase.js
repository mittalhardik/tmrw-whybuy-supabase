import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

console.log("DEBUG: Supabase Config Check");
console.log("URL:", supabaseUrl ? "Set" : "Missing");
console.log("Key:", supabaseKey ? "Set" : "Missing");
console.log("All Env Keys:", Object.keys(import.meta.env));

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing Supabase URL or Key in environment variables.");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder")
