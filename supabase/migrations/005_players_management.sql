-- ============================================================
-- MOONLIGHT STRIKERS — Centralized Players Management Table
-- Migration: 005_players_management
-- ============================================================

-- 1. Create the players table
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Case-insensitive unique index on trimmed full_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_name
  ON public.players (LOWER(TRIM(full_name)));

-- 3. Fast lookup index on player_id (P001, P002, etc.)
CREATE INDEX IF NOT EXISTS idx_players_player_id
  ON public.players (player_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies for public access (Scoring App)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public select players'
  ) THEN
    CREATE POLICY "Allow public select players" ON public.players FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public insert players'
  ) THEN
    CREATE POLICY "Allow public insert players" ON public.players FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public update players'
  ) THEN
    CREATE POLICY "Allow public update players" ON public.players FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Pre-seed initial squad (Skipped automatically if player_id exists)
INSERT INTO public.players (id, player_id, full_name, name)
VALUES
  ('p_p001', 'P001', 'ASHOK', 'ASHOK'),
  ('p_p002', 'P002', 'ROHIT', 'ROHIT'),
  ('p_p003', 'P003', 'BUMRAH', 'BUMRAH'),
  ('p_p004', 'P004', 'KRISHNA', 'KRISHNA'),
  ('p_p005', 'P005', 'GOPI', 'GOPI'),
  ('p_p006', 'P006', 'ARUN', 'ARUN'),
  ('p_p007', 'P007', 'DINESH', 'DINESH'),
  ('p_p008', 'P008', 'AAKASH', 'AAKASH'),
  ('p_p009', 'P009', 'VIKRAM', 'VIKRAM'),
  ('p_p010', 'P010', 'HARISH', 'HARISH'),
  ('p_p011', 'P011', 'RAMESH', 'RAMESH'),
  ('p_p012', 'P012', 'MANOJ', 'MANOJ')
ON CONFLICT (player_id) DO NOTHING;
