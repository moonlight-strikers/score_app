-- ============================================================
-- MOONLIGHT STRIKERS — Fix Storage RLS for player-photos Bucket
-- Migration: 008_fix_storage_rls
-- ============================================================

-- 1. Ensure the bucket exists and is marked public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Drop any existing/restrictive policies on storage.objects for player-photos
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (
            policyname ILIKE '%player-photos%'
            OR policyname ILIKE '%player_photos%'
            OR qual ILIKE '%player-photos%'
            OR with_check ILIKE '%player-photos%'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 3. Create full public access policies for anon and authenticated users
CREATE POLICY "Allow public all on player-photos"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'player-photos')
WITH CHECK (bucket_id = 'player-photos');
