-- Create app_role enum for archetypes
CREATE TYPE public.archetype AS ENUM ('Quiet Builder', 'Curious Explorer', 'Warm Connector', 'Storyteller', 'Calm Analyst');

-- Create session_status enum
CREATE TYPE public.session_status AS ENUM ('pending', 'active', 'completed', 'analyzed', 'failed');

-- Create room_type enum
CREATE TYPE public.room_type AS ENUM ('interest', 'vibe');

-- 1. User Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  niche_interest TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Interview Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  nimrobo_session_id TEXT UNIQUE,
  nimrobo_link TEXT,
  status public.session_status DEFAULT 'pending',
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Extracted Traits
CREATE TABLE public.traits (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  big5 JSONB NOT NULL DEFAULT '{"openness": 50, "conscientiousness": 50, "extraversion": 50, "agreeableness": 50, "neuroticism": 50}',
  passion_score INTEGER CHECK (passion_score BETWEEN 0 AND 100) DEFAULT 50,
  archetype public.archetype,
  tags TEXT[] DEFAULT '{}',
  deep_hooks TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Persistent Chat Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type public.room_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Room Membership
CREATE TABLE public.room_members (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 6. Chat Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable Realtime on messages and room_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;

-- RLS Policies

-- Profiles: Users can read all, update only their own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Sessions: Users can only access their own
CREATE POLICY "Users can view their own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Traits: Users can read all, update only their own
CREATE POLICY "Anyone can view traits" ON public.traits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own traits" ON public.traits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own traits" ON public.traits FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Rooms: All authenticated users can read
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (true);

-- Room Members: All can read, users can manage their own membership
CREATE POLICY "Anyone can view room members" ON public.room_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages: Room members can read/insert messages
CREATE POLICY "Room members can view messages" ON public.messages FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "Room members can send messages" ON public.messages FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid()));