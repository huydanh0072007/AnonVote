-- Migration: Add Matrix Question Support
-- 1. Add type to polls
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS type text DEFAULT 'choice';
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS criteria jsonb DEFAULT '[]'::jsonb;

-- 2. Add matrix_scores to votes
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS matrix_scores jsonb DEFAULT '{}'::jsonb;

-- 3. Update Realtime (Bỏ qua vì đã cấu quyền trong init script)
-- ALTER PUBLICATION supabase_realtime ADD TABLE polls, votes;
