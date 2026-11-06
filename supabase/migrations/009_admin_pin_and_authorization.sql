-- ============================================================
-- MOONLIGHT STRIKERS — Hidden Admin PIN & Secure Authorization
-- Migration: 009_admin_pin_and_authorization
-- ============================================================

-- 1. Create table admin_settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id INT PRIMARY KEY,
  pin VARCHAR(6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_admin_pin_six_digits CHECK (pin ~ '^[0-9]{6}$')
);

-- 2. Enable Row Level Security (RLS) on admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- 3. Ensure NO direct public SELECT, INSERT, UPDATE, or DELETE access
-- (No public policies are created on admin_settings. Accessible ONLY through SECURITY DEFINER functions)

-- 4. Insert default PIN '000000' with id = 1
INSERT INTO public.admin_settings (id, pin, updated_at)
VALUES (1, '000000', now())
ON CONFLICT (id) DO NOTHING;

-- 5. Rate limiting table for brute force prevention
CREATE TABLE IF NOT EXISTS public.admin_auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.admin_auth_attempts ENABLE ROW LEVEL SECURITY;

-- 6. Active Admin Sessions Table
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours')
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 7. Helper: Check if an admin session is valid
CREATE OR REPLACE FUNCTION public.is_admin_session_valid(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE token = p_token
      AND expires_at > now()
  );
END;
$$;

-- 8. Main RPC: verify_admin_pin(input_pin TEXT, session_token TEXT DEFAULT NULL)
-- Returns TRUE for correct PIN, FALSE for incorrect PIN.
-- Protects against brute force via rate-limiting (max 5 failed attempts in 15 mins).
CREATE OR REPLACE FUNCTION public.verify_admin_pin(
  input_pin TEXT,
  session_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_pin VARCHAR(6);
  v_recent_fails INT;
BEGIN
  -- Rate limiting check: max 5 failed attempts in the last 15 minutes
  SELECT COUNT(*) INTO v_recent_fails
  FROM public.admin_auth_attempts
  WHERE success = false
    AND attempt_at > (now() - INTERVAL '15 minutes');

  IF v_recent_fails >= 5 THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Admin access is temporarily locked for 15 minutes.';
  END IF;

  -- Read latest PIN directly from admin_settings table (manual updates in SQL Editor take effect instantly)
  SELECT pin INTO v_stored_pin
  FROM public.admin_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_stored_pin := '000000';
  END IF;

  -- Validate the entered PIN
  IF input_pin IS NOT NULL AND input_pin = v_stored_pin THEN
    -- Record success attempt
    INSERT INTO public.admin_auth_attempts (attempt_at, success)
    VALUES (now(), true);

    -- Register admin session if session_token provided
    IF session_token IS NOT NULL AND trim(session_token) <> '' THEN
      INSERT INTO public.admin_sessions (token, expires_at)
      VALUES (session_token, now() + INTERVAL '2 hours')
      ON CONFLICT (token) DO UPDATE SET expires_at = now() + INTERVAL '2 hours';
    END IF;

    RETURN TRUE;
  ELSE
    -- Record failure attempt for rate limiting
    INSERT INTO public.admin_auth_attempts (attempt_at, success)
    VALUES (now(), false);

    RETURN FALSE;
  END IF;
END;
$$;

-- 9. RPC: admin_close_session(p_token TEXT)
-- Revokes an admin session immediately
CREATE OR REPLACE FUNCTION public.admin_close_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NOT NULL AND trim(p_token) <> '' THEN
    DELETE FROM public.admin_sessions WHERE token = p_token;
  END IF;
  RETURN TRUE;
END;
$$;

-- 10. RPC: admin_add_player
-- Server-side admin authorization to add players
CREATE OR REPLACE FUNCTION public.admin_add_player(
  p_token TEXT,
  p_player_id TEXT,
  p_full_name TEXT,
  p_photo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
BEGIN
  IF NOT public.is_admin_session_valid(p_token) THEN
    RAISE EXCEPTION 'Unauthorized: Valid admin session required to add players';
  END IF;

  v_id := 'p_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.players (id, player_id, full_name, name, photo_url, is_active, created_at, updated_at)
  VALUES (v_id, p_player_id, p_full_name, p_full_name, p_photo_url, true, now(), now());

  RETURN jsonb_build_object(
    'id', v_id,
    'player_id', p_player_id,
    'full_name', p_full_name,
    'photo_url', p_photo_url
  );
END;
$$;

-- 11. RPC: admin_delete_player
-- Server-side admin authorization to delete players
CREATE OR REPLACE FUNCTION public.admin_delete_player(
  p_token TEXT,
  p_player_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_session_valid(p_token) THEN
    RAISE EXCEPTION 'Unauthorized: Valid admin session required to delete players';
  END IF;

  DELETE FROM public.players
  WHERE id = p_player_id OR player_id = p_player_id;

  RETURN TRUE;
END;
$$;

-- 12. RPC: admin_delete_match
-- Server-side admin authorization to delete matches and cascade child rows
CREATE OR REPLACE FUNCTION public.admin_delete_match(
  p_token TEXT,
  p_match_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_session_valid(p_token) THEN
    RAISE EXCEPTION 'Unauthorized: Valid admin session required to delete matches';
  END IF;

  DELETE FROM public.ball_by_ball WHERE match_id = p_match_id;
  DELETE FROM public.innings WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;

  RETURN TRUE;
END;
$$;

-- 13. Tighten RLS policies on matches and players
-- Prevent public users from directly deleting matches via REST API
DROP POLICY IF EXISTS "Allow public delete matches" ON public.matches;
DROP POLICY IF EXISTS "Matches are deletable by everyone" ON public.matches;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Prevent public delete matches'
  ) THEN
    CREATE POLICY "Prevent public delete matches" ON public.matches FOR DELETE USING (false);
  END IF;
END $$;

-- Prevent public users from deleting players directly via REST API
DROP POLICY IF EXISTS "Allow public delete players" ON public.players;
DROP POLICY IF EXISTS "Players are deletable by everyone" ON public.players;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Prevent public delete players'
  ) THEN
    CREATE POLICY "Prevent public delete players" ON public.players FOR DELETE USING (false);
  END IF;
END $$;

-- Drop public insert on players if exists (adding players requires admin_add_player)
DROP POLICY IF EXISTS "Allow public insert players" ON public.players;

-- Ensure public users can still SELECT and UPDATE players (to view list, edit names, edit photos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public select players'
  ) THEN
    CREATE POLICY "Allow public select players" ON public.players FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public update players'
  ) THEN
    CREATE POLICY "Allow public update players" ON public.players FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
