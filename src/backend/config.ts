/**
 * Backend switch. With no environment variables the app runs fully in the browser (localStorage, simulated friends).
 * Set both variables (see docs/BACKEND_SETUP.md) and the same UI talks to Supabase instead.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";
export const IS_BACKEND = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
