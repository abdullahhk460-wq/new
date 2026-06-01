-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Creates bookings table + RLS policies for public insert + backend service role

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  plan TEXT,
  class_type TEXT,
  time_slot TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
  cost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_email_idx ON public.bookings (email);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON public.bookings (created_at DESC);

-- Fix legacy mixed-case rows (run once if you already have data)
UPDATE public.bookings
SET status = lower(trim(status))
WHERE status IS NOT NULL AND status <> lower(trim(status));

UPDATE public.bookings SET status = 'pending' WHERE status NOT IN ('pending', 'confirmed', 'paid');

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Public website: allow anonymous INSERT only (reads/updates go through your Express API + service role)
DROP POLICY IF EXISTS "public_can_insert_bookings" ON public.bookings;
CREATE POLICY "public_can_insert_bookings"
  ON public.bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Optional: users read own bookings by email when using Supabase client directly
DROP POLICY IF EXISTS "users_read_own_bookings" ON public.bookings;
CREATE POLICY "users_read_own_bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- Service role bypasses RLS — use SUPABASE_SERVICE_ROLE_KEY in backend .env for admin CRUD
