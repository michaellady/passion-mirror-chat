-- Migration: Add users table for custom auth (replaces Supabase auth.users)
-- Run this migration against RDS PostgreSQL

-- Create users table (replaces auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  niche_interest TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Update profiles table to reference users instead of auth.users
-- First, drop the existing foreign key if it exists (Supabase constraint)
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- Add new foreign key to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_users_fkey'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_users_fkey
    FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Remove RLS policies that depend on auth.uid() (we'll use API-level auth instead)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can view traits" ON public.traits;
DROP POLICY IF EXISTS "Users can insert their own traits" ON public.traits;
DROP POLICY IF EXISTS "Users can update their own traits" ON public.traits;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view room members" ON public.room_members;
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_members;
DROP POLICY IF EXISTS "Room members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Room members can send messages" ON public.messages;

-- Disable RLS (auth is handled at API level now)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.traits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
