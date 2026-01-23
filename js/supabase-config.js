// Supabase Configuration
// Bạn cần thay thế SUPABASE_URL và SUPABASE_ANON_KEY bằng thông tin từ project Supabase của bạn.

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase initialized:', supabase);
