import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddohqrwkripaeocnyynu.supabase.co';
const supabaseAnonKey = 'sb_publishable_jzYTkJ6jAwHKBOkUsTEJnw_qfTOXtQc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
