import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trophy,
  Radio,
  ChevronRight,
  Share2,
  Trash2,
  Calendar
} from 'lucide-react';
import { matchService } from '../services/matchService';
import { supabase } from '../services/supabase';
import { shareMatchResult, isTwoDaysOld, formatMatchDate } from '../utils/shareMatch';

export default function Home() {
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    loadDashboard();

    const channel = supabase
      .channel('home-matches-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadDashboard() {
    try {
      const matches = await matchService.getMatches();
      setRecentMatches(matches || []);
    } catch (err) {
      console.warn('Dashboard load warning:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteMatch = async (e, matchId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this match? This cannot be undone.')) {
      await matchService.deleteMatch(matchId);
      setRecentMatches((prev) => prev.filter((m) => m.id !== matchId));
    }
  };

  const handleShare = async (e, match) => {
    e.preventDefault();
    e.stopPropagation();
    await shareMatchResult(match);
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2000);
  };

  const liveMatch = recentMatches.find((m) => m.status === 'live' || m.status === 'on_hold');
  const otherMatches = recentMatches.filter((m) => m.status !== 'live' && m.status !== 'on_hold');

  return (
    <div className="ms-page pb-4">
      {/* Toast Notification */}
      {shareSuccess && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-ms-cyan text-ms-text-inverse px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-fadeIn flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          <span>Match details shared!</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="text-center py-2 md:py-4 w-full">
        <div className="flex items-center justify-center mb-2">
          <img
            src="/logo.png"
            alt="MoonLight Strikers"
            className="w-14 h-14 rounded-full object-cover border-2 border-ms-cyan/50 shadow-lg shadow-cyan-950/40"
          />
        </div>
        <h1 className="text-xl md:text-2xl font-extrabold text-ms-text-primary tracking-tight mb-0.5">
          MoonLight Strikers
        </h1>
        <p className="text-ms-text-secondary text-xs max-w-xs mx-auto">
          Saturday night cricket, scored and shared live.
        </p>

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-2 mt-3 w-full">
          <Link to="/matches/create" className="ms-btn ms-btn-primary text-xs py-1.5 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 font-bold flex-1 max-w-[170px]">
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Start Match</span>
          </Link>
          <Link to="/matches" className="ms-btn ms-btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 font-semibold flex-1 max-w-[170px]">
            <Trophy className="w-3.5 h-3.5 text-ms-cyan flex-shrink-0" />
            <span className="truncate">Matches</span>
          </Link>
        </div>
      </section>

      {/* Live Match Banner — Vibrant Red Theme */}
      <section className="mb-3 w-full">
        <div className="ms-card p-3 border-red-500/30 bg-gradient-to-r from-ms-bg-card via-ms-bg-card to-red-500/10 shadow-sm w-full">
          <div className="flex items-center justify-between mb-2.5">
            <span className={liveMatch?.status === 'on_hold' ? 'px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold uppercase' : 'ms-live-badge'}>
              {liveMatch?.status === 'on_hold' ? 'On Hold' : <><span className="ms-live-dot" /> Live</>}
            </span>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              {liveMatch && isTwoDaysOld(liveMatch.created_at) && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteMatch(e, liveMatch.id)}
                  className="p-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-500 border border-red-500/30 text-xs transition-colors cursor-pointer"
                  title="Delete match (2+ days old)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {liveMatch ? (
            <Link to={`/live/${liveMatch.id}`} className="block no-underline group">
              {/* Teams & Scores Row - Fully Responsive & Centered */}
              <div className="flex items-center justify-between gap-1.5 min-w-0 w-full py-0.5">
                {/* Team A */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="font-bold text-xs sm:text-sm text-ms-text-primary truncate">
                    {liveMatch.team_a_name}
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
                    <span className="font-mono font-black text-base sm:text-lg text-amber-400">
                      {liveMatch.team_a_score ?? 0}/{liveMatch.team_a_wickets ?? 0}
                    </span>
                    <span className="text-[10px] sm:text-xs text-ms-text-muted font-mono truncate">
                      ({liveMatch.team_a_overs || '0.0'} ov)
                    </span>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="flex-shrink-0 px-1 text-center">
                  <span className="inline-block text-[10px] font-black text-red-400 px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/30">
                    VS
                  </span>
                </div>

                {/* Team B */}
                <div className="flex-1 min-w-0 pl-1 text-right">
                  <div className="font-bold text-xs sm:text-sm text-ms-text-primary truncate">
                    {liveMatch.team_b_name}
                  </div>
                  <div className="flex items-baseline justify-end gap-1 mt-0.5 min-w-0">
                    <span className="font-mono font-black text-base sm:text-lg text-ms-cyan">
                      {liveMatch.team_b_score ?? 0}/{liveMatch.team_b_wickets ?? 0}
                    </span>
                    <span className="text-[10px] sm:text-xs text-ms-text-muted font-mono truncate">
                      ({liveMatch.team_b_overs || '0.0'} ov)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action Bar inside the card */}
              <div className="mt-2.5 pt-2 border-t border-ms-border flex items-center justify-between text-xs">
                <span className="text-[11px] text-ms-text-muted truncate">
                  {liveMatch.venue || 'Saturday Night League'}
                </span>
                <span className="text-ms-cyan font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                  <span>Score / Watch Live</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ) : (
            <div className="text-center py-3">
              <p className="text-ms-text-muted text-xs">No live matches currently in progress</p>
              <p className="text-[11px] text-ms-text-muted mt-0.5">
                Start a new match to score and broadcast live
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Matches */}
      <section className="mb-6 w-full">
        <div className="flex items-center justify-between mb-3 min-w-0">
          <h2 className="text-base font-bold text-ms-text-primary">Recent Matches</h2>
          <Link to="/matches" className="text-ms-cyan text-xs font-semibold flex items-center gap-0.5 no-underline flex-shrink-0">
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {otherMatches.length === 0 ? (
          <div className="ms-card ms-empty-state py-8 text-center">
            <Trophy className="w-8 h-8 text-ms-text-muted mb-2 opacity-50" />
            <p className="text-xs font-semibold text-ms-text-primary">No previous matches yet</p>
            <p className="text-[11px] text-ms-text-muted mt-0.5">
              Completed and scored matches will be recorded here
            </p>
            <Link to="/matches/create" className="ms-btn ms-btn-primary mt-2.5 text-xs py-1.5 px-3 rounded-lg inline-flex items-center gap-1.5 font-bold">
              <Plus className="w-3.5 h-3.5" />
              <span>Create Match</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {otherMatches.slice(0, 5).map((match) => {
              const isOld = isTwoDaysOld(match.created_at);
              const isCompleted = match.status === 'completed';
              const winnerText = match.result || (match.winner_team ? `${match.winner_team} Won!` : null);

              return (
                <div
                  key={match.id}
                  className="ms-card p-3 bg-ms-bg-card border-ms-border shadow-xs hover:border-ms-border-light transition-all rounded-2xl w-full"
                >
                  <Link to={`/live/${match.id}`} className="block no-underline">
                    <div className="flex items-center justify-between mb-2 min-w-0">
                      <span className="text-[11px] text-ms-text-muted font-medium flex items-center gap-1 truncate">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {formatMatchDate(match.created_at)}
                      </span>
                      <span className={`ms-badge text-[10px] flex-shrink-0 ${
                        isCompleted ? 'ms-badge-success' : 'ms-badge-warning'
                      }`}>
                        {match.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="text-xs font-semibold text-ms-text-primary truncate">{match.team_a_name}</div>
                        <div className="text-xs font-mono font-bold text-ms-cyan mt-0.5 truncate">
                          {match.team_a_score ?? 0}/{match.team_a_wickets ?? 0}
                          <span className="text-[10px] text-ms-text-muted ml-1 font-normal">
                            ({match.team_a_overs || '0.0'})
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-ms-text-muted font-bold flex-shrink-0 px-1">vs</div>
                      <div className="flex-1 min-w-0 pl-1 text-right">
                        <div className="text-xs font-semibold text-ms-text-primary truncate">{match.team_b_name}</div>
                        <div className="text-xs font-mono font-bold text-ms-text-secondary mt-0.5 truncate">
                          {match.team_b_score ?? 0}/{match.team_b_wickets ?? 0}
                          <span className="text-[10px] text-ms-text-muted ml-1 font-normal">
                            ({match.team_b_overs || '0.0'})
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* For completed matches: Display WHO WON THAT MATCH prominently & Share/Delete options */}
                  {isCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-ms-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                          {winnerText || 'Match Completed'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Share Option (WhatsApp / native share) */}
                        <button
                          type="button"
                          onClick={(e) => handleShare(e, match)}
                          className="px-2 py-1 rounded-lg bg-ms-bg-elevated hover:bg-ms-cyan-subtle border border-ms-border text-ms-text-primary hover:text-ms-cyan text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Share match result on WhatsApp"
                        >
                          <Share2 className="w-3 h-3 text-ms-cyan" />
                          <span className="hidden sm:inline">Share</span>
                        </button>

                        {/* Delete Option for matches 2+ days old */}
                        {isOld && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMatch(e, match.id)}
                            className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-colors cursor-pointer"
                            title="Delete match (2+ days old)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* If not completed but 2+ days old, show delete option */}
                  {!isCompleted && isOld && (
                    <div className="mt-2 pt-1.5 border-t border-ms-border flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMatch(e, match.id)}
                        className="px-2 py-0.5 rounded text-[11px] text-red-500 hover:bg-red-500/10 flex items-center gap-1 cursor-pointer"
                        title="Delete old match"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Match</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
