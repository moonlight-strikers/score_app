-- ============================================================
-- MOONLIGHT STRIKERS — Mandatory App Version & Server-Side Security
-- Migration: 010_mandatory_app_version_and_security
-- ============================================================

-- ============================================================
-- 1. REUSE EXISTING CONFIGURATION TABLE: admin_settings
-- Add application version fields to public.admin_settings.
-- This avoids creating redundant tables.
-- ============================================================
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS latest_version TEXT NOT NULL DEFAULT '2.0.0',
  ADD COLUMN IF NOT EXISTS min_supported_version TEXT NOT NULL DEFAULT '2.0.0',
  ADD COLUMN IF NOT EXISTS force_update BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS update_url TEXT NOT NULL DEFAULT 'https://github.com/moonlight-strikers/cricket-scoring-app/releases/latest';

-- Upsert baseline configuration for id = 1
INSERT INTO public.admin_settings (id, pin, latest_version, min_supported_version, force_update, update_url, updated_at)
VALUES (1, '000000', '2.0.0', '2.0.0', true, 'https://github.com/moonlight-strikers/cricket-scoring-app/releases/latest', now())
ON CONFLICT (id) DO UPDATE
SET latest_version = EXCLUDED.latest_version,
    min_supported_version = EXCLUDED.min_supported_version,
    force_update = EXCLUDED.force_update,
    update_url = COALESCE(NULLIF(public.admin_settings.update_url, ''), EXCLUDED.update_url),
    updated_at = now();

-- ============================================================
-- 2. PUBLIC VIEW & RPC: get_app_version_config()
-- Exposes version configuration safely to anon/public clients
-- WITHOUT exposing the admin PIN column.
-- ============================================================
CREATE OR REPLACE VIEW public.app_version AS
SELECT
  id,
  latest_version,
  min_supported_version,
  force_update,
  update_url,
  updated_at
FROM public.admin_settings
WHERE id = 1;

-- Grant read access on the public view
GRANT SELECT ON public.app_version TO anon, authenticated;

-- Function: get_app_version_config()
CREATE OR REPLACE FUNCTION public.get_app_version_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT latest_version, min_supported_version, force_update, update_url
  INTO v_rec
  FROM public.admin_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'latest_version', '2.0.0',
      'min_supported_version', '2.0.0',
      'force_update', true,
      'update_url', 'https://github.com/moonlight-strikers/cricket-scoring-app/releases/latest'
    );
  END IF;

  RETURN jsonb_build_object(
    'latest_version', v_rec.latest_version,
    'min_supported_version', v_rec.min_supported_version,
    'force_update', v_rec.force_update,
    'update_url', v_rec.update_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_version_config() TO anon, authenticated;

-- ============================================================
-- 3. SERVER-SIDE SEMVER & REQUEST VERSION EVALUATION
-- Extracts 'x-app-version' header from PostgREST request headers
-- and performs numeric semantic version comparison.
-- ============================================================

-- Helper: Extract client version from HTTP headers
CREATE OR REPLACE FUNCTION public.get_request_app_version()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-app-version', ''),
    '0.0.0'
  );
$$;

