// Supabase project for cross-device sync on the hosted copy.
// The publishable (anon) key is meant to live in browser code: Row Level
// Security in supabase/schema.sql is what keeps each person's rows private.
// Leave both empty to run without sync.
export const SUPABASE = {
  url: "https://deyfhlrwprtssrxqxwqr.supabase.co",
  key: "sb_publishable_qM6XevnOEa9hPVzgiERr5w_Zx8LklNb",
};

export const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
