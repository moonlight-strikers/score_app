-- ============================================================
-- MOONLIGHT STRIKERS — Initial Database Schema
-- Migration: 001_initial_schema
-- ============================================================

-- ── Enable UUID extension ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'scorer', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. CRICKET GROUPS (CLUBS)
-- ============================================================
CREATE TABLE IF NOT EXISTS cricket_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cricket_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups viewable by members"
  ON cricket_groups FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = cricket_groups.id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert groups"
  ON cricket_groups FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update"
  ON cricket_groups FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = cricket_groups.id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- ============================================================
-- 3. GROUP MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES cricket_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'scorer', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage members"
  ON group_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = auth.uid()
        AND gm2.role = 'admin'
    )
  );

-- ============================================================
-- 4. PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES cricket_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  batting_style TEXT DEFAULT 'right-handed',
  bowling_style TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_group ON players(group_id);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view players"
  ON players FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = players.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins/managers can manage players"
  ON players FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = players.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 5. MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES cricket_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  team_a_name TEXT NOT NULL,
  team_b_name TEXT NOT NULL,
  total_overs INTEGER NOT NULL DEFAULT 20 CHECK (total_overs > 0 AND total_overs <= 50),
  balls_per_over INTEGER NOT NULL DEFAULT 6 CHECK (balls_per_over > 0),
  toss_winner TEXT CHECK (toss_winner IN ('team_a', 'team_b')),
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'abandoned')),
  visibility TEXT NOT NULL DEFAULT 'club' CHECK (visibility IN ('club', 'public')),
  notes TEXT,
  -- Denormalized score summary for fast queries
  team_a_score INTEGER DEFAULT 0,
  team_a_wickets INTEGER DEFAULT 0,
  team_a_overs TEXT DEFAULT '0.0',
  team_b_score INTEGER DEFAULT 0,
  team_b_wickets INTEGER DEFAULT 0,
  team_b_overs TEXT DEFAULT '0.0',
  current_innings INTEGER DEFAULT 1,
  winner_team TEXT,
  result_text TEXT,
  match_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_group ON matches(group_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_date ON matches(match_date DESC);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Public matches or club member matches
CREATE POLICY "Matches viewable by members or public"
  ON matches FOR SELECT USING (
    visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = matches.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins/managers can create matches"
  ON matches FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = matches.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins/managers can update matches"
  ON matches FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = matches.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 6. MATCH TEAMS (which players are on which team)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('team_a', 'team_b')),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  batting_order INTEGER,
  is_captain BOOLEAN DEFAULT false,
  is_keeper BOOLEAN DEFAULT false,
  UNIQUE(match_id, player_id)
);

CREATE INDEX idx_match_teams_match ON match_teams(match_id);

ALTER TABLE match_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match teams viewable with match"
  ON match_teams FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_teams.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Admins/managers can manage match teams"
  ON match_teams FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches
      JOIN group_members ON group_members.group_id = matches.group_id
      WHERE matches.id = match_teams.match_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 7. MATCH ASSIGNMENTS (manager, scorers)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'scorer')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id, role)
);

CREATE INDEX idx_match_assignments_match ON match_assignments(match_id);

ALTER TABLE match_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignments viewable with match"
  ON match_assignments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_assignments.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Admins/managers can manage assignments"
  ON match_assignments FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches
      JOIN group_members ON group_members.group_id = matches.group_id
      WHERE matches.id = match_assignments.match_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 8. INNINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS innings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_number INTEGER NOT NULL CHECK (innings_number IN (1, 2)),
  batting_team TEXT NOT NULL CHECK (batting_team IN ('team_a', 'team_b')),
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_wickets INTEGER NOT NULL DEFAULT 0,
  total_legal_balls INTEGER NOT NULL DEFAULT 0,
  total_extras INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  target_runs INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, innings_number)
);

CREATE INDEX idx_innings_match ON innings(match_id);

ALTER TABLE innings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Innings viewable with match"
  ON innings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = innings.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Scorers can manage innings"
  ON innings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM match_assignments
      WHERE match_assignments.match_id = innings.match_id
        AND match_assignments.user_id = auth.uid()
        AND match_assignments.role IN ('manager', 'scorer')
    )
  );