-- Helper: Compare semantic versions (v_client >= v_min)
CREATE OR REPLACE FUNCTION public.semver_gte(v_client TEXT, v_min TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c_parts INT[];
  m_parts INT[];
BEGIN
  v_client := ltrim(coalesce(v_client, '0.0.0'), 'v');
  v_min := ltrim(coalesce(v_min, '0.0.0'), 'v');

  BEGIN
    SELECT array_agg(coalesce(nullif(part, '')::int, 0)) INTO c_parts
    FROM unnest(string_to_array(v_client, '.')) AS part;

    SELECT array_agg(coalesce(nullif(part, '')::int, 0)) INTO m_parts
    FROM unnest(string_to_array(v_min, '.')) AS part;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  -- Normalize to at least 3 parts (major, minor, patch)
  WHILE array_length(c_parts, 1) < 3 LOOP
    c_parts := array_append(c_parts, 0);
  END LOOP;
  WHILE array_length(m_parts, 1) < 3 LOOP
    m_parts := array_append(m_parts, 0);
  END LOOP;

  IF c_parts[1] > m_parts[1] THEN RETURN TRUE; END IF;
  IF c_parts[1] < m_parts[1] THEN RETURN FALSE; END IF;
  IF c_parts[2] > m_parts[2] THEN RETURN TRUE; END IF;
  IF c_parts[2] < m_parts[2] THEN RETURN FALSE; END IF;
  RETURN c_parts[3] >= m_parts[3];
END;
$$;

-- Helper: Check if client version satisfies minimum supported version
CREATE OR REPLACE FUNCTION public.is_client_version_supported()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min TEXT;
  v_client TEXT;
  v_force BOOLEAN;
BEGIN
  SELECT min_supported_version, force_update INTO v_min, v_force
  FROM public.admin_settings
  WHERE id = 1;

  -- If force_update is disabled or config row missing, allow access
  IF NOT FOUND OR v_force IS NOT TRUE OR v_min IS NULL THEN
    RETURN TRUE;
  END IF;

  v_client := public.get_request_app_version();
  RETURN public.semver_gte(v_client, v_min);
END;
$$;

-- ============================================================
-- 4. SERVER-SIDE AUTHORIZATION: TIGHTEN RLS POLICIES
-- Older APKs (versions < 2.0.0) that do not send 'x-app-version'
-- will be completely rejected by Supabase RLS on ALL operations:
-- SELECT (reading matches/players), INSERT (creating matches/players),
-- and UPDATE (scoring matches/deliveries).
-- ============================================================

-- ── Table: matches ──
DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.matches') IS NOT NULL THEN
    ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

    -- Drop ALL existing policies to eliminate permissive bypasses
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'matches'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.matches', r.policyname);
    END LOOP;

    -- SELECT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned select matches" ON public.matches FOR SELECT USING (public.is_client_version_supported())';

    -- INSERT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned insert matches" ON public.matches FOR INSERT WITH CHECK (public.is_client_version_supported())';

    -- UPDATE: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned update matches" ON public.matches FOR UPDATE USING (public.is_client_version_supported()) WITH CHECK (public.is_client_version_supported())';

    -- DELETE: Restricted completely (only Admin PIN RPC can delete)
    EXECUTE 'CREATE POLICY "Prevent public delete matches" ON public.matches FOR DELETE USING (false)';
  END IF;
END $$;

-- ── Table: ball_by_ball ──
DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.ball_by_ball') IS NOT NULL THEN
    ALTER TABLE public.ball_by_ball ENABLE ROW LEVEL SECURITY;

    -- Drop ALL existing policies on ball_by_ball
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ball_by_ball'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.ball_by_ball', r.policyname);
    END LOOP;

    -- SELECT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned select ball_by_ball" ON public.ball_by_ball FOR SELECT USING (public.is_client_version_supported())';

    -- INSERT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned insert ball_by_ball" ON public.ball_by_ball FOR INSERT WITH CHECK (public.is_client_version_supported())';

    -- UPDATE: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned update ball_by_ball" ON public.ball_by_ball FOR UPDATE USING (public.is_client_version_supported()) WITH CHECK (public.is_client_version_supported())';

    -- DELETE: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned delete ball_by_ball" ON public.ball_by_ball FOR DELETE USING (public.is_client_version_supported())';
  END IF;
END $$;

-- ── Table: players ──
DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.players') IS NOT NULL THEN
    ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

    -- Drop ALL existing policies on players
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'players'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', r.policyname);
    END LOOP;

    -- SELECT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned select players" ON public.players FOR SELECT USING (public.is_client_version_supported())';

    -- INSERT: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned insert players" ON public.players FOR INSERT WITH CHECK (public.is_client_version_supported())';

    -- UPDATE: Blocked for old APKs (< 2.0.0)
    EXECUTE 'CREATE POLICY "Allow versioned update players" ON public.players FOR UPDATE USING (public.is_client_version_supported()) WITH CHECK (public.is_client_version_supported())';

    -- DELETE: Restricted completely (only Admin PIN RPC can delete)
    EXECUTE 'CREATE POLICY "Prevent public delete players" ON public.players FOR DELETE USING (false)';
  END IF;
END $$;

-- ============================================================
-- 5. UPDATE RPC: undo_latest_delivery
-- Enforce minimum supported app version inside the Undo RPC.
-- ============================================================
CREATE OR REPLACE FUNCTION undo_latest_delivery(
  p_match_id UUID,
  p_innings_number INTEGER DEFAULT NULL,
  p_expected_ball_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest RECORD;
BEGIN
  -- Server-side version check: reject requests from outdated clients
  IF NOT public.is_client_version_supported() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'App update required: Please update MoonLight Strikers to version 2.0.0 to continue.'
    );
  END IF;

  -- Acquire row-level exclusive lock on the latest ball
  SELECT * INTO v_latest
  FROM ball_by_ball
  WHERE match_id = p_match_id
    AND (p_innings_number IS NULL OR innings_number = p_innings_number)
  ORDER BY delivery_sequence DESC, created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No deliveries found for undo in this innings'
    );
  END IF;

  IF p_expected_ball_id IS NOT NULL AND v_latest.id::text <> p_expected_ball_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Concurrency conflict: the latest delivery has already been modified or removed',
      'concurrent', true
    );
  END IF;

  DELETE FROM ball_by_ball WHERE id = v_latest.id;

  RETURN jsonb_build_object(
    'success', true,
    'removed_ball', to_jsonb(v_latest)
  );
END;
$$;
