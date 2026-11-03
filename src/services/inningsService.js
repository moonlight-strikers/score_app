import { supabase, isSupabaseConfigured } from './supabase.js';

const INNINGS_COLUMNS = new Set([
  'id',
  'match_id',
  'innings_number',
  'batting_team',
  'bowling_team',
  'total_runs',
  'wickets',
  'overs_completed',
  'balls_completed',
  'extras',
  'innings_status',
  'target',
  'created_at',
  'updated_at'
]);

function sanitizeInnings(item) {
  const clean = {};
  for (const [k, v] of Object.entries(item)) {
    if (INNINGS_COLUMNS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

function getLocalInnings(matchId) {
  try {
    const raw = localStorage.getItem(`ms_innings_${matchId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInnings(matchId, inningsList) {
  try {
    localStorage.setItem(`ms_innings_${matchId}`, JSON.stringify(inningsList));
  } catch (err) {
    console.warn('Failed to save innings to localStorage', err);
  }
}

export const inningsService = {
  /**
   * Generates the initial innings schedule for a match based on configured innings and toss.
   * Alternates batting and bowling teams in order.
   * - Innings 1: Batting First vs Bowling First (status: live)
   * - Innings 2..N: Alternating teams (status: upcoming)
   */
  generateInningsPlan(matchId, configuredInnings = 4, battingFirst, bowlingFirst) {
    const totalInnings = Math.max(1, Math.min(Number(configuredInnings) || 4, 6));
    const list = [];

    for (let i = 1; i <= totalInnings; i++) {
      // Odd innings (1, 3, 5): battingFirst bats, bowlingFirst bowls
      // Even innings (2, 4, 6): bowlingFirst bats, battingFirst bowls
      const isOdd = i % 2 === 1;
      const battingTeam = isOdd ? battingFirst : bowlingFirst;
      const bowlingTeam = isOdd ? bowlingFirst : battingFirst;

      list.push({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inn-${matchId}-${i}`),
        match_id: matchId,
        innings_number: i,
        batting_team: battingTeam,
        bowling_team: bowlingTeam,
        total_runs: 0,
        wickets: 0,
        overs_completed: 0,
        balls_completed: 0,
        extras: 0,
        innings_status: i === 1 ? 'live' : 'upcoming',
        target: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return list;
  },

  /**
   * Initializes all innings records in Supabase and local storage upon match creation.
   */
  async createInningsForMatch(matchId, configuredInnings, battingFirst, bowlingFirst) {
    const initialList = this.generateInningsPlan(matchId, configuredInnings, battingFirst, bowlingFirst);
    saveLocalInnings(matchId, initialList);

    if (isSupabaseConfigured) {
      try {
        const sanitized = initialList.map(sanitizeInnings);
        const { data, error } = await supabase
          .from('innings')
          .upsert(sanitized, { onConflict: 'match_id,innings_number' })
          .select();

        if (error) {
          console.warn('Supabase createInningsForMatch note:', error.message);
        } else if (data && data.length > 0) {
          saveLocalInnings(matchId, data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase createInningsForMatch fallback:', err);
      }
    }

    return initialList;
  },

  /**
   * Fetch all innings for a match ordered by innings_number ascending.
   */
  async getInningsByMatch(matchId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('innings')
          .select('*')
          .eq('match_id', matchId)
          .order('innings_number', { ascending: true });

        if (!error && data && data.length > 0) {
          saveLocalInnings(matchId, data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase getInningsByMatch fallback:', err);
      }
    }

    return getLocalInnings(matchId);
  },

  /**
   * Update an individual innings record (e.g. scores, status, target, overs).
   */
  async updateInnings(inningsId, updates) {
    let matchId = updates.match_id;
    if (!matchId && typeof localStorage !== 'undefined') {
      // Find matchId from cached storage if not explicitly provided
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ms_innings_')) {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          if (list.some((inn) => inn.id === inningsId)) {
            matchId = key.replace('ms_innings_', '');
            break;
          }
        }
      }
    }

    if (matchId) {
      const local = getLocalInnings(matchId);
      const updated = local.map((inn) => (inn.id === inningsId ? { ...inn, ...updates, updated_at: new Date().toISOString() } : inn));
      saveLocalInnings(matchId, updated);
    }

    if (isSupabaseConfigured) {
      try {
        const clean = sanitizeInnings({
          ...updates,
          id: inningsId,
          updated_at: new Date().toISOString()
        });

        const { data, error } = await supabase
          .from('innings')
          .update(clean)
          .eq('id', inningsId)
          .select()
          .single();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase updateInnings fallback:', err);
      }
    }

    return updates;
  },

  /**
   * Delete all innings records associated with a match.
   */
  async deleteInningsByMatch(matchId) {
    try {
      localStorage.removeItem(`ms_innings_${matchId}`);
    } catch (e) {
      console.warn('Error removing local innings:', e);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('innings')
          .delete()
          .eq('match_id', matchId);
      } catch (err) {
        console.warn('Supabase deleteInningsByMatch note:', err);
      }
    }
  }
};
