-- ============================================================
-- MOONLIGHT STRIKERS — Player Photo Management & Storage
-- Migration: 007_player_photos_storage
-- ============================================================

-- 1. Add photo_url column to existing public.players table (non-destructive)
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

-- 2. Create the player-photos storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3. Configure Row Level Security (RLS) on storage.objects for player-photos
DO $$
BEGIN
  -- Policy: Public Read Access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for player-photos'
  ) THEN
    CREATE POLICY "Public Access for player-photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'player-photos');
  END IF;

  -- Policy: Public Insert/Upload Access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public uploads to player-photos'
  ) THEN
    CREATE POLICY "Allow public uploads to player-photos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'player-photos');
  END IF;

  -- Policy: Public Update Access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public updates to player-photos'
  ) THEN
    CREATE POLICY "Allow public updates to player-photos"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'player-photos')
      WITH CHECK (bucket_id = 'player-photos');
  END IF;

  -- Policy: Public Delete Access (for photo replacement/removal)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public deletes from player-photos'
  ) THEN
    CREATE POLICY "Allow public deletes from player-photos"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'player-photos');
  END IF;
END $$;
