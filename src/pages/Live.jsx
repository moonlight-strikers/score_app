import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchService } from '../services/matchService';
import { Radio, Plus, ChevronRight, Zap, Target, Shield } from 'lucide-react';
import { getBallBadgeClass } from '../utils/cricketRules';
import { CricketBatIcon, DotBallIcon } from '../components/CricketIcons';

export default function Live() {
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLive() {
      try {
        const allMatches = await matchService.getMatches();
        const active = (allMatches || []).filter((m) => m.status === 'live');
        setLiveMatches(active);
      } catch (err) {
        console.error('Error fetching live matches:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLive();
  }, []);

  return (
    <div className="ms-page pb-4">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-ms-text-primary tracking-tight">
              Live Matches
            </h1>
            <span className="ms-live-badge text-[9px] py-0.5 px-1.5 font-bold">
              <span className="ms-live-dot" />
              Real-Time
            </span>
          </div>
          <p className="text-[11px] text-ms-text-muted mt-0.5">
            Follow MoonLight Strikers Saturday night matches ball-by-ball
          </p>
        </div>

        <Link to="/matches/create" className="ms-btn ms-btn-primary text-xs py-1 px-2.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" />
          <span>New Match</span>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-ms-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-ms-text-muted">Searching for active matches...</p>
        </div>
      ) : liveMatches.length === 0 ? (
        <div className="ms-card ms-empty-state py-8 px-4 text-center">
          <div className="w-9 h-9 rounded-full bg-ms-live/10 border border-ms-live/30 flex items-center justify-center mx-auto mb-2.5">
            <Radio className="w-4 h-4 text-ms-live" />
          </div>
          <p className="text-xs font-semibold text-ms-text-primary">No live matches right now</p>
          <p className="text-[11px] text-ms-text-muted mt-0.5 max-w-xs mx-auto">
            Live scores appear automatically here when a scorer begins scoring any match.
          </p>
          <div className="flex items-center justify-center gap-2.5 mt-4">
            <Link to="/matches/create" className="ms-btn ms-btn-primary text-xs py-1.5 px-3 rounded-lg font-bold">
              <Plus className="w-3.5 h-3.5" />
              <span>Start Match Now</span>
            </Link>
            <Link to="/matches" className="ms-btn ms-btn-secondary text-xs py-1.5 px-3 rounded-lg font-medium">
              View Past Matches
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {liveMatches.map((match) => {
            const isFirstInnings = (match.current_innings || 1) === 1;
            const currentScore = isFirstInnings ? match.team_a_score : match.team_b_score;
            const currentWickets = isFirstInnings ? match.team_a_wickets : match.team_b_wickets;
            const currentOvers = isFirstInnings ? match.team_a_overs : match.team_b_overs;

            return (
              <div
                key={match.id}
                className="ms-card p-3.5 border-ms-live/40 bg-gradient-to-br from-ms-bg-card via-ms-bg-card to-ms-live/10 shadow-lg relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="ms-live-badge text-[9px] py-0.5 px-1.5 flex-shrink-0 font-bold">
                      <span className="ms-live-dot" />
                      LIVE
                    </span>
                    <span className="text-xs text-ms-text-muted truncate">
                      {match.venue || 'MoonLight Turf'} ({match.overs || 16} ov)
                    </span>
                  </div>

                  <span className="text-xs font-score text-ms-cyan font-bold tabular-nums flex-shrink-0">
                    {match.current_innings === 2 ? '2nd Inn' : '1st Inn'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-ms-text-primary mb-1 truncate">
                      {match.team_a_name} <span className="text-xs text-ms-text-muted font-normal">vs</span> {match.team_b_name}
                    </h2>
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-score font-bold text-3xl sm:text-4xl text-ms-cyan tracking-normal tabular-nums">
                        {currentScore ?? 0}/{currentWickets ?? 0}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-ms-text-secondary font-score tabular-nums truncate">
                        ({currentOvers || '0.0'} / {match.overs} ov)
                      </span>
                    </div>
                  </div>

                  {match.target && (
                    <div className="p-2.5 rounded-lg bg-ms-bg-input border border-ms-border text-left sm:text-right">
                      <div className="text-[11px] text-ms-text-muted uppercase font-semibold flex items-center gap-1 sm:justify-end">
                        <Target className="w-3.5 h-3.5 text-ms-cyan" />
                        <span>Target: <strong className="font-score font-bold tabular-nums text-sm text-ms-text-primary">{match.target}</strong></span>
                      </div>
                      <div className="text-xs font-semibold text-ms-warning mt-0.5">
                        Need <strong className="font-score font-bold tabular-nums">{Math.max(0, match.target - (currentScore || 0))}</strong> runs
                      </div>
                    </div>
                  )}
                </div>

                {/* Batters and bowler summary */}
                {(match.striker || match.bowler) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-2 px-3 rounded bg-ms-bg-input/60 border border-ms-border mb-4">
                    <div className="truncate flex items-center gap-1">
                      <span className="text-ms-text-muted">Bat: </span>
                      <CricketBatIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-ms-text-primary font-medium uppercase">{match.striker?.name}</span>
                      <span className="text-ms-cyan font-bold ml-1 font-score tabular-nums">({match.striker?.runs || 0})</span>
                    </div>
                    <div className="truncate sm:text-right">
                      <span className="text-ms-text-muted">Bowl: </span>
                      <span className="text-ms-text-primary font-medium uppercase">{match.bowler?.name}</span>
                      <span className="text-ms-wicket font-bold ml-1 font-score tabular-nums">{match.bowler?.wickets || 0}/{match.bowler?.runs || 0}</span>
                    </div>
                  </div>
                )}

                {/* Recent Balls Strip */}
                {(match.recent_balls || []).length > 0 && (
                  <div className="flex items-center gap-2 mb-4 overflow-x-auto py-1">
                    <span className="text-[11px] font-bold text-ms-text-muted uppercase flex-shrink-0">Over:</span>
                    {match.recent_balls.slice(-6).map((b, i) => (
                      <span key={i} className={`ms-ball ${getBallBadgeClass(b)} flex items-center justify-center`}>
                        {b === '0' || b === '•' ? <DotBallIcon className="w-4 h-4 text-inherit" /> : b}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-ms-border">
                  <Link
                    to={`/live/${match.id}`}
                    className="ms-btn ms-btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-md shadow-cyan-900/30"
                  >
                    <span>Open Live Scoring Pad</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
