import React, { useState } from 'react';
import { formatOvers, calculateRunRate, calculateRequiredRunRate, calculateMatchEquation } from '../utils/cricketRules';
import { Edit2, History, X } from 'lucide-react';
import { DotBallIcon } from './CricketIcons';
import PlayerAvatar from './PlayerAvatar';

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
  onEditPlayer = () => {},
  isTest = false,
  inningsNumber = 1,
  allInnings = []
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
  const thisOverDeliveries = Array.isArray(currentOverDeliveries)
    ? currentOverDeliveries
    : [];

  // Compute this over runs
  const thisOverRuns = thisOverDeliveries.reduce((acc, b) => {
    if (!b) return acc;
    const match = b.match(/\d+/);
    return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
  }, 0);

  const strikerSr = striker?.balls ? ((striker.runs / striker.balls) * 100).toFixed(1) : '0.0';
  const nonStrikerSr = nonStriker?.balls ? ((nonStriker.runs / nonStriker.balls) * 100).toFixed(1) : '0.0';

  // Ball badge: render custom DotBallIcon for dot deliveries, colored badges for runs/wickets/extras
  const renderBallBadge = (ball, idx) => {
    const isW = ball.includes('W') && !ball.includes('Wd');
    const is4 = ball === '4';
    const is6 = ball === '6';
    const isExtra = ball.includes('Wd') || ball.includes('Nb') || ball.includes('Lb') || ball.includes('B');
    const isDot = ball === '0' || ball === '•';

    // Dot ball representation: concentric circle with inner solid dot as in reference image
    if (isDot) {
      return (
        <span
          key={idx}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-slate-900 dark:text-white"
          title="Dot ball (0 runs)"
        >
          <DotBallIcon className="w-5 h-5 text-slate-900 dark:text-white" />
        </span>
      );
    }

    // User requirement: In light theme, this over runs number background circle in black and text in white colour
    let badgeClass = 'bg-black text-white dark:bg-white dark:text-black font-black border border-black dark:border-slate-200 shadow-xs';
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
        className={`w-7 h-7 rounded-full border flex items-center justify-center font-score font-bold text-xs leading-none flex-shrink-0 tabular-nums ${badgeClass}`}
      >
        {ball}
      </span>
    );
  };

  return (
    <div className="w-full space-y-2 select-none">
      {/* Target Equation Bar (if 2nd innings) */}
      {equation && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3 py-1.5 text-xs font-semibold text-center tracking-wide rounded-xl shadow-xs flex items-center justify-center">
          <span className="font-score font-bold text-sm tracking-normal tabular-nums">{equation}</span>
        </div>
      )}

      {/* Multi-Innings Score Breakdown (Displays only for Test Match) */}
      {isTest && allInnings && allInnings.length > 0 && (
        <div className="p-2.5 rounded-xl border border-slate-200/90 dark:border-cyan-500/30 bg-white/95 dark:bg-[#0a1633]/90 shadow-xs space-y-1">
          {allInnings.map((inn, idx) => {
            const innNum = Number(inn.innings_number || idx + 1);
            const isCurrent = innNum === Number(inningsNumber);
            const hasBatted = inn.runs > 0 || inn.wickets > 0 || (inn.overs && inn.overs !== '0.0') || inn.innings_status === 'completed';
            const suffix = innNum === 1 ? '1st' : innNum === 2 ? '2nd' : innNum === 3 ? '3rd' : `${innNum}th`;
            const innTeam = inn.batting_team || inn.team_name || `Innings ${innNum}`;

            return (
              <div
                key={innNum}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  isCurrent
                    ? 'bg-cyan-500/15 border border-cyan-500/40 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                    {innTeam}
                  </span>
                  <span className="text-slate-400">–</span>
                  {isCurrent ? (
                    <span className="font-score font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                      {runs}/{wickets} ({oversFormatted} Overs)
                    </span>
                  ) : hasBatted ? (
                    <span className="font-score font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {inn.total_runs ?? inn.runs ?? 0}/{inn.wickets ?? 0} ({inn.overs || formatOvers(inn.balls_completed || 0)} Overs)
                    </span>
                  ) : (
                    <span className="italic text-slate-400 dark:text-slate-500">
                      Yet to Bat
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    – {suffix} Innings
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Scorecard Banner Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-cyan-500/30 bg-white dark:bg-[#0a1633] p-3.5 shadow-md shadow-slate-200/60 dark:shadow-none text-slate-800 dark:text-white transition-colors">
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60 dark:opacity-75" />

        {/* Main Scoreboard: Team, Prominent Center-Aligned Score, Overs, and CRR in right corner */}
        <div className="relative text-center">
          {/* Team & Innings Indicator */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs sm:text-sm text-cyan-700 dark:text-cyan-300 font-semibold uppercase tracking-wider">
              {battingTeam} Batting
            </span>
            {isTest && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                {inningsNumber === 1 ? '1st Inn' : inningsNumber === 2 ? '2nd Inn' : inningsNumber === 3 ? '3rd Inn' : `${inningsNumber}th Inn`}
              </span>
            )}
          </div>

          {/* 1. Main Score: Significantly larger, Barlow Condensed Bold, Center-Aligned, White in dark mode, Tabular */}
          <div className="my-0.5 flex items-center justify-center">
            <span className="font-score font-bold text-6xl sm:text-7xl text-slate-900 dark:text-white tabular-nums leading-none tracking-tight">
              {runs}<span className="text-slate-400 dark:text-slate-400/80 font-light text-4xl sm:text-5xl mx-1">/</span>{wickets}
            </span>
          </div>

          {/* 2. Overs, CRR, and RRR: Perfectly balanced, non-overlapping flex layout */}
          <div className="font-sans font-medium text-xs sm:text-sm text-slate-500 dark:text-slate-300 mt-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
            {/* Overs */}
            <div className="flex items-center gap-1">
              <span className="font-score font-semibold tabular-nums text-sm sm:text-base text-slate-700 dark:text-slate-200">{oversFormatted}</span>
              <span className="text-slate-400 dark:text-slate-500 font-light">/</span>
              <span className="font-score font-semibold tabular-nums text-sm sm:text-base text-slate-700 dark:text-slate-200">{totalOvers}</span>
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400 ml-0.5">OV</span>
            </div>

            <span className="text-slate-300 dark:text-slate-600 font-light">•</span>

            {/* CRR */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold tracking-wider uppercase">CRR</span>
              <span className="font-score font-bold text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums">{crr}</span>
            </div>

            {/* RRR: Only shown during live chase when overs remain and match is not completed */}
            {status !== 'completed' && target && ballsRemaining > 0 && rrr && !String(rrr).toLowerCase().includes('finished') && (
              <>
                <span className="text-slate-300 dark:text-slate-600 font-light">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-wider uppercase">RRR</span>
                  <span className="font-score font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-300 tabular-nums">{rrr}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Batter & Bowler Scoreboard Card (Exact UI Reference Match) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-300/90 dark:border-[#1b2b46] bg-white dark:bg-[#060c18] p-2.5 sm:p-3.5 text-slate-900 dark:text-white shadow-xs transition-colors">
        {/* Top: Column Headings */}
        <div className="flex items-center justify-between pb-1.5 px-1">
          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider pl-1 font-sans">
            BATTER
          </span>
          <div className="flex items-center font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-score tracking-wider">
            <span className="w-9 sm:w-11 text-center">R</span>
            <span className="w-9 sm:w-11 text-center">B</span>
            <span className="w-12 sm:w-15 text-center">SR</span>
          </div>
        </div>

        {/* Clean horizontal divider below headings */}
        <div className="border-b border-slate-200 dark:border-[#13233c] mb-2 sm:mb-2.5" />

        {/* Batter Rows */}
        <div className="space-y-1.5 sm:space-y-2">
          {/* Striker (Active Selected Batter) */}
          <div className="flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full border-2 border-slate-900 dark:border-white bg-white dark:bg-[#060c18] shadow-xs transition-all">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1 sm:pr-2">
              <PlayerAvatar
                key={striker?.id || striker?.player_id || striker?.name || 'striker'}
                player={striker}
                photoUrl={striker?.photo_url}
                name={striker?.name}
                size="sm"
                className="w-7 h-7 sm:w-8 sm:h-8 border-[1.5px] border-cyan-400 dark:border-cyan-400 shadow-2xs flex-shrink-0"
              />
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate uppercase tracking-tight">
                {striker?.name || 'Striker'}
              </span>
              <button
                type="button"
                onClick={() => onEditPlayer('striker', striker?.name || 'Striker')}
                className="p-0.5 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors flex-shrink-0 cursor-pointer"
                title="Edit striker name"
              >
                <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
            <div className="flex items-center font-score tabular-nums flex-shrink-0">
              <div className="w-9 sm:w-11 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-sm sm:text-base text-orange-500 dark:text-orange-400">
                  {striker?.runs ?? 0}
                </span>
              </div>
              <div className="w-9 sm:w-11 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {striker?.balls ?? 0}
                </span>
              </div>
              <div className="w-12 sm:w-15 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-xs sm:text-sm text-cyan-600 dark:text-cyan-400">
                  {strikerSr}
                </span>
              </div>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full border border-slate-300/80 dark:border-[#1c2d4a] bg-slate-50/70 dark:bg-[#070e1c]/60 transition-all">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1 sm:pr-2">
              <PlayerAvatar
                key={nonStriker?.id || nonStriker?.player_id || nonStriker?.name || 'non_striker'}
                player={nonStriker}
                photoUrl={nonStriker?.photo_url}
                name={nonStriker?.name}
                size="sm"
                className="w-7 h-7 sm:w-8 sm:h-8 border-[1.5px] border-cyan-400 dark:border-cyan-400 shadow-2xs flex-shrink-0"
              />
              <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate uppercase tracking-tight">
                {nonStriker?.name || 'Non-Striker'}
              </span>
              <button
                type="button"
                onClick={() => onEditPlayer('non_striker', nonStriker?.name || 'Non-Striker')}
                className="p-0.5 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors flex-shrink-0 cursor-pointer"
                title="Edit non-striker name"
              >
                <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
            <div className="flex items-center font-score tabular-nums flex-shrink-0">
              <div className="w-9 sm:w-11 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {nonStriker?.runs ?? 0}
                </span>
              </div>
              <div className="w-9 sm:w-11 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {nonStriker?.balls ?? 0}
                </span>
              </div>
              <div className="w-12 sm:w-15 text-center border-l border-slate-200 dark:border-[#1c2d4a] py-0.5">
                <span className="font-bold text-xs sm:text-sm text-cyan-600 dark:text-cyan-400">
                  {nonStrikerSr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clean horizontal divider before Bowler */}
        <div className="border-t border-slate-200 dark:border-[#13233c] my-2 sm:my-2.5" />

        {/* Bowler Section */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1 sm:pr-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-sans flex-shrink-0">
              BOWLER:
            </span>
            <PlayerAvatar
              key={bowler?.id || bowler?.player_id || bowler?.name || 'bowler'}
              player={bowler}
              photoUrl={bowler?.photo_url}
              name={bowler?.name}
              size="sm"
              className="w-7 h-7 sm:w-8 sm:h-8 border-[1.5px] border-cyan-400 dark:border-cyan-400 shadow-2xs flex-shrink-0"
            />
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate uppercase tracking-tight">
              {bowler?.name || 'Bowler'}
            </span>
            <button
              type="button"
              onClick={() => onEditPlayer('bowler', bowler?.name || 'Bowler')}
              className="p-0.5 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors flex-shrink-0 cursor-pointer"
              title="Edit bowler name"
            >
              <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          <div className="rounded-full border border-slate-300/80 dark:border-[#1c2d4a] bg-slate-100/90 dark:bg-[#071122]/90 px-2.5 sm:px-3 py-1 text-xs font-score tabular-nums flex items-center shadow-2xs flex-shrink-0">
            <span className="font-bold text-orange-500 dark:text-orange-400 text-xs sm:text-sm">
              {bowler?.wickets ?? 0}
            </span>
            <span className="text-slate-400 dark:text-white/70 mx-1 font-sans font-medium">
              -
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              {bowler?.runs ?? 0}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] sm:text-xs ml-1">
              ({bowler?.overs ?? '0.0'} ov)
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: THIS OVER Strip */}
      <div className="rounded-xl bg-white dark:bg-[#0c1730] border border-slate-200/90 dark:border-cyan-500/30 px-3 py-2 shadow-xs dark:shadow-none flex items-center justify-between gap-2 transition-colors">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-cyan-700 dark:text-cyan-300 uppercase font-semibold tracking-wider whitespace-nowrap font-sans">
            THIS OVER:
          </span>
          <div className="flex items-center gap-1.5">
            {thisOverDeliveries.length === 0 ? (
              <span className="text-slate-400 text-xs italic font-sans">Ready...</span>
            ) : (
              thisOverDeliveries.map((ball, idx) => renderBallBadge(ball, idx))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-score text-sm text-cyan-700 dark:text-cyan-300 font-bold whitespace-nowrap tabular-nums">
            {thisOverRuns} runs
          </span>
          {completedOvers && completedOvers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
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
          <div className="ms-card p-4 max-w-sm w-full bg-white dark:bg-[#0d1830] border border-slate-200 dark:border-cyan-500/50 shadow-2xl rounded-2xl text-slate-800 dark:text-white">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-cyan-500/20">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Completed Overs ({completedOvers.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {completedOvers.slice().reverse().map((overItem, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-score font-bold text-cyan-700 dark:text-cyan-300 tabular-nums">
                        Over {overItem.overNumber}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[140px]">
                        ({overItem.bowler})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {overItem.runs === 0 && (
                        <span className="text-[8px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded font-sans">
                          Maiden
                        </span>
                      )}
                      <span className="font-score font-bold text-xs text-slate-900 dark:text-white tabular-nums">
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
              className="ms-btn ms-btn-outline ms-btn-sm w-full mt-3 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
