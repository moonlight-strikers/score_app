import React, { useState } from 'react';
import { formatOvers, calculateRunRate, calculateRequiredRunRate, calculateMatchEquation } from '../utils/cricketRules';
import { Edit2, History, X } from 'lucide-react';

export default function Scoreboard({
  battingTeam = 'Team A',
  bowlingTeam = 'Team B',
  runs = 0,
  wickets = 0,
  legalBalls = 0,
  totalOvers = 20,
  striker = { name: 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
  nonStriker = { name: 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
  bowler = { name: 'Bowler', overs: '0.0', maidens: 0, runs: 0, wickets: 0, economy: '0.00' },
  target = null,
  status = 'live',
  recentBalls = [],
  currentOverDeliveries = [],
  completedOvers = [],
  onEditPlayer = () => {}
}) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const oversFormatted = formatOvers(legalBalls);
  const crr = calculateRunRate(runs, legalBalls);
  const totalMaxBalls = totalOvers * 6;
  const ballsRemaining = Math.max(0, totalMaxBalls - legalBalls);
  const rrr = target ? calculateRequiredRunRate(target, runs, ballsRemaining) : null;
  const equation = target ? calculateMatchEquation(target, runs, ballsRemaining, battingTeam) : null;

  // Calculate balls bowled in current over
  const ballsInCurrentOver = legalBalls % 6;
  const isOverJustFinished = ballsInCurrentOver === 0 && legalBalls > 0;
  const currentOverNumber = Math.floor(legalBalls / 6) + (isOverJustFinished ? 0 : 1);

  // Strictly get only the deliveries of the current over
  const thisOverDeliveries = (currentOverDeliveries && currentOverDeliveries.length > 0)
    ? currentOverDeliveries
    : (recentBalls && recentBalls.length > 0)
      ? recentBalls.slice(-(ballsInCurrentOver || (isOverJustFinished ? 6 : 0)))
      : [];

  // Compute this over runs
  const thisOverRuns = thisOverDeliveries.reduce((acc, b) => {
    if (!b) return acc;
    const match = b.match(/\d+/);
    return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
  }, 0);

  const strikerSr = striker?.balls ? ((striker.runs / striker.balls) * 100).toFixed(1) : '0.0';
  const nonStrikerSr = nonStriker?.balls ? ((nonStriker.runs / nonStriker.balls) * 100).toFixed(1) : '0.0';

  // Ball badge: white background and black numbers for crystal clear visibility
  const renderBallBadge = (ball, idx) => {
    const isW = ball.includes('W') && !ball.includes('Wd');
    const is4 = ball === '4';
    const is6 = ball === '6';
    const isExtra = ball.includes('Wd') || ball.includes('Nb');

    // User requirement: white background and black numbers for high contrast
    let badgeClass = 'bg-white text-black font-black border border-slate-200 shadow-xs';
    if (isW) {
      badgeClass = 'bg-red-600 text-white font-black border-red-500 shadow-xs';
    } else if (is4) {
      badgeClass = 'bg-amber-400 text-black font-black border-amber-500 shadow-xs';
    } else if (is6) {
      badgeClass = 'bg-purple-600 text-white font-black border-purple-500 shadow-xs';
    } else if (isExtra) {
      badgeClass = 'bg-cyan-300 text-black font-black border-cyan-400 shadow-xs';
    }

    return (
      <span
        key={idx}
        className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono text-xs leading-none flex-shrink-0 ${badgeClass}`}
      >
        {ball}
      </span>
    );
  };

  return (
    <div className="w-full space-y-2 select-none">
      {/* Target Equation Bar (if 2nd innings) */}
      {equation && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1 text-xs font-bold text-center tracking-wide rounded-lg shadow-xs">
          <span>{equation}</span>
          {rrr && <span className="ml-2 text-slate-300">• Req RR: <strong className="text-amber-300">{rrr}</strong></span>}
        </div>
      )}

      {/* Main Scorecard Banner Card — Exact Match with User Screenshot */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#0a1633] p-3.5 shadow-xl text-white">
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75" />

        {/* Top: Team Name + Giant Score with inline overs + RUN RATE box */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
          <div>
            <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider block">
              {battingTeam} Batting
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="font-mono font-black text-5xl sm:text-6xl text-amber-400 tracking-tight drop-shadow-md">
                {runs}<span className="text-white/60 font-light text-3xl sm:text-4xl">/</span>{wickets}
              </span>
              <span className="text-sm sm:text-base font-bold text-cyan-200/90 font-mono">
                ({oversFormatted} / {totalOvers} ov)
              </span>
            </div>
          </div>

          {/* RUN RATE Box on Right */}
          <div className="px-3.5 py-2 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-center min-w-[76px] shadow-sm">
            <span className="text-[10px] text-cyan-300 uppercase font-black tracking-wider block">
              RUN RATE
            </span>
            <span className="font-mono font-black text-base sm:text-lg text-white">
              {crr}
            </span>
          </div>
        </div>

        {/* Middle: Active Batters Table */}
        <div className="py-2.5 border-b border-cyan-500/20 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold px-1">
            <span>BATTER</span>
            <div className="flex items-center gap-4 font-mono">
              <span className="w-8 text-right">R</span>
              <span className="w-8 text-right">B</span>
              <span className="w-12 text-right">SR</span>
            </div>
          </div>

          {/* Striker */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span className="text-amber-400 text-xs font-black animate-pulse">▶</span>
              <span className="font-bold text-sm text-white truncate">
                {striker?.name || 'Striker'}
              </span>
              <button
                type="button"
                onClick={() => onEditPlayer('striker', striker?.name || 'Striker')}
                className="p-0.5 text-cyan-400 hover:text-white transition-colors cursor-pointer"
                title="Edit striker name"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs flex-shrink-0">
              <span className="w-8 text-right font-black text-amber-400 text-sm">{striker?.runs ?? 0}</span>
              <span className="w-8 text-right text-slate-300">{striker?.balls ?? 0}</span>
              <span className="w-12 text-right text-cyan-300 font-semibold">{strikerSr}</span>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div className="flex items-center gap-1.5 min-w-0 pr-2 pl-3">
              <span className="font-medium text-sm text-slate-200 truncate">
                {nonStriker?.name || 'Non-Striker'}
              </span>
              <button
                type="button"
                onClick={() => onEditPlayer('non_striker', nonStriker?.name || 'Non-Striker')}
                className="p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Edit non-striker name"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs flex-shrink-0">
              <span className="w-8 text-right font-bold text-white text-sm">{nonStriker?.runs ?? 0}</span>
              <span className="w-8 text-right text-slate-400">{nonStriker?.balls ?? 0}</span>
              <span className="w-12 text-right text-slate-300 font-semibold">{nonStrikerSr}</span>
            </div>
          </div>
        </div>

        {/* Bottom: Active Bowler & Figures */}
        <div className="pt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-cyan-300 uppercase font-black tracking-wider">
              BOWLER:
            </span>
            <span className="font-bold text-sm text-white truncate max-w-[150px] sm:max-w-[200px]">
              {bowler?.name || 'Bowler'}
            </span>
            <button
              type="button"
              onClick={() => onEditPlayer('bowler', bowler?.name || 'Bowler')}
              className="p-0.5 text-cyan-400 hover:text-white transition-colors cursor-pointer"
              title="Edit bowler name"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1">
            <span className="font-bold text-amber-300">{bowler?.wickets ?? 0}</span>
            <span className="text-white/60">-</span>
            <span className="font-bold text-white">{bowler?.runs ?? 0}</span>
            <span className="text-slate-400 ml-1.5">({bowler?.overs ?? '0.0'} ov)</span>
          </div>
        </div>
      </div>

      {/* Card 2: THIS OVER Strip — Exact Match with User Screenshot */}
      <div className="rounded-xl bg-[#0c1730] border border-cyan-500/30 px-3 py-2 shadow-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-cyan-300 uppercase font-black tracking-wider whitespace-nowrap">
            THIS OVER:
          </span>
          <div className="flex items-center gap-1.5">
            {thisOverDeliveries.length === 0 ? (
              <span className="text-slate-400 text-xs italic">Ready...</span>
            ) : (
              thisOverDeliveries.map((ball, idx) => renderBallBadge(ball, idx))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-xs text-cyan-300 font-bold whitespace-nowrap">
            {thisOverRuns} runs
          </span>
          {completedOvers && completedOvers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title={`View ${completedOvers.length} completed overs`}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Completed Overs Modal (Accessible via history icon without cluttering the main screen) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-4 max-w-sm w-full bg-[#0d1830] border border-cyan-500/50 shadow-2xl rounded-2xl text-white">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  Completed Overs ({completedOvers.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {completedOvers.slice().reverse().map((overItem, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-cyan-300">
                        Over {overItem.overNumber}
                      </span>
                      <span className="text-slate-300 text-[11px] truncate max-w-[140px]">
                        ({overItem.bowler})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {overItem.runs === 0 && (
                        <span className="text-[8px] uppercase font-black text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded">
                          Maiden
                        </span>
                      )}
                      <span className="font-mono font-bold text-xs text-white">
                        {overItem.runs} {overItem.runs === 1 ? 'run' : 'runs'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(overItem.deliveries || []).map((b, bIdx) => renderBallBadge(b, bIdx))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="w-full mt-3 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
