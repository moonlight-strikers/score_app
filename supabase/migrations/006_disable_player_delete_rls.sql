-- ============================================================
-- MOONLIGHT STRIKERS — Restrict Player Deletion to Supabase Dashboard
-- Migration: 006_disable_player_delete_rls
-- ============================================================

-- 1. Drop the public DELETE policy so regular application users cannot delete players
DROP POLICY IF EXISTS "Allow public delete players" ON public.players;

-- 2. Verify that Row Level Security remains active
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 3. Ensure SELECT, INSERT, and UPDATE policies remain active for the scoring application
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
