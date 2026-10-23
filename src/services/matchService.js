import { supabase, isSupabaseConfigured } from './supabase.js';

const LOCAL_STORAGE_KEY = 'ms_cricket_matches_cache';

const MATCH_COLUMNS = new Set([
  'id',
  'created_at',
  'updated_at',
  'title',
  'venue',
  'ball_type',
  'match_type',
  'overs',
  'max_overs_per_bowler',
  'team_a_name',
  'team_b_name',
  'team_a_score',
  'team_a_wickets',
  'team_a_overs',
  'team_b_score',
  'team_b_wickets',
  'team_b_overs',
  'toss_winner',
  'toss_decision',
  'current_batting_team',
  'current_bowling_team',
  'current_innings',
  'target',
  'status',
  'winner_team',
  'result',
  'recent_balls',
  'current_over_deliveries',
  'completed_overs',
  'striker',
  'non_striker',
  'bowler',
  'innings_data'
]);

function sanitizeMatch(matchData) {
  const clean = {};
  for (const [k, v] of Object.entries(matchData)) {
    if (MATCH_COLUMNS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

function getLocalMatches() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cleaned = Array.isArray(parsed)
      ? parsed.filter((m) => m && m.id && !m.id.startsWith('demo-'))
      : [];
    if (parsed && cleaned.length !== parsed.length) {
      saveLocalMatches(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalMatches(matches) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matches));
  } catch (err) {
    console.warn('Failed to save to localStorage', err);
  }
}

export const matchService = {
  async getMatches() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          saveLocalMatches(data);
          return data;
        }
        if (error) {
          console.warn('Supabase getMatches note:', error);
        }
      } catch (err) {
        console.warn('Supabase getMatches fallback:', err);
      }
    }
    return getLocalMatches();
  },

  async getMatchById(matchId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (!error && data) {
          // Update local cache for this match
          const local = getLocalMatches();
          const filtered = local.filter((m) => m.id !== matchId);
          saveLocalMatches([data, ...filtered]);
          return data;
        }
        if (error) {
          console.warn('Supabase getMatchById note:', error);
        }
      } catch (err) {
        console.warn('Supabase getMatchById fallback:', err);
      }
    }
    const local = getLocalMatches();
    return local.find((m) => m.id === matchId) || null;
  },

  async createMatch(matchData) {
    const matchId =
      matchData.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `match-${Date.now()}`);

    const newMatch = {
      id: matchId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'live',
      team_a_score: 0,
      team_a_wickets: 0,
      team_a_overs: '0.0',
      team_b_score: 0,
      team_b_wickets: 0,
      team_b_overs: '0.0',
      target: null,
      current_innings: 1,
      recent_balls: [],
      current_over_deliveries: [],
      completed_overs: [],
      ...matchData
    };

    const sanitized = sanitizeMatch(newMatch);

    // Save locally first
    const local = getLocalMatches();
    const updated = [newMatch, ...local.filter((m) => m.id !== newMatch.id)];
    saveLocalMatches(updated);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('matches')
        .upsert([sanitized])
        .select()
        .single();

      if (error) {
        console.error('Supabase createMatch error:', error);
        throw new Error(error.message || 'Failed to create match on server');
      }
      return data || newMatch;
    }

    return newMatch;
  },

  async updateMatch(matchId, updates) {
    const cleanUpdates = sanitizeMatch({
      ...updates,
      id: matchId,
      updated_at: new Date().toISOString()
    });

    // 1. Immediately update localStorage
    const local = getLocalMatches();
    let updatedMatch = null;
    const updated = local.map((m) => {
      if (m.id === matchId) {
        updatedMatch = { ...m, ...updates };
        return updatedMatch;
      }
      return m;
    });
    saveLocalMatches(updated);

    // 2. Update Supabase via upsert so missing rows are inserted automatically
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('matches')
        .upsert([cleanUpdates])
        .select()
        .single();

      if (error) {
        console.error('Supabase updateMatch error:', error);
        throw new Error(error.message || 'Failed to update match on server');
      }
      return data || updatedMatch || updates;
    }

    return updatedMatch || updates;
  },

  async deleteMatch(matchId) {
    const local = getLocalMatches();
    saveLocalMatches(local.filter((m) => m.id !== matchId));

    if (isSupabaseConfigured) {
      // 1. Cascade delete all balls
      await supabase.from('ball_by_ball').delete().eq('match_id', matchId);

      // 2. Delete match
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) {
        console.error('Supabase deleteMatch error:', error);
        throw new Error(error.message || 'Failed to delete match from server');
      }
    }

    return true;
  }
};
