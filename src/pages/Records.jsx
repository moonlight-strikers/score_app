import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Plus, Shield, Award, BarChart3 } from 'lucide-react';
import { matchService } from '../services/matchService';
import { formatMatchDate } from '../utils/shareMatch';

export default function Records() {
  const [activeTab, setActiveTab] = useState('batting'); // 'batting' | 'bowling' | 'team'
  const [loading, setLoading] = useState(true);
  const [battingLeaders, setBattingLeaders] = useState([]);
  const [bowlingLeaders, setBowlingLeaders] = useState([]);
  const [teamRecords, setTeamRecords] = useState([]);

  useEffect(() => {
    async function loadRecords() {
      try {
        const matches = await matchService.getMatches();
        const validMatches = (matches || []).filter((m) => m && !m.id?.startsWith('demo-'));

        if (!validMatches || validMatches.length === 0) {
          setBattingLeaders([]);
          setBowlingLeaders([]);
          setTeamRecords([]);
          return;
        }

        const batterMap = {};
        const bowlerMap = {};
        let highestTeamScore = null;
        let highestIndividualScore = null;
        let bestBowlingFigure = null;

        validMatches.forEach((match) => {
          // Team Totals
          if (match.team_a_score !== undefined && match.team_a_name) {
            const totalA = Number(match.team_a_score) || 0;
            if (!highestTeamScore || totalA > highestTeamScore.runs) {
              highestTeamScore = {
                title: 'Highest Team Total',
                value: `${totalA}/${match.team_a_wickets || 0} (${match.team_a_overs || '0.0'} ov)`,
                team: match.team_a_name,
                opponent: `vs ${match.team_b_name || 'Opponent'}`,
                date: formatMatchDate(match.created_at)
              };
            }
          }
          if (match.team_b_score !== undefined && match.team_b_name) {
            const totalB = Number(match.team_b_score) || 0;
            if (!highestTeamScore || totalB > highestTeamScore.runs) {
              highestTeamScore = {
                title: 'Highest Team Total',
                value: `${totalB}/${match.team_b_wickets || 0} (${match.team_b_overs || '0.0'} ov)`,
                team: match.team_b_name,
                opponent: `vs ${match.team_a_name || 'Opponent'}`,
                date: formatMatchDate(match.created_at)
              };
            }
          }

          // Innings Data aggregation
          (match.innings_data || []).forEach((inn) => {
            (inn.batters || []).forEach((b) => {
              if (!b || !b.name) return;
              const name = b.name.trim();
              if (!batterMap[name]) {
                batterMap[name] = { name, runs: 0, balls: 0, fours: 0, sixes: 0, matches: 0, highest: 0 };
              }
              batterMap[name].matches += 1;
              batterMap[name].runs += Number(b.runs) || 0;
              batterMap[name].balls += Number(b.balls) || 0;
              batterMap[name].fours += Number(b.fours) || 0;
              batterMap[name].sixes += Number(b.sixes) || 0;
              const thisRuns = Number(b.runs) || 0;
              if (thisRuns > batterMap[name].highest) {
                batterMap[name].highest = thisRuns;
              }

              if (!highestIndividualScore || thisRuns > highestIndividualScore.runs) {
                highestIndividualScore = {
                  title: 'Highest Individual Score',
                  value: `${thisRuns}${b.notOut ? '*' : ''} (${b.balls || 0} balls)`,
                  player: name,
                  runs: thisRuns,
                  date: formatMatchDate(match.created_at)
                };
              }
            });

            (inn.bowlers || []).forEach((bw) => {
              if (!bw || !bw.name) return;
              const name = bw.name.trim();
              if (!bowlerMap[name]) {
                bowlerMap[name] = { name, wickets: 0, runs: 0, balls: 0, matches: 0, bestWickets: 0, bestRuns: 999 };
              }
              const [ovFull, ovBalls] = (bw.overs || '0.0').toString().split('.').map(Number);
              const balls = (ovFull || 0) * 6 + (ovBalls || 0);
              const wkts = Number(bw.wickets) || 0;
              const runsConceded = Number(bw.runs) || 0;

              bowlerMap[name].matches += 1;
              bowlerMap[name].wickets += wkts;
              bowlerMap[name].runs += runsConceded;
              bowlerMap[name].balls += balls;

              if (wkts > bowlerMap[name].bestWickets || (wkts === bowlerMap[name].bestWickets && runsConceded < bowlerMap[name].bestRuns)) {
                bowlerMap[name].bestWickets = wkts;
                bowlerMap[name].bestRuns = runsConceded;
              }

              if (!bestBowlingFigure || wkts > bestBowlingFigure.wickets || (wkts === bestBowlingFigure.wickets && runsConceded < bestBowlingFigure.runs)) {
                bestBowlingFigure = {
                  title: 'Best Bowling Figures',
                  value: `${wkts}/${runsConceded} (${bw.overs || '0.0'} ov)`,
                  player: name,
                  wickets: wkts,
                  runs: runsConceded,
                  date: formatMatchDate(match.created_at)
                };
              }
            });
          });
        });

        // Sorted Batting Leaders
        const sortedBatters = Object.values(batterMap)
          .sort((a, b) => b.runs - a.runs)
          .map((b, i) => ({
            rank: i + 1,
            name: b.name,
            runs: b.runs,
            matches: b.matches,
            highest: b.highest,
            sr: b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0',
            sixes: b.sixes,
            fours: b.fours
          }));

        // Sorted Bowling Leaders
        const sortedBowlers = Object.values(bowlerMap)
          .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
          .map((bw, i) => {
            const oversFull = Math.floor(bw.balls / 6);
            const oversRemainder = bw.balls % 6;
            const oversStr = `${oversFull}.${oversRemainder}`;
            const econ = bw.balls ? ((bw.runs / bw.balls) * 6).toFixed(2) : '0.00';
            return {
              rank: i + 1,
              name: bw.name,
              wickets: bw.wickets,
              matches: bw.matches,
              overs: oversStr,
              econ,
              best: bw.bestWickets > 0 ? `${bw.bestWickets}/${bw.bestRuns}` : '-'
            };
          });

        const recordsList = [];
        if (highestTeamScore) recordsList.push(highestTeamScore);
        if (highestIndividualScore) recordsList.push(highestIndividualScore);
        if (bestBowlingFigure && bestBowlingFigure.wickets > 0) recordsList.push(bestBowlingFigure);

        setBattingLeaders(sortedBatters);
        setBowlingLeaders(sortedBowlers);
        setTeamRecords(recordsList);
      } catch (err) {
        console.error('Failed to load records:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRecords();
  }, []);

  const hasAnyData = battingLeaders.length > 0 || bowlingLeaders.length > 0 || teamRecords.length > 0;

  return (
    <div className="ms-page pb-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 rounded-xl bg-ms-six/10 border border-ms-six/30 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-ms-six" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ms-text-primary tracking-tight">
            Club Records & Leaderboards
          </h1>
          <p className="text-xs text-ms-text-muted mt-0.5">
            Real-time player milestones and match leaderboards
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: 'batting', label: 'Batting Leaders' },
          { key: 'bowling', label: 'Bowling Leaders' },
          { key: 'team', label: 'Club & Team Records' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-ms-cyan text-ms-text-inverse shadow-sm'
                : 'bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-ms-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-ms-text-muted">Loading records...</p>
        </div>
      ) : !hasAnyData ? (
        <div className="ms-card ms-empty-state py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-ms-cyan/10 border border-ms-cyan/30 flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-ms-cyan" />
          </div>
          <p className="text-sm font-semibold text-ms-text-primary">No records available yet</p>
          <p className="text-xs text-ms-text-muted mt-1 max-w-sm mx-auto">
            Records and leaderboards will automatically populate as matches are played and scored.
          </p>
          <Link to="/matches/create" className="ms-btn ms-btn-primary mt-4 text-xs inline-flex items-center gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            <span>Start a Match</span>
          </Link>
        </div>
      ) : (
        <>
          {activeTab === 'batting' && (
            <div className="space-y-4">
              {battingLeaders.length === 0 ? (
                <div className="ms-card p-8 text-center text-xs text-ms-text-muted">
                  No batting data recorded yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-cyan/10 border-ms-cyan/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Most Runs</div>
                      <div className="ms-score-medium text-ms-cyan mt-1">{battingLeaders[0]?.runs ?? 0}</div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">{battingLeaders[0]?.name}</div>
                      <div className="text-[11px] text-ms-text-muted">SR {battingLeaders[0]?.sr} • {battingLeaders[0]?.matches} matches</div>
                    </div>

                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-boundary/10 border-ms-boundary/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Highest Score</div>
                      <div className="ms-score-medium text-ms-boundary mt-1">
                        {[...battingLeaders].sort((a, b) => b.highest - a.highest)[0]?.highest ?? 0}
                      </div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">
                        {[...battingLeaders].sort((a, b) => b.highest - a.highest)[0]?.name}
                      </div>
                      <div className="text-[11px] text-ms-text-muted">Top Individual Inning</div>
                    </div>

                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-six/10 border-ms-six/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Most Sixes</div>
                      <div className="ms-score-medium text-ms-six mt-1">
                        {[...battingLeaders].sort((a, b) => b.sixes - a.sixes)[0]?.sixes ?? 0}
                      </div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">
                        {[...battingLeaders].sort((a, b) => b.sixes - a.sixes)[0]?.name}
                      </div>
                      <div className="text-[11px] text-ms-text-muted">Maximums hit</div>
                    </div>
                  </div>

                  <div className="ms-card p-4 overflow-x-auto border-ms-border-light">
                    <h3 className="text-sm font-semibold text-ms-text-primary mb-3">Top Run Scorers</h3>
                    <table className="ms-table">
                      <thead>
                        <tr>
                          <th>Rank & Batter</th>
                          <th className="text-right">Mat</th>
                          <th className="text-right">Runs</th>
                          <th className="text-right">HS</th>
                          <th className="text-right">SR</th>
                          <th className="text-right">6s</th>
                          <th className="text-right">4s</th>
                        </tr>
                      </thead>
                      <tbody>
                        {battingLeaders.map((p) => (
                          <tr key={p.rank} className="hover:bg-ms-bg-elevated/40">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  p.rank === 1 ? 'bg-amber-400 text-black' : p.rank === 2 ? 'bg-slate-300 text-black' : 'bg-ms-bg-input text-ms-text-muted'
                                }`}>
                                  {p.rank}
                                </span>
                                <span className="font-semibold text-ms-text-primary">{p.name}</span>
                              </div>
                            </td>
                            <td className="text-right font-score text-ms-text-muted tabular-nums">{p.matches}</td>
                            <td className="text-right font-score font-bold text-ms-cyan text-sm sm:text-base tabular-nums">{p.runs}</td>
                            <td className="text-right font-score font-semibold text-ms-boundary text-sm tabular-nums">{p.highest}</td>
                            <td className="text-right font-score font-semibold text-ms-text-primary text-sm tabular-nums">{p.sr}</td>
                            <td className="text-right font-score font-semibold text-ms-six text-sm tabular-nums">{p.sixes}</td>
                            <td className="text-right font-score text-ms-text-muted tabular-nums">{p.fours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'bowling' && (
            <div className="space-y-4">
              {bowlingLeaders.length === 0 ? (
                <div className="ms-card p-8 text-center text-xs text-ms-text-muted">
                  No bowling data recorded yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-wicket/10 border-ms-wicket/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Most Wickets</div>
                      <div className="ms-score-medium text-ms-wicket mt-1">{bowlingLeaders[0]?.wickets ?? 0}</div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">{bowlingLeaders[0]?.name}</div>
                      <div className="text-[11px] text-ms-text-muted">{bowlingLeaders[0]?.overs} overs • Econ {bowlingLeaders[0]?.econ}</div>
                    </div>

                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-cyan/10 border-ms-cyan/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Best Economy</div>
                      <div className="ms-score-medium text-ms-cyan mt-1">
                        {[...bowlingLeaders].sort((a, b) => Number(a.econ) - Number(b.econ))[0]?.econ ?? '0.00'}
                      </div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">
                        {[...bowlingLeaders].sort((a, b) => Number(a.econ) - Number(b.econ))[0]?.name}
                      </div>
                      <div className="text-[11px] text-ms-text-muted">Top bowling economy</div>
                    </div>

                    <div className="ms-card p-4 bg-gradient-to-br from-ms-bg-card to-ms-live/10 border-ms-live/30">
                      <div className="text-[11px] font-bold text-ms-text-muted uppercase">Top Wicket Taker</div>
                      <div className="ms-score-medium text-ms-live mt-1">{bowlingLeaders[0]?.best || '-'}</div>
                      <div className="text-xs font-semibold text-ms-text-primary mt-0.5">{bowlingLeaders[0]?.name}</div>
                      <div className="text-[11px] text-ms-text-muted">Best figures</div>
                    </div>
                  </div>

                  <div className="ms-card p-4 overflow-x-auto border-ms-border-light">
                    <h3 className="text-sm font-semibold text-ms-text-primary mb-3">Top Wicket Takers</h3>
                    <table className="ms-table">
                      <thead>
                        <tr>
                          <th>Rank & Bowler</th>
                          <th className="text-right">Mat</th>
                          <th className="text-right">Overs</th>
                          <th className="text-right">Wickets</th>
                          <th className="text-right">Econ</th>
                          <th className="text-right">BBI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bowlingLeaders.map((p) => (
                          <tr key={p.rank} className="hover:bg-ms-bg-elevated/40">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  p.rank === 1 ? 'bg-amber-400 text-black' : p.rank === 2 ? 'bg-slate-300 text-black' : 'bg-ms-bg-input text-ms-text-muted'
                                }`}>
                                  {p.rank}
                                </span>
                                <span className="font-semibold text-ms-text-primary">{p.name}</span>
                              </div>
                            </td>
                            <td className="text-right font-score text-ms-text-muted tabular-nums">{p.matches}</td>
                            <td className="text-right font-score font-semibold text-ms-text-secondary tabular-nums">{p.overs}</td>
                            <td className="text-right font-score font-bold text-ms-wicket text-sm sm:text-base tabular-nums">{p.wickets}</td>
                            <td className="text-right font-score tabular-nums text-ms-cyan">{p.econ}</td>
                            <td className="text-right font-score text-ms-live font-semibold tabular-nums">{p.best}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'team' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamRecords.length === 0 ? (
                <div className="col-span-full ms-card p-8 text-center text-xs text-ms-text-muted">
                  No team records recorded yet.
                </div>
              ) : (
                teamRecords.map((r, i) => (
                  <div key={i} className="ms-card p-4 border-ms-border-light hover:border-ms-cyan/40 transition-colors">
                    <div className="text-xs text-ms-text-muted uppercase font-bold tracking-wider">{r.title}</div>
                    <div className="ms-score-medium text-ms-cyan mt-1">{r.value}</div>
                    <div className="text-xs text-ms-text-secondary mt-1">
                      {r.team ? `${r.team} ` : ''}{r.opponent || r.player} • <span className="text-ms-text-muted">{r.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
