/**
 * Utility to share comprehensive cricket match scorecard directly to WhatsApp or native share sheet.
 * Removes localhost URLs and formats separate player batting scores and bowler data in a clean structure.
 */
export async function shareMatchResult(match) {
  if (!match) return;

  const title = match.title || `${match.team_a_name} vs ${match.team_b_name}`;
  const isCompleted = match.status === 'completed';
  const resultText = match.result || (match.winner_team ? `${match.winner_team} Won!` : (isCompleted ? 'Match Completed' : 'Match in Progress (LIVE)'));

  const lines = [
    `🏏 *MoonLight Strikers — Match Scorecard*`,
    `⚔️ *${match.team_a_name}* vs *${match.team_b_name}*`,
    `🏆 *Result*: ${resultText}`
  ];

  if (match.venue) {
    lines.push(`📍 *Venue*: ${match.venue}`);
  }
  if (match.overs) {
    lines.push(`⏱️ *Overs*: ${match.overs} ov per side`);
  }

  // Check for innings_data breakdown
  const inningsList = Array.isArray(match.innings_data) && match.innings_data.length > 0
    ? match.innings_data
    : [];

  if (inningsList.length > 0) {
    inningsList.forEach((inn, idx) => {
      const innNumber = inn.innings_number || (idx + 1);
      const teamName = inn.team_name || (idx === 0 ? match.team_a_name : match.team_b_name);
      
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`${idx === 0 ? '🥇' : '🥈'} *${teamName} — Innings ${innNumber}*`);
      lines.push(`📊 *Score*: *${inn.runs ?? 0}/${inn.wickets ?? 0}* (${inn.overs ?? '0.0'} ov)`);

      // 1. Batting Details
      const batters = Array.isArray(inn.batters) ? inn.batters.filter(b => b.name) : [];
      if (batters.length > 0) {
        lines.push(``);
        lines.push(`🏏 *Batting:*`);
        batters.forEach((b) => {
          const star = b.notOut ? '*' : '';
          const boundaries = (b.fours || b.sixes)
            ? ` [${[b.fours ? `${b.fours}x4` : null, b.sixes ? `${b.sixes}x6` : null].filter(Boolean).join(', ')}]`
            : '';
          const dismissal = !b.notOut && b.dismissal ? ` (${b.dismissal})` : '';
          lines.push(`• *${b.name}${star}*: ${b.runs ?? 0} runs (${b.balls ?? 0}b)${boundaries}${dismissal}`);
        });
      }

      // 2. Extras
      if (inn.extras) {
        const ext = inn.extras;
        const totalExt = ext.total ?? ((ext.wides || 0) + (ext.noballs || 0) + (ext.byes || 0) + (ext.legbyes || 0));
        lines.push(``);
        lines.push(`➕ *Extras*: ${totalExt} (w ${ext.wides || 0}, nb ${ext.noballs || 0}, b ${ext.byes || 0}, lb ${ext.legbyes || 0})`);
      }

      // 3. Bowling Details
      const bowlers = Array.isArray(inn.bowlers) ? inn.bowlers.filter(bw => bw.name) : [];
      if (bowlers.length > 0) {
        lines.push(``);
        lines.push(`🎯 *Bowling:*`);
        bowlers.forEach((bw) => {
          const econ = bw.economy ? ` (Econ ${bw.economy})` : '';
          lines.push(`• *${bw.name}*: ${bw.overs ?? '0.0'}-${bw.maidens ?? 0}-${bw.runs ?? 0}-${bw.wickets ?? 0}${econ}`);
        });
      }
    });
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  } else {
    // Fallback summary format if innings_data is not populated yet
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📊 *Match Scores:*`);
    lines.push(`• *${match.team_a_name}*: ${match.team_a_score ?? 0}/${match.team_a_wickets ?? 0} (${match.team_a_overs ?? '0.0'} ov)`);
    lines.push(`• *${match.team_b_name}*: ${match.team_b_score ?? 0}/${match.team_b_wickets ?? 0} (${match.team_b_overs ?? '0.0'} ov)`);

    const activeBatters = [match.striker, match.non_striker].filter(b => b?.name);
    if (activeBatters.length > 0) {
      lines.push(``);
      lines.push(`🏏 *Current Batters:*`);
      activeBatters.forEach(b => {
        lines.push(`• *${b.name}*: ${b.runs ?? 0} (${b.balls ?? 0}b)`);
      });
    }

    if (match.bowler?.name) {
      lines.push(``);
      lines.push(`🎯 *Current Bowler:*`);
      lines.push(`• *${match.bowler.name}*: ${match.bowler.wickets ?? 0} wkts, ${match.bowler.runs ?? 0} runs (${match.bowler.overs ?? '0.0'} ov)`);
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  }

  const message = lines.join('\n');

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: message
      });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  // Fallback: Copy to clipboard and open WhatsApp directly
  try {
    await navigator.clipboard.writeText(message);
  } catch {}

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  return true;
}

export function isTwoDaysOld(dateStr) {
  if (!dateStr) return false;
  const matchTime = new Date(dateStr).getTime();
  if (isNaN(matchTime)) return false;
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return (Date.now() - matchTime) >= twoDaysMs;
}

export function formatMatchDate(dateStr) {
  if (!dateStr) return 'Match';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Match';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Match';
  }
}

export function formatMatchTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

