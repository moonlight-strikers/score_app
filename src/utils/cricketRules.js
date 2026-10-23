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

export function isLegalDelivery(ballType) {
  return ballType !== BALL_TYPES.WIDE && ballType !== BALL_TYPES.NO_BALL;
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
