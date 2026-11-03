-- ============================================================
-- MOONLIGHT STRIKERS — Configurable Test Cricket & Multi-Innings
-- Migration: 004_test_cricket_innings.sql (Type-Adaptive Safe Version)
-- ============================================================
-- CRITICAL SAFETY RULES:
-- 1. NEVER drops existing tables, records, or columns.
-- 2. Fully idempotent (safe to run multiple times).
-- 3. Dynamically adapts to matches.id data type (TEXT vs UUID).
-- 4. Preserves all existing matches and ball-by-ball records.
-- ============================================================

-- ── 1. UPDATE 'matches' TABLE ──
-- Safely add multi-innings configuration columns
DO $$
BEGIN
  -- Add configured_innings (default 2 for limited overs, 2/4/6 for Test)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'configured_innings'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN configured_innings INTEGER NOT NULL DEFAULT 2;
  END IF;

  -- Add overs_per_innings (custom overs per innings for Test matches)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'overs_per_innings'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN overs_per_innings INTEGER;
  END IF;

  -- Ensure current_innings column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'current_innings'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN current_innings INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Ensure status column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN status TEXT NOT NULL DEFAULT 'live';
  END IF;
END $$;


-- ── 2. CREATE OR SAFELY UPDATE 'innings' TABLE (TYPE-ADAPTIVE) ──
-- Detects if public.matches.id is TEXT or UUID to avoid PostgreSQL Error 42804
DO $$
DECLARE
  v_match_id_type TEXT;
BEGIN
  SELECT data_type INTO v_match_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'id';

  IF v_match_id_type IS NULL THEN
    v_match_id_type := 'text';
  END IF;

  -- Create innings table if not yet existing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'innings'
  ) THEN
    IF v_match_id_type = 'uuid' THEN
      CREATE TABLE public.innings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
        innings_number INTEGER NOT NULL,
        batting_team TEXT NOT NULL,
        bowling_team TEXT NOT NULL DEFAULT '',
        total_runs INTEGER NOT NULL DEFAULT 0,
        wickets INTEGER NOT NULL DEFAULT 0,
        overs_completed INTEGER NOT NULL DEFAULT 0,
        balls_completed INTEGER NOT NULL DEFAULT 0,
        extras INTEGER NOT NULL DEFAULT 0,
        innings_status TEXT NOT NULL DEFAULT 'upcoming' CHECK (innings_status IN ('upcoming', 'live', 'completed')),
        target INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    ELSE
      -- matches.id is TEXT (matches user's existing database schema)
      CREATE TABLE public.innings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
        innings_number INTEGER NOT NULL,
        batting_team TEXT NOT NULL,
        bowling_team TEXT NOT NULL DEFAULT '',
        total_runs INTEGER NOT NULL DEFAULT 0,
        wickets INTEGER NOT NULL DEFAULT 0,
        overs_completed INTEGER NOT NULL DEFAULT 0,
        balls_completed INTEGER NOT NULL DEFAULT 0,
        extras INTEGER NOT NULL DEFAULT 0,
        innings_status TEXT NOT NULL DEFAULT 'upcoming' CHECK (innings_status IN ('upcoming', 'live', 'completed')),
        target INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    END IF;
  ELSE
    -- Table already existed, ensure match_id column and foreign key are configured correctly
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'match_id'
    ) THEN
      IF v_match_id_type = 'uuid' THEN
        ALTER TABLE public.innings ADD COLUMN match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE;
      ELSE
        ALTER TABLE public.innings ADD COLUMN match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- Ensure all required columns exist on 'innings' safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'bowling_team'
  ) THEN
    ALTER TABLE public.innings ADD COLUMN bowling_team TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'innings_status'
  ) THEN
    ALTER TABLE public.innings ADD COLUMN innings_status TEXT NOT NULL DEFAULT 'upcoming';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'balls_completed'
  ) THEN
    ALTER TABLE public.innings ADD COLUMN balls_completed INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'extras'
  ) THEN
    ALTER TABLE public.innings ADD COLUMN extras INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'target'
  ) THEN
    ALTER TABLE public.innings ADD COLUMN target INTEGER;
  END IF;
END $$;

-- Drop restrictive legacy check constraints on innings_number or batting_team if any exist
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'innings'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name IN ('innings_number', 'batting_team')
  ) LOOP
    EXECUTE 'ALTER TABLE public.innings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- Add UNIQUE constraint on (match_id, innings_number) safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'innings'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'innings_match_id_innings_number_key'
  ) THEN
    ALTER TABLE public.innings
      ADD CONSTRAINT innings_match_id_innings_number_key UNIQUE (match_id, innings_number);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_innings_match_id ON public.innings(match_id);
CREATE INDEX IF NOT EXISTS idx_innings_match_num ON public.innings(match_id, innings_number);


-- ── 3. UPDATE 'ball_by_ball' TABLE (TYPE-ADAPTIVE) ──
DO $$
DECLARE
  v_innings_id_type TEXT;
BEGIN
  SELECT data_type INTO v_innings_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'innings' AND column_name = 'id';

  IF v_innings_id_type IS NULL THEN
    v_innings_id_type := 'text';
  END IF;

  -- Add innings_id foreign key if not already present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ball_by_ball' AND column_name = 'innings_id'
  ) THEN
    IF v_innings_id_type = 'uuid' THEN
      ALTER TABLE public.ball_by_ball ADD COLUMN innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE public.ball_by_ball ADD COLUMN innings_id TEXT REFERENCES public.innings(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Ensure innings_number column exists for backward compatibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ball_by_ball' AND column_name = 'innings_number'
  ) THEN
    ALTER TABLE public.ball_by_ball ADD COLUMN innings_number INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ball_innings_id ON public.ball_by_ball(innings_id);
CREATE INDEX IF NOT EXISTS idx_ball_match_innings_seq ON public.ball_by_ball(match_id, innings_number, delivery_sequence);


-- ── 4. ROW LEVEL SECURITY (RLS) FOR 'innings' ──
ALTER TABLE public.innings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'innings' AND policyname = 'Anyone can view innings'
  ) THEN
    CREATE POLICY "Anyone can view innings" ON public.innings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'innings' AND policyname = 'Anyone can insert innings'
  ) THEN
    CREATE POLICY "Anyone can insert innings" ON public.innings FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'innings' AND policyname = 'Anyone can update innings'
  ) THEN
    CREATE POLICY "Anyone can update innings" ON public.innings FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'innings' AND policyname = 'Anyone can delete innings'
  ) THEN
    CREATE POLICY "Anyone can delete innings" ON public.innings FOR DELETE USING (true);
  END IF;
END $$;


-- ── 5. SUPABASE REALTIME REPLICATION ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.innings;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ── 6. RELOAD POSTGREST SCHEMA CACHE ──
-- Immediately clears schema cache so new columns (like innings_id) are instantly available to Supabase clients
NOTIFY pgrst, 'reload schema';

