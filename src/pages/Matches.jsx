import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchService } from '../services/matchService';
import { supabase } from '../services/supabase';
import { Trophy, Plus, Calendar, ChevronRight, Zap, Share2, Trash2 } from 'lucide-react';
import { shareMatchResult, isTwoDaysOld, formatMatchDate, formatMatchTime } from '../utils/shareMatch';

export default function Matches() {
  const [filter, setFilter] = useState('all'); // 'all' | 'live' | 'completed' | 'scheduled'
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    fetchMatches();

    const channel = supabase
      .channel('matches-list-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchMatches() {
    try {
      const data = await matchService.getMatches();
      setMatches(data || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (matchId) => {
    if (window.confirm('Are you sure you want to delete this match record?')) {
      await matchService.deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    }
  };

  const handleShare = async (match) => {
    await shareMatchResult(match);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const filteredMatches = matches.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'live') return m.status === 'live' || m.status === 'on_hold';
    if (filter === 'completed') return m.status === 'completed';
    if (filter === 'scheduled') return m.status === 'scheduled';
    return true;
  });

  return (
    <div className="ms-page pb-4">
      {/* Toast notification */}
      {shareToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-ms-cyan text-ms-text-inverse px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-fadeIn flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          <span>Match details shared!</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold text-ms-text-primary tracking-tight truncate">
            Matches & Fixtures
          </h1>
          <p className="text-[11px] text-ms-text-muted mt-0.5 truncate">
            Saturday night league records & scorecards
          </p>
        </div>
        <Link to="/matches/create" className="ms-btn ms-btn-primary text-xs py-1.5 px-3 flex-shrink-0 flex items-center gap-1 font-bold">
          <Plus className="w-3.5 h-3.5" />
          <span>New Match</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Matches' },
          { key: 'live', label: 'Live' },
          { key: 'completed', label: 'Completed' },
          { key: 'scheduled', label: 'Scheduled' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filter === tab.key
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
          <p className="text-xs text-ms-text-muted">Loading matches...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="ms-card ms-empty-state py-8 px-4 text-center">
          <Trophy className="w-8 h-8 mx-auto text-ms-text-muted mb-2.5 opacity-50" />
          <p className="text-xs font-semibold text-ms-text-primary">No matches found</p>
          <p className="text-[11px] text-ms-text-muted mt-0.5 max-w-xs mx-auto">
            {filter === 'all'
              ? 'Start scoring your first Saturday night game now.'
              : `There are currently no ${filter} matches in the records.`}
          </p>
          <Link to="/matches/create" className="ms-btn ms-btn-primary text-xs py-1.5 px-3 rounded-lg mt-3.5 inline-flex items-center gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            <span>Create Match</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMatches.map((m) => {
            const isLive = m.status === 'live';
            const isCompleted = m.status === 'completed';
            const isOld = isTwoDaysOld(m.created_at);
            const winnerText = m.result || (m.winner_team ? `${m.winner_team} Won!` : null);

            return (
              <div
                key={m.id}
                className={`ms-card p-3 transition-all hover:border-ms-border-light relative overflow-hidden bg-ms-bg-card border-ms-border ${
                  isLive ? 'border-red-500/40 bg-gradient-to-r from-ms-bg-card via-ms-bg-card to-red-500/5' : ''
                }`}
              >
                {/* Header Row */}
                <div className="relative flex items-center justify-between mb-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                    {isLive ? (
                      <span className="ms-live-badge text-[10px] py-0.5 px-2 flex-shrink-0 font-bold">
                        <span className="ms-live-dot" />
                        Live
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatMatchDate(m.created_at)}</span>
                        {m.created_at && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-400 font-normal">
                            {formatMatchTime(m.created_at)}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {m.venue && !m.venue.toLowerCase().includes('oval') ? `• ${m.venue} ` : ''}({m.match_type === 'test' ? `${m.overs || 20} ov/inn` : `${m.overs || 16} ov`})
                    </span>
                  </div>

                  {(m.match_type === 'test' || m.configured_innings > 2) && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/30 shadow-xs">
                        TEST
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isLive && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                      }`}>
                        {m.status?.toUpperCase() || 'MATCH'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Teams & Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5 min-w-0">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-ms-bg-input/60 border border-ms-border min-w-0">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate flex-1 min-w-0 pr-1 tracking-tight">
                      {m.team_a_name}
                    </span>
                    <span className="font-score text-base sm:text-lg font-bold text-cyan-600 dark:text-cyan-400 flex-shrink-0 tabular-nums">
                      {m.team_a_score ?? 0}/{m.team_a_wickets ?? 0}
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 ml-1 font-semibold tabular-nums font-score">
                        ({m.team_a_overs || '0.0'})
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-ms-bg-input/60 border border-ms-border min-w-0">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate flex-1 min-w-0 pr-1 tracking-tight">
                      {m.team_b_name}
                    </span>
                    <span className="font-score text-base sm:text-lg font-bold text-slate-900 dark:text-white flex-shrink-0 tabular-nums">
                      {m.team_b_score ?? 0}/{m.team_b_wickets ?? 0}
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 ml-1 font-semibold tabular-nums font-score">
                        ({m.team_b_overs || '0.0'})
                      </span>
                    </span>
                  </div>
                </div>

                {/* Completed Match: Display WHO WON THAT MATCH prominently */}
                {isCompleted && (
                  <div className="mb-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300">
                        {winnerText || 'Match Completed'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Match Target Equation */}
                {isLive && m.target && (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-black dark:text-white flex-shrink-0" />
                    <span>Target: <strong className="font-score font-bold text-sm tabular-nums">{m.target}</strong> Runs</span>
                  </p>
                )}

                {/* Action buttons: Share, Delete (if 2+ days old), View/Score */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-ms-border">
                  <div className="flex items-center gap-1.5">
                    {/* Share Button for completed matches */}
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleShare(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-ms-bg-elevated hover:bg-ms-cyan-subtle border border-ms-border text-ms-text-primary hover:text-ms-cyan text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5 text-ms-cyan" />
                        <span>Share</span>
                      </button>
                    )}

                    {/* Delete Option for matches 2+ days old */}
                    {isOld && (
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Delete this match (2+ days old)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/live/${m.id}`}
                    className={`ms-btn text-xs py-1.5 px-3 flex items-center gap-1 ${
                      isLive ? 'ms-btn-primary' : 'ms-btn-secondary'
                    }`}
                  >
                    <span>{isLive ? 'Score / Watch Live' : 'View Scorecard'}</span>
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
