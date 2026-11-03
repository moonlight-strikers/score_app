export const BALL_TYPES = {
  NORMAL: 'NORMAL',
  WIDE: 'WIDE',
  NO_BALL: 'NO_BALL',
  BYE: 'BYE',
  LEG_BYE: 'LEG_BYE',
  WICKET: 'WICKET'
};

export const WICKET_TYPES = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
  RETIRED: 'Retired Hurt'
};

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  INNINGS_1: 'innings_1',
  INNINGS_BREAK: 'innings_break',
  INNINGS_2: 'innings_2',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
};

export function isWideDelivery(ballType) {
  if (!ballType) return false;
  const str = String(ballType).toUpperCase().trim();
  return str === BALL_TYPES.WIDE || str === 'WIDE' || str === 'WD';
}

export function isNoBallDelivery(ballType) {
  if (!ballType) return false;
  const str = String(ballType).toUpperCase().trim();
  return str === BALL_TYPES.NO_BALL || str === 'NO_BALL' || str === 'NOBALL' || str === 'NB';
}

export function isLegalDelivery(ballType) {
  if (!ballType) return true;
  return !isWideDelivery(ballType) && !isNoBallDelivery(ballType);
}

export function formatOvers(legalBalls) {
  const completedOvers = Math.floor(legalBalls / 6);
  const remainingBalls = legalBalls % 6;
  return `${completedOvers}.${remainingBalls}`;
}

export function oversToBalls(oversStr) {
  if (!oversStr) return 0;
  const parts = String(oversStr).split('.');
  const overs = parseInt(parts[0], 10) || 0;
  const balls = parseInt(parts[1], 10) || 0;
  return overs * 6 + balls;
}

export function calculateRunRate(runs, legalBalls) {
  if (!legalBalls || legalBalls === 0) return '0.00';
  const overs = legalBalls / 6;
  return (runs / overs).toFixed(2);
}

export function calculateRequiredRunRate(targetRuns, currentRuns, ballsRemaining) {
  const needed = targetRuns - currentRuns;
  if (needed <= 0) return '0.00';
  if (ballsRemaining <= 0) return 'Required overs finished';
  const oversRemaining = ballsRemaining / 6;
  return (needed / oversRemaining).toFixed(2);
}

export function calculateMatchEquation(target, currentRuns, ballsRemaining, battingTeam) {
  if (!target) return null;
  const needed = target - currentRuns;
  if (needed <= 0) {
    return `${battingTeam || 'Batting Team'} has won the match!`;
  }
  if (ballsRemaining <= 0) {
    return 'All overs completed';
  }
  return `Need ${needed} run${needed === 1 ? '' : 's'} in ${ballsRemaining} ball${ballsRemaining === 1 ? '' : 's'}`;
}

export function getBallBadgeClass(ball) {
  if (!ball) return 'ms-ball-dot';
  const text = String(ball.text || ball);
  if (text.includes('W') && !text.includes('Wd')) return 'ms-ball-wicket';
  if (text === '6') return 'ms-ball-six';
  if (text === '4') return 'ms-ball-four';
  if (text.includes('Wd') || text.includes('Nb') || text.includes('B') || text.includes('Lb')) return 'ms-ball-extra';
  if (text === '0' || text === '•') return 'ms-ball-dot';
  return 'ms-ball-run';
}

/**
 * Resolves accurate batter status following international cricket rules.
 * - Currently batting: Only active batters at the crease are marked 'not out' with '*'.
 * - Dismissed batters: Show their dismissal (Caught, Bowled, Run Out, LBW, etc.).
 * - Did Not Bat: Players who never entered the crease display 'Did Not Bat'.
 */
export function resolveBatterStatus({
  batter,
  isActiveInnings = false,
  activeBatterNames = [],
  inningsCompleted = false,
  allOut = false,
  allowedNotOutNames = []
}) {
  if (!batter) return { isNotOut: false, label: 'Did Not Bat', isDnb: true };

  // 1. Explicitly marked Did Not Bat
  if (batter.didNotBat || batter.status === 'did_not_bat') {
    return { isNotOut: false, label: 'Did Not Bat', isDnb: true };
  }

  // 2. Explicitly dismissed
  if (batter.notOut === false || (batter.dismissal && batter.dismissal.toLowerCase() !== 'not out')) {
    return { isNotOut: false, label: batter.dismissal || 'Out', isDnb: false };
  }

  const name = String(batter.name || '').trim().toLowerCase();
  const normalizedActive = (activeBatterNames || []).map((n) => String(n || '').trim().toLowerCase());

  // 3. Active / live innings: strictly the two batters at the crease are "not out"
  if (isActiveInnings) {
    if (normalizedActive.includes(name)) {
      return { isNotOut: true, label: 'not out', isDnb: false };
    }
    // Has not entered crease and faced 0 balls / scored 0 runs
    if ((Number(batter.balls) || 0) === 0 && (Number(batter.runs) || 0) === 0 && !batter.dismissal) {
      return { isNotOut: false, label: 'Did Not Bat', isDnb: true };
    }
    // Batted earlier but replaced or dismissed without explicit status in legacy data
    return { isNotOut: false, label: batter.dismissal || 'Out', isDnb: false };
  }

  // 4. Completed innings or historical scorecard
  if (allowedNotOutNames && allowedNotOutNames.length > 0) {
    const normalizedAllowed = allowedNotOutNames.map((n) => String(n || '').trim().toLowerCase());
    if (normalizedAllowed.includes(name)) {
      return { isNotOut: true, label: 'not out', isDnb: false };
    } else {
      if ((Number(batter.balls) || 0) === 0 && (Number(batter.runs) || 0) === 0 && !batter.dismissal) {
        return { isNotOut: false, label: 'Did Not Bat', isDnb: true };
      }
      return { isNotOut: false, label: batter.dismissal || 'Out', isDnb: false };
    }
  }

  // If all out (10 wickets) and batter didn't face balls
  if (allOut && (Number(batter.balls) || 0) === 0 && (Number(batter.runs) || 0) === 0) {
    return { isNotOut: false, label: 'Did Not Bat', isDnb: true };
  }

  // If marked notOut and has faced balls or scored runs
  if (batter.notOut) {
    return { isNotOut: true, label: 'not out', isDnb: false };
  }

  // Did not bat fallback
  if ((Number(batter.balls) || 0) === 0 && (Number(batter.runs) || 0) === 0 && !batter.dismissal) {
    return { isNotOut: false, label: 'Did Not Bat', isDnb: true };
  }

  return { isNotOut: false, label: batter.dismissal || 'Out', isDnb: false };
}