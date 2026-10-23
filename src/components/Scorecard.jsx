import React from 'react';
import { calculateRunRate } from '../utils/cricketRules';

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

          return (
            <div key={idx} className="ms-card p-4 md:p-6 border-ms-border-light bg-ms-bg-card shadow-lg">
              {/* Innings Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-ms-border">
                <div>
                  <h3 className="text-lg font-bold text-ms-text-primary flex items-center gap-2">
                    <span>{inn.team_name || inn.teamName || `Innings ${idx + 1}`}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-ms-bg-elevated text-ms-text-secondary font-normal border border-ms-border">
                      {idx === 0 ? '1st Innings' : '2nd Innings'}
                    </span>
                  </h3>
                  <div className="text-xs text-ms-text-muted mt-0.5">
                    Run Rate: {calculateRunRate(inn.runs, 0)} (or based on legal balls)
                  </div>
                </div>

                <div className="text-right">
                  <div className="ms-score-medium text-ms-cyan">
                    {inn.runs}
                    <span className="text-ms-text-muted mx-0.5 font-light">/</span>
                    <span className="text-ms-wicket">{inn.wickets}</span>
                  </div>
                  <div className="text-xs text-ms-text-secondary font-mono">
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
                      const sr = b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={i} className="hover:bg-ms-bg-elevated/40 transition-colors">
                          <td className="py-2.5">
                            <div className="font-semibold text-ms-text-primary flex items-center gap-1.5">
                              <span>{b.name}</span>
                              {b.notOut && <span className="text-xs text-ms-cyan font-bold">*</span>}
                            </div>
                            <div className="text-[11px] text-ms-text-muted truncate max-w-[180px]">
                              {b.notOut ? 'not out' : b.dismissal || 'c & b Bowler'}
                            </div>
                          </td>
                          <td className="text-right font-mono font-bold text-ms-cyan">{b.runs}</td>
                          <td className="text-right font-mono text-ms-text-secondary">{b.balls}</td>
                          <td className="text-right font-mono text-ms-boundary">{b.fours || 0}</td>
                          <td className="text-right font-mono text-ms-six">{b.sixes || 0}</td>
                          <td className="text-right font-mono text-xs text-ms-text-muted">{sr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extras Bar */}
              <div className="flex flex-wrap items-center justify-between text-xs py-2 px-3 rounded bg-ms-bg-input/60 border border-ms-border mb-6">
                <span className="text-ms-text-secondary font-medium">Extras:</span>
                <div className="flex items-center gap-3 text-ms-text-muted font-mono">
                  <span>(w {inn.extras?.wides || 0}, nb {inn.extras?.noballs || 0}, b {inn.extras?.byes || 0}, lb {inn.extras?.legbyes || 0})</span>
                  <span className="font-bold text-ms-text-primary text-sm">{totalExtras}</span>
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
                        <td className="py-2.5 font-semibold text-ms-text-primary">{bw.name}</td>
                        <td className="text-right font-mono text-ms-text-secondary">{bw.overs}</td>
                        <td className="text-right font-mono text-ms-text-muted">{bw.maidens || 0}</td>
                        <td className="text-right font-mono text-ms-text-primary">{bw.runs}</td>
                        <td className="text-right font-mono font-bold text-ms-wicket">{bw.wickets}</td>
                        <td className="text-right font-mono text-xs text-ms-cyan">{bw.economy || '0.00'}</td>
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
