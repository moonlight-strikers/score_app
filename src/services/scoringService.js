import { supabase, isSupabaseConfigured } from './supabase.js';
import { isLegalDelivery, formatOvers } from '../utils/cricketRules.js';

const BALL_COLUMNS = new Set([
  'id',
  'match_id',
  'innings_number',
  'over_number',
  'ball_number',
  'delivery_sequence',
  'striker_name',
  'bowler_name',
  'runs',
  'type',
  'batsman_runs',
  'extras',
  'wicket',
  'idempotency_key',
  'created_at'
]);

function sanitizeBall(ball) {
  const clean = {};
  for (const [k, v] of Object.entries(ball)) {
    if (BALL_COLUMNS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

export const scoringService = {
  /**
   * Record a ball delivery in Supabase ball_by_ball table and sync to local storage.
   * Throws on Supabase error so caller can display it and abort state mutation.
   */
  async recordBall(matchId, ballData, idempotencyKey = null) {
    const key = idempotencyKey || `ball_${matchId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const ballPayload = sanitizeBall({
      match_id: matchId,
      ...ballData,
      idempotency_key: key
    });

    let savedBall = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('ball_by_ball')
        .insert([ballPayload])
        .select()
        .single();

      if (error) {
        console.error('Supabase recordBall error:', error);
        throw new Error(error.message || 'Failed to persist delivery to database');
      }
      savedBall = data;
    }

    // Local / Offline backup
    const storageKey = `ms_balls_${matchId}`;
    try {
      const existingRaw = localStorage.getItem(storageKey);
      const balls = existingRaw ? JSON.parse(existingRaw) : [];

      if (!balls.some((b) => b.idempotency_key === key)) {
        const newLocalBall = savedBall || {
          id: `ball-${Date.now()}`,
          ...ballPayload,
          created_at: new Date().toISOString()
        };
        balls.push(newLocalBall);
        localStorage.setItem(storageKey, JSON.stringify(balls));
        if (!savedBall) savedBall = newLocalBall;
      }
    } catch (e) {
      console.warn('Failed to save ball to localStorage', e);
    }

    return { success: true, data: savedBall };
  },

  /**
   * Undo last delivery from database and local storage.
   */
  async undoBall(matchId) {
    let removedBall = null;

    if (isSupabaseConfigured) {
      const { data: latestBall, error: findError } = await supabase
        .from('ball_by_ball')
        .select('*')
        .eq('match_id', matchId)
        .order('delivery_sequence', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error('Supabase undoBall find error:', findError);
        throw new Error(findError.message || 'Failed to locate last delivery for undo');
      }

      if (latestBall) {
        const { error: delError } = await supabase
          .from('ball_by_ball')
          .delete()
          .eq('id', latestBall.id);

        if (delError) {
          console.error('Supabase undoBall delete error:', delError);
          throw new Error(delError.message || 'Failed to remove delivery from database');
        }
        removedBall = latestBall;
      }
    }

    // Local backup undo
    const storageKey = `ms_balls_${matchId}`;
    try {
      const existingRaw = localStorage.getItem(storageKey);
      if (existingRaw) {
        const balls = JSON.parse(existingRaw);
        if (balls.length > 0) {
          const popped = balls.pop();
          localStorage.setItem(storageKey, JSON.stringify(balls));
          if (!removedBall) removedBall = popped;
        }
      }
    } catch (e) {
      console.warn('Failed to undo ball locally', e);
    }

    return { success: true, removed: removedBall };
  },

  /**
   * Retrieve all deliveries for a match or specific innings.
   */
  async getInningsBalls(matchId, inningsNumber = null) {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('ball_by_ball')
          .select('*')
          .eq('match_id', matchId)
          .order('delivery_sequence', { ascending: true });

        if (inningsNumber) {
          query = query.eq('innings_number', inningsNumber);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data;
        }
        if (error) {
          console.warn('Supabase getInningsBalls note:', error);
        }
      } catch (err) {
        console.warn('Supabase getInningsBalls fallback:', err);
      }
    }

    // Local fallback
    const storageKey = `ms_balls_${matchId}`;
    try {
      const existingRaw = localStorage.getItem(storageKey);
      const balls = existingRaw ? JSON.parse(existingRaw) : [];
      if (inningsNumber) {
        return balls.filter((b) => Number(b.innings_number) === Number(inningsNumber));
      }
      return balls;
    } catch {
      return [];
    }
  },

  /**
   * Calculates comprehensive innings score & stats strictly derived from persisted balls.
   */
  calculateInningsScore(balls = []) {
    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;
    let extras = { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 };
    const recentLabels = [];
    let currentOverDeliveries = [];
    let completedOvers = [];
    const battersMap = {};
    const bowlersMap = {};

    balls.forEach((b) => {
      const ballRuns = Number(b.runs) || 0;
      const batRuns = Number(b.batsman_runs) || 0;
      runs += ballRuns;

      const t = (b.type || 'normal').toLowerCase();
      const legal = isLegalDelivery(t);
      if (legal) legalBalls++;

      // Extras breakdown
      if (t === 'wide' || t === 'wd') {
        extras.wides += ballRuns;
        extras.total += ballRuns;
      } else if (t === 'no_ball' || t === 'nb') {
        const extraPortion = Math.max(1, ballRuns - batRuns);
        extras.noballs += extraPortion;
        extras.total += extraPortion;
      } else if (t === 'bye') {
        extras.byes += ballRuns;
        extras.total += ballRuns;
      } else if (t === 'leg_bye' || t === 'legbye') {
        extras.legbyes += ballRuns;
        extras.total += ballRuns;
      }

      // Ball label formatting for UI badge
      let label = `${ballRuns}`;
      if (b.wicket) {
        wickets++;
        label = 'W';
      } else if (t === 'wide' || t === 'wd') {
        label = ballRuns > 1 ? `${ballRuns}Wd` : 'Wd';
      } else if (t === 'no_ball' || t === 'nb') {
        label = ballRuns > 1 ? `${ballRuns}Nb` : 'Nb';
      } else if (t === 'bye') {
        label = `${ballRuns}B`;
      } else if (t === 'leg_bye' || t === 'legbye') {
        label = `${ballRuns}Lb`;
      }

      recentLabels.push(label);

      // Over tracking
      currentOverDeliveries.push(label);
      if (legal && legalBalls % 6 === 0) {
        completedOvers.push({
          overNumber: legalBalls / 6,
          bowler: b.bowler_name || 'Bowler',
          deliveries: [...currentOverDeliveries],
          runs: currentOverDeliveries.reduce((acc, lbl) => {
            const m = lbl.match(/\d+/);
            return acc + (m ? parseInt(m[0], 10) : (lbl.includes('Wd') || lbl.includes('Nb') ? 1 : 0));
          }, 0)
        });
        currentOverDeliveries = [];
      }

      // Batter stats
      if (b.striker_name) {
        if (!battersMap[b.striker_name]) {
          battersMap[b.striker_name] = { name: b.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true };
        }
        battersMap[b.striker_name].runs += batRuns;
        if (t !== 'wide' && t !== 'wd') {
          battersMap[b.striker_name].balls++;
        }
        if (batRuns === 4) battersMap[b.striker_name].fours++;
        if (batRuns === 6) battersMap[b.striker_name].sixes++;
        if (b.wicket && (b.wicket.playerOut === b.striker_name || b.wicket.isStriker)) {
          battersMap[b.striker_name].notOut = false;
          battersMap[b.striker_name].dismissal = b.wicket.wicketType || 'Out';
        }
      }

      // Bowler stats
      if (b.bowler_name) {
        if (!bowlersMap[b.bowler_name]) {
          bowlersMap[b.bowler_name] = { name: b.bowler_name, legalBalls: 0, runs: 0, wickets: 0 };
        }
        if (legal) bowlersMap[b.bowler_name].legalBalls++;
        if (t !== 'bye' && t !== 'leg_bye' && t !== 'legbye') {
          bowlersMap[b.bowler_name].runs += ballRuns;
        }
        if (b.wicket && b.wicket.wicketType !== 'Run Out') {
          bowlersMap[b.bowler_name].wickets++;
        }
      }
    });

    const oversStr = formatOvers(legalBalls);

    // Format bowler summary with economy
    const formattedBowlers = Object.values(bowlersMap).map((bw) => {
      const econ = bw.legalBalls > 0 ? ((bw.runs / bw.legalBalls) * 6).toFixed(2) : '0.00';
      return {
        name: bw.name,
        overs: formatOvers(bw.legalBalls),
        runs: bw.runs,
        wickets: bw.wickets,
        economy: econ,
        ballsCount: bw.legalBalls
      };
    });

    return {
      runs,
      wickets,
      legalBalls,
      overs: oversStr,
      extras,
      batters: Object.values(battersMap),
      bowlers: formattedBowlers,
      recentBalls: recentLabels.slice(-18),
      currentOverDeliveries,
      completedOvers
    };
  }
};
