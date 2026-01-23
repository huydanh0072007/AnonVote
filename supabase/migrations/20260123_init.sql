-- 1. Table: rooms (Cuộc họp)
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    host_key text NOT NULL, -- Key bí mật để quản lý room
    settings jsonb DEFAULT '{
        "pin_type": "number", 
        "pin_interval": 30, 
        "max_voters": 1000,
        "calc_method": "total_participants"
    }'::jsonb,
    bg_image_url text,
    current_pin text -- PIN hiện tại
);

-- 2. Table: polls (Các câu hỏi bình chọn)
CREATE TABLE IF NOT EXISTS public.polls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    question text NOT NULL,
    options jsonb NOT NULL, -- Format: [{"id": "1", "label": "Tín nhiệm"}, {"id": "2", "label": "Không tín nhiệm"}]
    image_url text,
    status text DEFAULT 'active', -- active, closed
    is_winner_highlighted boolean DEFAULT true
);

-- 3. Table: votes (Phiếu bầu)
CREATE TABLE IF NOT EXISTS public.votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id text NOT NULL,
    voter_fingerprint text, -- Để hạn chế 1 người vote nhiều lần
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Table: questions (Q&A)
CREATE TABLE IF NOT EXISTS public.questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    content text NOT NULL,
    upvotes integer DEFAULT 0,
    is_toxic boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- BẬT RLS (ROW LEVEL SECURITY)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH BẢO MẬT (POLICIES)

-- Rooms: Ai cũng có thể thấy room if biết ID, nhưng chỉ người có host_key mới được sửa.
CREATE POLICY "Public profiles are viewable by everyone" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Only hosts can update rooms" ON public.rooms FOR UPDATE USING (auth.uid() IS NULL); -- Guest access via HostKey logic handled in App

-- Polls: Ai cũng có thể thấy polls trong room. Chỉ host mới được tạo/sửa.
CREATE POLICY "Polls are viewable by everyone" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Hosts can insert polls" ON public.polls FOR INSERT WITH CHECK (true); -- Security handled via HostKey in JS

-- Votes: Ai cũng có thể insert (vote).
CREATE POLICY "Votes can be inserted by anyone" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Votes are viewable by everyone" ON public.votes FOR SELECT USING (true);

-- Questions: Ai cũng có thể thấy và hỏi.
CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Anyone can ask questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can upvote" ON public.questions FOR UPDATE USING (true);

-- REALTIME setup
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, polls, votes, questions;
