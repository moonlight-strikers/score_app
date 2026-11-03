import { supabase, isSupabaseConfigured } from './supabase.js';
import { isLegalDelivery, isWideDelivery, isNoBallDelivery, formatOvers } from '../utils/cricketRules.js';

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
  'innings_id',
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
      let { data, error } = await supabase
        .from('ball_by_ball')
        .insert([ballPayload])
        .select()
        .single();

      if (error && (
        error.message?.includes('innings_id') ||
        error.details?.includes('innings_id') ||
        error.code === 'PGRST204' ||
        String(error.message || '').includes('schema cache')
      )) {
        console.warn('Supabase ball_by_ball schema cache missing innings_id, retrying without it...');
        const fallbackPayload = { ...ballPayload };
        delete fallbackPayload.innings_id;
        const retry = await supabase
          .from('ball_by_ball')
          .insert([fallbackPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

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
  /**
   * Undo last delivery from database and local storage.
   * Scoped to specific innings if provided to avoid cross-innings deletion.
   * Employs RPC atomic row locking or concurrency verification.
   */
  async undoBall(matchId, inningsNumber = null, expectedBallId = null) {
    let removedBall = null;
    const innNum = inningsNumber ? Number(inningsNumber) : null;

    if (isSupabaseConfigured) {
      // 1. Try atomic PostgreSQL RPC if deployed
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('undo_latest_delivery', {
          p_match_id: matchId,
          p_innings_number: innNum,
          p_expected_ball_id: expectedBallId ? String(expectedBallId) : null
        });

        if (!rpcErr && rpcData) {
          if (rpcData.success) {
            removedBall = rpcData.removed_ball;
            console.log('[UndoDebug] Successfully reversed delivery via RPC:', removedBall?.id);
          } else {
            console.warn('[UndoDebug] RPC returned failure:', rpcData.error);
          }
        } else if (rpcErr) {
          console.warn('[UndoDebug] RPC unavailable or error, falling back to direct delete:', rpcErr.message || rpcErr);
        }
      } catch (err) {
        console.warn('[UndoDebug] RPC call threw exception, falling back to direct delete:', err.message);
      }

      // 2. Safe client-side fallback if RPC is not available in database
      if (!removedBall) {
        let query = supabase
          .from('ball_by_ball')
          .select('*')
          .eq('match_id', matchId);

        if (innNum !== null) {
          query = query.eq('innings_number', innNum);
        }

        const { data: latestBall, error: findError } = await query
          .order('delivery_sequence', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error('[UndoDebug] Supabase undoBall find error:', findError);
          throw new Error(findError.message || 'Failed to locate last delivery for undo');
        }

        if (latestBall) {
          console.log('[UndoDebug] Identified latest delivery to remove:', latestBall.id, 'seq:', latestBall.delivery_sequence, 'type:', latestBall.type);
          if (expectedBallId && String(latestBall.id) !== String(expectedBallId)) {
            throw new Error('Concurrency conflict: The latest delivery was already modified on another device.');
          }

          const { error: delError } = await supabase
            .from('ball_by_ball')
            .delete()
            .eq('id', latestBall.id);

          if (delError) {
            console.error('[UndoDebug] Supabase undoBall delete error:', delError);
            throw new Error(delError.message || 'Failed to remove delivery from database');
          }
          removedBall = latestBall;
          console.log('[UndoDebug] Successfully deleted ball record from Supabase:', latestBall.id);
        } else {
          console.warn('[UndoDebug] No deliveries found in Supabase for match:', matchId, 'innings:', innNum);
        }
      }
    }

    // Local backup undo
    const storageKey = `ms_balls_${matchId}`;
    try {
      const existingRaw = localStorage.getItem(storageKey);
      if (existingRaw) {
        let balls = JSON.parse(existingRaw);
        if (Array.isArray(balls) && balls.length > 0) {
          let targetIdx = -1;
          if (removedBall?.id) {
            targetIdx = balls.findIndex(b => b.id === removedBall.id);
          }
          if (targetIdx === -1 && inningsNumber) {
            for (let i = balls.length - 1; i >= 0; i--) {
              if (Number(balls[i].innings_number) === Number(inningsNumber)) {
                targetIdx = i;
                break;
              }
            }
          }
          if (targetIdx === -1) {
            targetIdx = balls.length - 1;
          }

          if (targetIdx >= 0) {
            const [popped] = balls.splice(targetIdx, 1);
            localStorage.setItem(storageKey, JSON.stringify(balls));
            if (!removedBall) removedBall = popped;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to undo ball locally', e);
    }

    if (!removedBall) {
      return { success: false, error: 'No deliveries found to undo in this innings' };
    }

    return { success: true, removed: removedBall };
  },

  async getInningsBalls(matchId, inningsNumber = null) {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('ball_by_ball')
          .select('*')
          .eq('match_id', matchId)
          .order('delivery_sequence', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (inningsNumber !== null && inningsNumber !== undefined) {
          query = query.eq('innings_number', Number(inningsNumber));
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
    let currentOverRuns = 0;
    let completedOvers = [];
    const battersMap = {};
    const bowlersMap = {};
    const fallOfWickets = [];

    balls.forEach((b) => {
      const ballRuns = Number(b.runs) || 0;
      const rawType = b.type || 'normal';
      const isWide = isWideDelivery(rawType);
      const isNb = isNoBallDelivery(rawType);
      const legal = isLegalDelivery(rawType);
      const t = String(rawType).toLowerCase();

      // Gracefully handle legacy records where batsman_runs was omitted on normal balls
      const batRuns = (b.batsman_runs !== undefined && b.batsman_runs !== null)
        ? Number(b.batsman_runs)
        : (isWide || t === 'bye' || t === 'leg_bye' || t === 'legbye' ? 0 : ballRuns);
      runs += ballRuns;

      if (legal) {
        legalBalls++;
      }

      // Extras breakdown
      if (isWide) {
        extras.wides += ballRuns;
        extras.total += ballRuns;
      } else if (isNb) {
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
      } else if (isWide) {
        label = ballRuns > 1 ? `${ballRuns}Wd` : 'Wd';
      } else if (isNb) {
        label = ballRuns > 1 ? `${ballRuns}Nb` : 'Nb';
      } else if (t === 'bye') {
        label = `${ballRuns}B`;
      } else if (t === 'leg_bye' || t === 'legbye') {
        label = `${ballRuns}Lb`;
      }

      recentLabels.push(label);

      // Over tracking
      currentOverDeliveries.push(label);
      currentOverRuns += ballRuns;

      // Complete an over ONLY when a legal ball finishes the 6th legal delivery
      if (legal && legalBalls % 6 === 0) {
        completedOvers.push({
          overNumber: legalBalls / 6,
          bowler: b.bowler_name || 'Bowler',
          deliveries: [...currentOverDeliveries],
          runs: currentOverRuns
        });
        currentOverDeliveries = [];
        currentOverRuns = 0;
      }

      // Batter stats
      if (b.striker_name) {
        if (!battersMap[b.striker_name]) {
          battersMap[b.striker_name] = { name: b.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true };
        }
        battersMap[b.striker_name].runs += batRuns;
        // Wide deliveries are never counted as balls faced by batter
        if (!isWide) {
          battersMap[b.striker_name].balls++;
        }
        if (batRuns === 4) battersMap[b.striker_name].fours++;
        if (batRuns === 6) battersMap[b.striker_name].sixes++;
      }

      // Wicket events tracking: accurately record dismissal on the player who got out
      if (b.wicket) {
        const outName = b.wicket.playerOut || (b.wicket.isStriker ? b.striker_name : null);
        if (outName) {
          const dismissalType = b.wicket.wicketType || 'Out';
          const fielderInfo = b.wicket.fielder ? ` (${b.wicket.fielder})` : '';
          const fullDismissal = `${dismissalType}${fielderInfo}`;

          if (!battersMap[outName]) {
            battersMap[outName] = {
              name: outName,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              notOut: false,
              dismissal: fullDismissal
            };
          } else {
            battersMap[outName].notOut = false;
            battersMap[outName].dismissal = fullDismissal;
          }

          fallOfWickets.push({
            wicketNumber: wickets,
            score: runs,
            playerOut: outName,
            over: formatOvers(legalBalls)
          });
        }

        // Also track incoming new batter so they exist in battersMap
        if (b.wicket.newBatter) {
          const nextBatterName = String(b.wicket.newBatter).trim();
          if (nextBatterName && !battersMap[nextBatterName]) {
            battersMap[nextBatterName] = {
              name: nextBatterName,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              notOut: true
            };
          }
        }
      }

      // Bowler stats
      if (b.bowler_name) {
        if (!bowlersMap[b.bowler_name]) {
          bowlersMap[b.bowler_name] = { name: b.bowler_name, legalBalls: 0, runs: 0, wickets: 0 };
        }
        // Bowler overs count increments ONLY on legal deliveries
        if (legal) bowlersMap[b.bowler_name].legalBalls++;
        // Wides and No-balls charged to bowler; byes/leg-byes are not
        if (t !== 'bye' && t !== 'leg_bye' && t !== 'legbye') {
          bowlersMap[b.bowler_name].runs += ballRuns;
        }
        if (b.wicket && b.wicket.wicketType !== 'Run Out') {
          bowlersMap[b.bowler_name].wickets++;
        }
      }
    });

    const oversStr = formatOvers(legalBalls);

    // Format batters with accurate strike rate
    const formattedBatters = Object.values(battersMap).map(b => ({
      ...b,
      strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'
    }));

    // Format bowler summary with economy and maidens
    const formattedBowlers = Object.values(bowlersMap).map((bw) => {
      const econ = bw.legalBalls > 0 ? ((bw.runs / bw.legalBalls) * 6).toFixed(2) : '0.00';
      const bowlerOvers = completedOvers.filter(co => co.bowler === bw.name);
      const maidens = bowlerOvers.filter(co => co.runs === 0 && co.deliveries.length >= 6).length;
      return {
        name: bw.name,
        overs: formatOvers(bw.legalBalls),
        runs: bw.runs,
        wickets: bw.wickets,
        economy: econ,
        maidens,
        ballsCount: bw.legalBalls
      };
    });

    return {
      runs,
      wickets,
      legalBalls,
      overs: oversStr,
      extras,
      batters: formattedBatters,
      bowlers: formattedBowlers,
      fallOfWickets,
      recentBalls: recentLabels.slice(-18),
      currentOverDeliveries,
      completedOvers
    };
  },

  /**
   * Reconstructs active crease positions (striker, non-striker, bowler)
   * from delivery history or saved ball snapshot.
   */
  reconstructCrease(balls = [], initialOpeners = null, removedBall = null) {
    // 1. If removed ball provided saved crease snapshot, that is authoritatively accurate
    if (removedBall?.extras?.crease_state) {
      const cs = removedBall.extras.crease_state;
      return {
        strikerName: cs.striker?.name,
        nonStrikerName: cs.non_striker?.name,
        bowlerName: cs.bowler?.name,
        savedCrease: cs
      };
    }

    // 2. If no remaining balls in innings, reset to opening players
    if (balls.length === 0) {
      return {
        strikerName: initialOpeners?.striker?.name || 'Striker',
        nonStrikerName: initialOpeners?.nonStriker?.name || 'Non-Striker',
        bowlerName: initialOpeners?.bowler?.name || 'Bowler',
        savedCrease: null
      };
    }

    // 3. Deterministic replay from opening pair through remaining deliveries
    let strikerName = initialOpeners?.striker?.name || balls[0]?.striker_name || 'Striker';
    let nonStrikerName = initialOpeners?.nonStriker?.name || 'Non-Striker';
    if (nonStrikerName === strikerName) {
      for (const b of balls) {
        if (b.striker_name && b.striker_name !== strikerName) {
          nonStrikerName = b.striker_name;
          break;
        }
      }
    }

    let bowlerName = initialOpeners?.bowler?.name || balls[0]?.bowler_name || 'Bowler';
    let legalBalls = 0;

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      const isLegal = isLegalDelivery(b.type);
      const isWide = isWideDelivery(b.type);
      const isNb = isNoBallDelivery(b.type);
      const runs = Number(b.runs) || 0;

      if (b.bowler_name) bowlerName = b.bowler_name;
      if (isLegal) legalBalls++;

      let swapStrike = false;
      if (isWide || isNb) {
        const runningRuns = Math.max(0, runs - 1);
        if (runningRuns % 2 !== 0) swapStrike = true;
      } else {
        if (runs % 2 !== 0) swapStrike = true;
      }

      if (b.wicket) {
        const isStrikerOut = b.wicket.isStriker !== undefined ? b.wicket.isStriker : (b.wicket.playerOut === strikerName);
        const newBatter = b.wicket.newBatter || 'New Batter';
        if (isStrikerOut) {
          strikerName = newBatter;
        } else {
          nonStrikerName = newBatter;
        }
      } else if (swapStrike) {
        const temp = strikerName;
        strikerName = nonStrikerName;
        nonStrikerName = temp;
      }

      if (isLegal && legalBalls > 0 && legalBalls % 6 === 0) {
        const temp = strikerName;
        strikerName = nonStrikerName;
        nonStrikerName = temp;
      }
    }

    return {
      strikerName,
      nonStrikerName,
      bowlerName,
      savedCrease: null
    };
  }
};
