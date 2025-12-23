import { createClient } from '@supabase/supabase-js'

// Prioritize runtime env (from /env.js) over build-time env
console.log("DEBUG: Initializing Supabase Client");
console.log("DEBUG: window.env state:", window.env);
console.log("DEBUG: import.meta.env state:", import.meta.env);

const supabaseUrl = window.env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseKey = window.env?.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY

console.log("DEBUG: Resolved supabaseUrl:", supabaseUrl ? "Present (length " + supabaseUrl.length + ")" : "Missing");
console.log("DEBUG: Resolved supabaseKey:", supabaseKey ? "Present" : "Missing");

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing Supabase URL or Key in environment variables.");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder")
