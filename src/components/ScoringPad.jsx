import React, { useState } from 'react';
import { BALL_TYPES, WICKET_TYPES } from '../utils/cricketRules';
import { RotateCw, Undo2, AlertTriangle, Flag } from 'lucide-react';
import PlayerSelector from './PlayerSelector';

export default function ScoringPad({
  onScoreBall,
  onUndo,
  onWicket,
  onSwapStrike,
  onChangeBowler,
  onEndInnings,
  canUndo = false,
  isUndoing = false,
  strikerName = 'Striker',
  nonStrikerName = 'Non-Striker',
  bowlerName = 'Bowler'
}) {
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({
    type: WICKET_TYPES.CAUGHT,
    playerOut: 'striker',
    newBatter: '',
    newBatterId: '',
    fielder: ''
  });

  const [extraModal, setExtraModal] = useState(null);
  const [extraRuns, setExtraRuns] = useState(0);

  const handleOpenWicket = () => {
    setWicketDetails({
      type: WICKET_TYPES.CAUGHT,
      playerOut: 'striker',
      newBatter: '',
      newBatterId: '',
      fielder: ''
    });
    setShowWicketModal(true);
  };

  const handleConfirmWicket = (e) => {
    if (e) e.preventDefault();
    if (!wicketDetails.newBatterId || !wicketDetails.newBatter) {
      return;
    }
    onWicket({
      wicketType: wicketDetails.type,
      playerOut: wicketDetails.playerOut === 'striker' ? strikerName : nonStrikerName,
      isStriker: wicketDetails.playerOut === 'striker',
      newBatter: wicketDetails.newBatter?.trim(),
      newBatterId: wicketDetails.newBatterId,
      fielder: wicketDetails.fielder?.trim() || ''
    });
    setShowWicketModal(false);
  };

  const handleConfirmExtra = () => {
    if (!extraModal) return;
    let type = BALL_TYPES.NORMAL;
    if (extraModal === 'WD') type = BALL_TYPES.WIDE;
    else if (extraModal === 'NB') type = BALL_TYPES.NO_BALL;
    else if (extraModal === 'BYE') type = BALL_TYPES.BYE;
    else if (extraModal === 'LB') type = BALL_TYPES.LEG_BYE;

    const totalRuns = (type === BALL_TYPES.WIDE || type === BALL_TYPES.NO_BALL)
      ? 1 + Number(extraRuns)
      : Number(extraRuns);

    onScoreBall({
      runs: totalRuns,
      type,
      batsmanRuns: type === BALL_TYPES.NO_BALL ? Number(extraRuns) : 0,
      isFour: type === BALL_TYPES.NO_BALL && Number(extraRuns) === 4,
      isSix: type === BALL_TYPES.NO_BALL && Number(extraRuns) === 6
    });
    setExtraModal(null);
    setExtraRuns(0);
  };

  return (
    <div className="w-full bg-[#0d1830] border border-cyan-500/30 rounded-2xl p-3 shadow-xl select-none space-y-2 text-white touch-manipulation">
      {/* Quick Action Toolbar: Swap Strike, Change Bowler, End Innings */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-cyan-500/20">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSwapStrike}
            className="px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:text-white bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Rotate / Swap Batsmen Strike"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Swap Strike</span>
          </button>

          <button
            type="button"
            onClick={onChangeBowler}
            className="px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Change bowler or enter new bowler name"
          >
            <span>Change Bowler</span>
          </button>
        </div>

        {onEndInnings && (
          <button
            type="button"
            onClick={onEndInnings}
            className="p-1.5 text-amber-400 hover:text-amber-300 bg-transparent hover:bg-amber-950/30 rounded-lg transition-all cursor-pointer"
            title="Declare or End Innings"
          >
            <Flag className="w-4 h-4 text-amber-400" />
          </button>
        )}
      </div>

      {/* 6 Tactile Run Buttons (0, 1, 2, 3, 4, 6) */}
      <div className="pt-0.5">
        <div className="grid grid-cols-3 gap-2">
          {/* Top Row: 0, 1, 2 */}
          {/* 0 */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 0, type: BALL_TYPES.NORMAL })}
            className="h-14 sm:h-16 rounded-2xl bg-[#132038] hover:bg-[#1a2c4e] border border-slate-700/80 text-white font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer hover:border-cyan-400/60"
          >
            0
          </button>

          {/* 1 */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 1, type: BALL_TYPES.NORMAL })}
            className="h-14 sm:h-16 rounded-2xl bg-[#132038] hover:bg-[#1a2c4e] border border-slate-700/80 text-cyan-400 font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer hover:border-cyan-400/60"
          >
            1
          </button>

          {/* 2 */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 2, type: BALL_TYPES.NORMAL })}
            className="h-14 sm:h-16 rounded-2xl bg-[#132038] hover:bg-[#1a2c4e] border border-slate-700/80 text-cyan-400 font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer hover:border-cyan-400/60"
          >
            2
          </button>

          {/* Down Row: 3, 4, 6 */}
          {/* 3 */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 3, type: BALL_TYPES.NORMAL })}
            className="h-14 sm:h-16 rounded-2xl bg-[#132038] hover:bg-[#1a2c4e] border border-slate-700/80 text-cyan-400 font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer hover:border-cyan-400/60"
          >
            3
          </button>

          {/* 4 (Boundary) */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 4, type: BALL_TYPES.NORMAL, isFour: true })}
            className="h-14 sm:h-16 rounded-2xl bg-[#241a0d] hover:bg-[#2e2111] border-2 border-amber-500 text-amber-400 font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md shadow-amber-950/40 cursor-pointer"
          >
            4
          </button>

          {/* 6 (Six) */}
          <button
            type="button"
            onClick={() => onScoreBall({ runs: 6, type: BALL_TYPES.NORMAL, isSix: true })}
            className="h-14 sm:h-16 rounded-2xl bg-[#241038] hover:bg-[#2f154a] border-2 border-purple-500 text-purple-200 font-score text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md shadow-purple-950/40 cursor-pointer"
          >
            6
          </button>
        </div>
      </div>

      {/* Extras Grid (Wide Ball, No Ball, Leg Bye) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onScoreBall({ runs: 1, type: BALL_TYPES.WIDE, batsmanRuns: 0 })}
          className="h-11 rounded-full ms-btn-elevated font-semibold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
          title="Wide Ball: Instant +1 extra run"
        >
          Wide Ball
        </button>
        <button
          type="button"
          onClick={() => { setExtraRuns(0); setExtraModal('NB'); }}
          className="h-11 rounded-full ms-btn-elevated font-semibold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
        >
          No Ball
        </button>
        <button
          type="button"
          onClick={() => { setExtraRuns(1); setExtraModal('LB'); }}
          className="h-11 rounded-full ms-btn-elevated font-semibold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
        >
          Leg Bye
        </button>
      </div>

      {/* Primary Actions: WICKET / OUT & UNDO */}
      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={handleOpenWicket}
          className="col-span-2 h-11 rounded-full ms-btn-danger text-white font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-white" />
          <span>WICKET / OUT</span>
        </button>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || isUndoing}
          className="h-11 rounded-full ms-btn-elevated disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          title={isUndoing ? 'Reversing delivery...' : 'Undo last delivery'}
        >
          {isUndoing ? (
            <RotateCw className="w-3.5 h-3.5 text-white animate-spin" />
          ) : (
            <Undo2 className="w-3.5 h-3.5 text-white" />
          )}
          <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
        </button>
      </div>

      {/* Fall of Wicket Modal */}
      {showWicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleConfirmWicket} className="ms-card p-5 max-w-sm w-full bg-white dark:bg-[#111e38] border border-red-500/50 shadow-2xl rounded-2xl text-slate-900 dark:text-white">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              Fall of Wicket
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="ms-input-label text-xs">Dismissal Method</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {Object.values(WICKET_TYPES).map((type, idx) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setWicketDetails({ ...wicketDetails, type })}
                      className={`${idx < 3 ? 'col-span-2' : 'col-span-3'} py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer truncate ${
                        wicketDetails.type === type
                          ? 'bg-red-600 border-red-400 text-white font-black shadow-md ring-2 ring-red-500/40'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="ms-input-label text-xs">Batsman Dismissed</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWicketDetails({ ...wicketDetails, playerOut: 'striker' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left truncate ${
                      wicketDetails.playerOut === 'striker'
                        ? 'bg-red-600 border-red-400 text-white font-black shadow-md ring-2 ring-red-500/40'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    ★ {strikerName || 'Striker'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWicketDetails({ ...wicketDetails, playerOut: 'nonStriker' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left truncate ${
                      wicketDetails.playerOut === 'nonStriker'
                        ? 'bg-red-600 border-red-400 text-white font-black shadow-md ring-2 ring-red-500/40'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {nonStrikerName || 'Non-Striker'}
                  </button>
                </div>
              </div>

              <div>
                <label className="ms-input-label text-xs">Incoming Next Batsman Name (*)</label>
                <PlayerSelector
                  value={wicketDetails.newBatter}
                  selectedId={wicketDetails.newBatterId}
                  onChange={(player) =>
                    setWicketDetails((prev) => ({
                      ...prev,
                      newBatter: player ? player.name : '',
                      newBatterId: player ? (player.player_id || player.id) : ''
                    }))
                  }
                  disabledPlayers={[strikerName, nonStrikerName]}
                  placeholder="Search incoming batsman by name or ID..."
                  required
                />
              </div>

              <div>
                <label className="ms-input-label text-xs">Fielder / Catcher (Optional)</label>
                <PlayerSelector
                  value={wicketDetails.fielder}
                  onChange={(player) =>
                    setWicketDetails((prev) => ({
                      ...prev,
                      fielder: player ? player.name : ''
                    }))
                  }
                  placeholder="Search fielder by name or ID (optional)..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWicketModal(false)}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!wicketDetails.newBatterId || !wicketDetails.newBatter}
                className="ms-btn ms-btn-danger ms-btn-sm flex-1 cursor-pointer disabled:opacity-50"
              >
                Confirm OUT
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Extras Runs Selector Modal */}
      {extraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="ms-card p-5 max-w-xs w-full bg-white dark:bg-[#111e38] border border-cyan-500/50 shadow-2xl rounded-2xl text-slate-900 dark:text-white">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-cyan-400 font-bold">Extra:</span>
              {extraModal === 'WD' ? 'Wide Ball' : extraModal === 'NB' ? 'No Ball' : extraModal === 'BYE' ? 'Bye' : 'Leg Bye'}
            </h3>
            <div className={`grid ${extraModal === 'NB' ? 'grid-cols-6' : 'grid-cols-4'} gap-1.5 mb-5`}>
              {(extraModal === 'NB' ? [0, 1, 2, 3, 4, 6] : [1, 2, 3, 4]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setExtraRuns(r)}
                  className={`h-11 rounded-full font-score text-base font-bold transition-all cursor-pointer ${
                    extraRuns === r
                      ? 'ms-btn-primary shadow-md'
                      : 'ms-btn-elevated'
                  }`}
                >
                  +{r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setExtraModal(null); setExtraRuns(0); }}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExtra}
                className="ms-btn ms-btn-primary ms-btn-sm flex-1 cursor-pointer"
              >
                Add Extra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
