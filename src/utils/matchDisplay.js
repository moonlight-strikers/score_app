/**
 * Utility for display-level team ordering and presentation.
 * 
 * Rule: For completed matches with a declared winner, the WINNING team
 * must ALWAYS appear on the LEFT side, and the losing team on the RIGHT side.
 * The winning team's name MUST pair with the winning team's actual score,
 * and the opponent's name MUST pair with the opponent's actual score.
 * 
 * IMPORTANT: This affects display presentation only. Underlying database records remain untouched.
 */

function resolveTeamStats(match, teamName, defaultKey) {
  const isA = defaultKey === 'team_a';
  const name = teamName || (isA ? match.team_a_name : match.team_b_name) || (isA ? 'Team A' : 'Team B');
  const clean = name.trim().toLowerCase();

  // 1. Authoritative ground truth: match.innings_data explicitly records team_name per innings
  if (Array.isArray(match.innings_data) && match.innings_data.length > 0 && clean) {
    const matchedInnings = match.innings_data.filter((inn) => {
      const innTeam = (inn.team_name || inn.batting_team || '').trim().toLowerCase();
      return innTeam === clean;
    });

    if (matchedInnings.length > 0) {
      if (matchedInnings.length === 1 || match.match_type !== 'test') {
        const inn = matchedInnings[0];
        return {
          name,
          score: inn.runs ?? 0,
          wickets: inn.wickets ?? 0,
          overs: inn.overs || '0.0',
          teamKey: defaultKey
        };
      } else {
        // Multi-innings Test match: aggregate runs and wickets across innings
        const totalRuns = matchedInnings.reduce((sum, i) => sum + (i.runs || 0), 0);
        const totalWickets = matchedInnings.reduce((sum, i) => sum + (i.wickets || 0), 0);
        const oversStr = matchedInnings.map(i => i.overs || '0.0').join(' & ');
        return {
          name,
          score: totalRuns,
          wickets: totalWickets,
          overs: oversStr,
          teamKey: defaultKey
        };
      }
    }
  }

  // 2. Fallback if innings_data is missing
  return {
    name,
    score: (isA ? match.team_a_score : match.team_b_score) ?? 0,
    wickets: (isA ? match.team_a_wickets : match.team_b_wickets) ?? 0,
    overs: (isA ? match.team_a_overs : match.team_b_overs) || '0.0',
    teamKey: defaultKey
  };
}

export function getMatchDisplayTeams(match) {
  if (!match) {
    return {
      leftTeam: { name: 'Team A', score: 0, wickets: 0, overs: '0.0', isWinner: false, teamKey: 'team_a' },
      rightTeam: { name: 'Team B', score: 0, wickets: 0, overs: '0.0', isWinner: false, teamKey: 'team_b' },
      isReordered: false
    };
  }

  let teamA = resolveTeamStats(match, match.team_a_name, 'team_a');
  let teamB = resolveTeamStats(match, match.team_b_name, 'team_b');

  // Live or non-completed matches always preserve original Team A (left) vs Team B (right)
  if (match.status !== 'completed') {
    return {
      leftTeam: { ...teamA, isWinner: false },
      rightTeam: { ...teamB, isWinner: false },
      isReordered: false
    };
  }

  // Identify winner
  let winner = null; // 'team_a' | 'team_b' | null

  // 1. Check winner_team field
  if (match.winner_team) {
    const wt = String(match.winner_team).trim().toLowerCase();
    const notWinners = ['tie', 'draw', 'match tied!', 'match drawn!', 'no result', 'abandoned'];
    if (!notWinners.includes(wt)) {
      if (teamB.name && wt === teamB.name.trim().toLowerCase()) {
        winner = 'team_b';
      } else if (teamA.name && wt === teamA.name.trim().toLowerCase()) {
        winner = 'team_a';
      }
    }
  }

  // 2. Parse from result text if winner_team was missing or inconclusive
  if (!winner && match.result) {
    const resLower = String(match.result).toLowerCase();
    const notWinners = ['tie', 'draw', 'drawn', 'no result', 'abandoned'];
    const isUndecided = notWinners.some(nw => resLower.includes(nw));

    if (!isUndecided) {
      const aNameLower = (teamA.name || '').toLowerCase();
      const bNameLower = (teamB.name || '').toLowerCase();

      if (bNameLower && (resLower.startsWith(bNameLower) || resLower.includes(`${bNameLower} won`))) {
        winner = 'team_b';
      } else if (aNameLower && (resLower.startsWith(aNameLower) || resLower.includes(`${aNameLower} won`))) {
        winner = 'team_a';
      }
    }
  }

  // 3. Fallback: compare scores if completed limited overs without explicit winner field
  if (!winner && match.status === 'completed' && match.match_type !== 'test') {
    if (typeof teamB.score === 'number' && typeof teamA.score === 'number') {
      if (teamB.score > teamA.score) {
        winner = 'team_b';
      } else if (teamA.score > teamB.score) {
        winner = 'team_a';
      }
    }
  }

  // Sanity check for runs victory if innings_data was missing:
  // In a victory by runs, the winning team batted first and must have the higher score.
  if (match.result && String(match.result).toLowerCase().includes('won by') && String(match.result).toLowerCase().includes('run')) {
    if (winner === 'team_b' && teamB.score < teamA.score && (!Array.isArray(match.innings_data) || match.innings_data.length === 0)) {
      const tempScore = teamB.score;
      const tempWkts = teamB.wickets;
      const tempOvers = teamB.overs;
      teamB.score = teamA.score;
      teamB.wickets = teamA.wickets;
      teamB.overs = teamA.overs;
      teamA.score = tempScore;
      teamA.wickets = tempWkts;
      teamA.overs = tempOvers;
    } else if (winner === 'team_a' && teamA.score < teamB.score && (!Array.isArray(match.innings_data) || match.innings_data.length === 0)) {
      const tempScore = teamA.score;
      const tempWkts = teamA.wickets;
      const tempOvers = teamA.overs;
      teamA.score = teamB.score;
      teamA.wickets = teamB.wickets;
      teamA.overs = teamB.overs;
      teamB.score = tempScore;
      teamB.wickets = tempWkts;
      teamB.overs = tempOvers;
    }
  }

  if (winner === 'team_b') {
    return {
      leftTeam: { ...teamB, isWinner: true },
      rightTeam: { ...teamA, isWinner: false },
      isReordered: true
    };
  }

  if (winner === 'team_a') {
    return {
      leftTeam: { ...teamA, isWinner: true },
      rightTeam: { ...teamB, isWinner: false },
      isReordered: false
    };
  }

  return {
    leftTeam: { ...teamA, isWinner: false },
    rightTeam: { ...teamB, isWinner: false },
    isReordered: false
  };
}