-- ============================================================
-- 9. BALL EVENTS (the core scoring table)
-- ============================================================
CREATE TABLE IF NOT EXISTS ball_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  delivery_sequence INTEGER NOT NULL,
  over_number INTEGER NOT NULL,
  ball_in_over INTEGER NOT NULL,
  striker_id UUID NOT NULL REFERENCES players(id),
  non_striker_id UUID NOT NULL REFERENCES players(id),
  bowler_id UUID NOT NULL REFERENCES players(id),
  bat_runs INTEGER NOT NULL DEFAULT 0 CHECK (bat_runs >= 0),
  extra_type TEXT CHECK (extra_type IN ('wide', 'no_ball', 'bye', 'leg_bye', NULL)),
  extra_runs INTEGER NOT NULL DEFAULT 0 CHECK (extra_runs >= 0),
  total_runs INTEGER NOT NULL DEFAULT 0,
  is_legal BOOLEAN NOT NULL DEFAULT true,
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT CHECK (wicket_type IN (
    'bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket',
    'caught_and_bowled', 'retired', NULL
  )),
  dismissed_player_id UUID REFERENCES players(id),
  is_boundary_four BOOLEAN NOT NULL DEFAULT false,
  is_boundary_six BOOLEAN NOT NULL DEFAULT false,
  commentary TEXT,
  is_void BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  idempotency_key TEXT UNIQUE,
  scored_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(innings_id, delivery_sequence)
);

CREATE INDEX idx_ball_events_innings ON ball_events(innings_id, delivery_sequence);
CREATE INDEX idx_ball_events_match ON ball_events(match_id);
CREATE INDEX idx_ball_events_striker ON ball_events(striker_id);
CREATE INDEX idx_ball_events_bowler ON ball_events(bowler_id);

ALTER TABLE ball_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ball events viewable with match"
  ON ball_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = ball_events.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Scorers can insert ball events"
  ON ball_events FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM match_assignments
      WHERE match_assignments.match_id = ball_events.match_id
        AND match_assignments.user_id = auth.uid()
        AND match_assignments.role IN ('manager', 'scorer')
    )
  );

CREATE POLICY "Scorers can update ball events"
  ON ball_events FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM match_assignments
      WHERE match_assignments.match_id = ball_events.match_id
        AND match_assignments.user_id = auth.uid()
        AND match_assignments.role IN ('manager', 'scorer')
    )
  );

-- ============================================================
-- 10. SCORING LOCKS (prevent concurrent scoring conflicts)
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE UNIQUE,
  locked_by UUID NOT NULL REFERENCES profiles(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE scoring_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locks viewable by match scorers"
  ON scoring_locks FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM innings
      JOIN match_assignments ON match_assignments.match_id = innings.match_id
      WHERE innings.id = scoring_locks.innings_id
        AND match_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Scorers can manage locks"
  ON scoring_locks FOR ALL USING (
    EXISTS (
      SELECT 1 FROM innings
      JOIN match_assignments ON match_assignments.match_id = innings.match_id
      WHERE innings.id = scoring_locks.innings_id
        AND match_assignments.user_id = auth.uid()
        AND match_assignments.role IN ('manager', 'scorer')
    )
  );

-- ============================================================
-- 11. SCORE CORRECTIONS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS score_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ball_event_id UUID NOT NULL REFERENCES ball_events(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  corrected_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  old_data JSONB NOT NULL,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_corrections_match ON score_corrections(match_id);

ALTER TABLE score_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corrections viewable with match"
  ON score_corrections FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = score_corrections.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Scorers can insert corrections"
  ON score_corrections FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM match_assignments
      WHERE match_assignments.match_id = score_corrections.match_id
        AND match_assignments.user_id = auth.uid()
        AND match_assignments.role IN ('manager', 'scorer')
    )
  );

-- ============================================================
-- 12. MATCH AWARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  award_type TEXT NOT NULL CHECK (award_type IN ('player_of_match', 'best_batter', 'best_bowler')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, award_type)
);

ALTER TABLE match_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Awards viewable with match"
  ON match_awards FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_awards.match_id
        AND (
          matches.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = matches.group_id
              AND group_members.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Admins/managers can manage awards"
  ON match_awards FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches
      JOIN group_members ON group_members.group_id = matches.group_id
      WHERE matches.id = match_awards.match_id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 13. REALTIME — Enable for live scoring
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE innings;
ALTER PUBLICATION supabase_realtime ADD TABLE ball_events;
