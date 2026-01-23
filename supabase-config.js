// Supabase Configuration
// Bạn cần thay thế SUPABASE_URL và SUPABASE_ANON_KEY bằng thông tin từ project Supabase của bạn.

const SUPABASE_URL = 'https://pugtndruuelblwvpqdog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_T1Mn2K9xBnOZUGrj4PbuhQ_mggaPTH2';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabase = window.supabaseClient;

console.log('Supabase initialized:', supabase);
