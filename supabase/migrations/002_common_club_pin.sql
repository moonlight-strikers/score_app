-- ============================================================
-- MOONLIGHT STRIKERS — Common Club Login PIN & Security
-- Migration: 002_common_club_pin
-- ============================================================

-- ── Enable pgcrypto for secure server-side PIN hashing ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. CLUB SECURITY TABLE
-- Stores salted, securely hashed Common Club Login PIN.
-- Shared for all club scorers & members.
-- Public/anon users CANNOT read or query this table directly.
-- ============================================================
CREATE TABLE IF NOT EXISTS club_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name TEXT NOT NULL DEFAULT 'MoonLight Strikers',
  pin_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE club_security ENABLE ROW LEVEL SECURITY;
-- Direct table access locked from public. Accessed exclusively through SECURITY DEFINER RPCs below.

-- ============================================================
-- 2. FUNCTION: set_club_login_pin
-- Updates the Common Club PIN using salted Blowfish hashing.
-- ============================================================
CREATE OR REPLACE FUNCTION set_club_login_pin(
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salt TEXT;
  v_hash TEXT;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Club PIN must be 4 to 6 numeric digits');
  END IF;

  v_salt := gen_salt('bf', 10);
  v_hash := crypt(p_pin, v_salt);

  -- Upsert club pin record
  IF EXISTS (SELECT 1 FROM club_security WHERE club_name = 'MoonLight Strikers') THEN
    UPDATE club_security
    SET pin_hash = v_hash,
        salt = v_salt,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE club_name = 'MoonLight Strikers';
  ELSE
    INSERT INTO club_security (club_name, pin_hash, salt, failed_attempts, updated_at)
    VALUES ('MoonLight Strikers', v_hash, v_salt, 0, now());
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. FUNCTION: verify_club_login_pin
-- Server-side PIN verification with brute-force lockout protection.
-- ============================================================
CREATE OR REPLACE FUNCTION verify_club_login_pin(
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_is_correct BOOLEAN;
  v_attempts_left INTEGER;
BEGIN
  SELECT * INTO v_rec
  FROM club_security
  WHERE club_name = 'MoonLight Strikers'
  LIMIT 1;

  -- If not configured yet, check default PIN '123456'
  IF NOT FOUND THEN
    IF p_pin = '123456' THEN
      RETURN jsonb_build_object('success', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Incorrect Club PIN (Default is 123456)');
    END IF;
  END IF;

  -- Check lockout
  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many failed attempts. Club PIN entry is temporarily locked.',
      'locked', true,
      'locked_until', v_rec.locked_until
    );
  END IF;

  -- Secure cryptographic comparison
  v_is_correct := (v_rec.pin_hash = crypt(p_pin, v_rec.pin_hash));

  IF NOT v_is_correct THEN
    UPDATE club_security
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE
          WHEN failed_attempts + 1 >= 5 THEN now() + INTERVAL '15 minutes'
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = v_rec.id;

    v_attempts_left := GREATEST(0, 5 - (v_rec.failed_attempts + 1));

    IF v_attempts_left = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid PIN. Maximum attempts exceeded. Locked for 15 minutes.',
        'locked', true
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Incorrect Club PIN. ' || v_attempts_left || ' attempt(s) remaining.',
        'attempts_left', v_attempts_left
      );
    END IF;
  END IF;

  -- Success: reset failed attempts
  UPDATE club_security
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE id = v_rec.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Seed default club PIN '123456'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM club_security WHERE club_name = 'MoonLight Strikers') THEN
    PERFORM set_club_login_pin('123456');
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION set_club_login_pin(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_club_login_pin(TEXT) TO authenticated, anon;
