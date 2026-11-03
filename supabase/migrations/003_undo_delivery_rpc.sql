-- ============================================================
-- MOONLIGHT STRIKERS — Safe Atomic Undo Delivery RPC
-- Migration: 003_undo_delivery_rpc
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
  -- Acquire row-level exclusive lock on the latest ball of the innings to prevent race conditions
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

  -- Optimistic concurrency check if expected ball ID was specified
  IF p_expected_ball_id IS NOT NULL AND v_latest.id::text <> p_expected_ball_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Concurrency conflict: the latest delivery has already been modified or removed',
      'concurrent', true
    );
  END IF;

  -- Delete the target delivery
  DELETE FROM ball_by_ball WHERE id = v_latest.id;

  RETURN jsonb_build_object(
    'success', true,
    'removed_ball', to_jsonb(v_latest)
  );
END;
$$;
