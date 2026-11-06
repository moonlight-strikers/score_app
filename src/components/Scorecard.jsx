import React from 'react';
import { calculateRunRate, oversToBalls, resolveBatterStatus } from '../utils/cricketRules';
import PlayerAvatar from './PlayerAvatar';

export default function Scorecard({ match, innings = [] }) {
  return (
    <div className="space-y-6">
      {innings.length === 0 ? (
        <div className="ms-card ms-empty-state py-12 text-center">
          <p className="text-sm font-medium text-ms-text-secondary">No innings details available yet</p>
          <p className="text-xs text-ms-text-muted mt-1">Balls scored will update the full scorecard here in real-time.</p>
        </div>
      ) : (
        innings.map((inn, idx) => {
          const totalExtras = inn.extras?.total || 
            ((inn.extras?.wides || 0) + (inn.extras?.noballs || 0) + (inn.extras?.byes || 0) + (inn.extras?.legbyes || 0));

          // Determine if this innings is the active one in a live match
          const isMatchCompleted = match?.status === 'completed' || match?.status === 'abandoned';
          const currentInnNum = Number(match?.current_innings || 1);
          const isInningsActive = !isMatchCompleted && (Number(inn.innings_number) === currentInnNum);

          // Strictly active batters at the crease right now
          const activeBatterNames = isInningsActive
            ? [match?.striker?.name, match?.non_striker?.name].filter(Boolean)
            : [];

          // For completed innings, determine the allowed not-out batters (maximum 2, or 1 if all out)
          const allOut = Number(inn.wickets) >= 10;
          let allowedNotOutNames = [];
          if (!isInningsActive) {
            // If this is the current innings that just finished, match.striker and match.non_striker are the not-out pair
            if (Number(inn.innings_number) === currentInnNum && match?.striker?.name) {
              const activeAtEnd = [match.striker.name, match.non_striker?.name].filter(Boolean);
              allowedNotOutNames = allOut ? activeAtEnd.slice(0, 1) : activeAtEnd;
            } else {
              // Otherwise pick the last entered batters with notOut: true and no dismissal
              const notOutBatters = (inn.batters || []).filter(
                (b) => b.notOut !== false && (!b.dismissal || b.dismissal.toLowerCase() === 'not out')
              );
              const maxAllowed = allOut ? 1 : 2;
              allowedNotOutNames = notOutBatters.slice(-maxAllowed).map((b) => b.name);
            }
          }

          const legalBallsCount = oversToBalls(inn.overs);

          // If upcoming unstarted innings
          if (inn.innings_status === 'upcoming' && (!inn.batters || inn.batters.length === 0) && Number(inn.runs || 0) === 0) {
            return (
              <div key={idx} className="ms-card p-4 md:p-6 border-ms-border-light bg-ms-bg-card shadow-sm opacity-75">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-ms-text-primary flex items-center gap-2">
                      <span>{inn.team_name || inn.teamName || inn.batting_team || `Innings ${idx + 1}`}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-ms-bg-elevated text-ms-text-secondary font-normal border border-ms-border">
                        {idx === 0 ? '1st Innings' : idx === 1 ? '2nd Innings' : idx === 2 ? '3rd Innings' : `${idx + 1}th Innings`}
                      </span>
                    </h3>
                  </div>
                  <div className="text-xs italic text-ms-text-muted font-medium px-2.5 py-1 rounded-full bg-ms-bg-input border border-ms-border">
                    Yet to Bat
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="ms-card p-4 md:p-6 border-ms-border-light bg-ms-bg-card shadow-lg">
              {/* Innings Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-ms-border">
                <div>
                  <h3 className="text-lg font-semibold text-ms-text-primary flex items-center gap-2">
                    <span>{inn.team_name || inn.teamName || `Innings ${idx + 1}`}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-ms-bg-elevated text-ms-text-secondary font-normal border border-ms-border">
                      {idx === 0 ? '1st Innings' : idx === 1 ? '2nd Innings' : idx === 2 ? '3rd Innings' : `${idx + 1}th Innings`}
                    </span>
                  </h3>
                  <div className="text-xs text-ms-text-muted mt-0.5">
                    Run Rate: <span className="font-score font-bold text-ms-text-primary tabular-nums">{calculateRunRate(inn.runs, legalBallsCount)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="ms-score-medium text-ms-cyan">
                    {inn.runs}
                    <span className="text-ms-text-muted mx-0.5 font-light">/</span>
                    <span className="text-ms-wicket">{inn.wickets}</span>
                  </div>
                  <div className="text-xs text-ms-text-secondary font-score font-semibold tabular-nums">
                    ({inn.overs} overs)
                  </div>
                </div>
              </div>

              {/* Batting Section */}
              <div className="mb-6 overflow-x-auto">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th className="min-w-[140px]">Batter</th>
                      <th className="text-right">R</th>
                      <th className="text-right">B</th>
                      <th className="text-right">4s</th>
                      <th className="text-right">6s</th>
                      <th className="text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inn.batters || []).map((b, i) => {
                      const { isNotOut, label, isDnb } = resolveBatterStatus({
                        batter: b,
                        isActiveInnings: isInningsActive,
                        activeBatterNames: activeBatterNames,
                        inningsCompleted: !isInningsActive,
                        allOut: allOut,
                        allowedNotOutNames: allowedNotOutNames
                      });

                      const sr = b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={i} className="hover:bg-ms-bg-elevated/40 transition-colors">
                          <td className="py-2.5">
                            <div className="font-semibold text-ms-text-primary flex items-center gap-2 uppercase">
                              <PlayerAvatar player={b} size="xs" />
                              <span className="truncate">{b.name}</span>
                              {isNotOut && <span className="text-xs text-ms-cyan font-bold font-sans">*</span>}
                            </div>
                            <div className="text-[11px] text-ms-text-muted truncate max-w-[180px] ml-8">
                              {label}
                            </div>
                          </td>
                          <td className="text-right font-score font-bold text-ms-cyan text-sm sm:text-base tabular-nums">{isDnb ? '-' : (b.runs ?? 0)}</td>
                          <td className="text-right font-score font-semibold text-ms-text-secondary text-sm tabular-nums">{isDnb ? '-' : (b.balls ?? 0)}</td>
                          <td className="text-right font-score font-semibold text-ms-boundary text-sm tabular-nums">{isDnb ? '-' : (b.fours || 0)}</td>
                          <td className="text-right font-score font-semibold text-ms-six text-sm tabular-nums">{isDnb ? '-' : (b.sixes || 0)}</td>
                          <td className="text-right font-score tabular-nums text-xs text-ms-text-muted">{isDnb ? '-' : sr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extras Bar */}
              <div className="flex flex-wrap items-center justify-between text-xs py-2 px-3 rounded bg-ms-bg-input/60 border border-ms-border mb-6">
                <span className="text-ms-text-secondary font-medium">Extras:</span>
                <div className="flex items-center gap-3 text-ms-text-muted font-score tabular-nums text-xs">
                  <span>(w {inn.extras?.wides || 0}, nb {inn.extras?.noballs || 0}, b {inn.extras?.byes || 0}, lb {inn.extras?.legbyes || 0})</span>
                  <span className="font-bold text-ms-text-primary text-base">{totalExtras}</span>
                </div>
              </div>

              {/* Bowling Section */}
              <div className="overflow-x-auto">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th className="min-w-[140px]">Bowler</th>
                      <th className="text-right">O</th>
                      <th className="text-right">M</th>
                      <th className="text-right">R</th>
                      <th className="text-right">W</th>
                      <th className="text-right">ECON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inn.bowlers || []).map((bw, i) => (
                      <tr key={i} className="hover:bg-ms-bg-elevated/40 transition-colors">
                        <td className="py-2.5 font-semibold text-ms-text-primary uppercase">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar player={bw} size="xs" />
                            <span className="truncate">{bw.name}</span>
                          </div>
                        </td>
                        <td className="text-right font-score font-semibold text-ms-text-secondary text-sm tabular-nums">{bw.overs}</td>
                        <td className="text-right font-score tabular-nums text-ms-text-muted text-sm">{bw.maidens || 0}</td>
                        <td className="text-right font-score font-semibold text-ms-text-primary text-sm tabular-nums">{bw.runs}</td>
                        <td className="text-right font-score font-bold text-ms-wicket text-sm sm:text-base tabular-nums">{bw.wickets}</td>
                        <td className="text-right font-score tabular-nums text-xs text-ms-cyan">{bw.economy || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
