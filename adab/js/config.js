// Public client configuration, the same two values as gradle.properties of the Android app. Both are meant to be
// public: the publishable key is protected by Row Level Security on the server. NEVER put a secret key, a
// service_role key or a database password here.
export const SUPABASE_URL = 'https://ergipxpbbfshqigoqevf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_4a4-lNlXf8LgqyrZHsEZEw_OCL94Mda';

// The version of the web app (also sent with a report, as "web-<version>", so the administrator can tell it apart
// from the Android app). Change it together with VERSION in sw.js: that is what makes phones load the new files.
export const VERSION = '1.0.0';
