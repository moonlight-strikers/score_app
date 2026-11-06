import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Scoreboard from '../components/Scoreboard';
import ScoringPad from '../components/ScoringPad';
import Scorecard from '../components/Scorecard';
import PlayerSelector from '../components/PlayerSelector';
import { matchService } from '../services/matchService';
import { scoringService } from '../services/scoringService';
import { inningsService } from '../services/inningsService';
import { playerService } from '../services/playerService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { BALL_TYPES, isLegalDelivery, isWideDelivery, isNoBallDelivery, formatOvers } from '../utils/cricketRules';
import {
  Share2,
  ArrowLeft,
  Trophy,
  CheckCircle2,
  RotateCw,
  Edit2,
  User,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  Pause,
  Play,
  Ban,
  Trash2,
  X,
  AlertTriangle,
  Undo2
} from 'lucide-react';
import { shareMatchResult } from '../utils/shareMatch';
import { useAdmin } from '../contexts/AdminContext';

export default function LiveMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { isAdmin, adminToken } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'scorecard'
  const [copied, setCopied] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const isScoringDebounceRef = useRef(false);
  const isOperationBusyRef = useRef(false);
  const lastLocalActionTimeRef = useRef(0);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoConfirmModal, setUndoConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  // Serialized operation runner: guarantees that only one database-mutating scoring or undo action runs at a time
  const runSerializedOperation = async (actionName, operationFn) => {
    if (isOperationBusyRef.current) {
      console.warn(`[UndoDebug] ${actionName} blocked: another database operation is actively processing`);
      return false;
    }
    isOperationBusyRef.current = true;
    setIsSaving(true);
    lastLocalActionTimeRef.current = Date.now();
    console.log(`[UndoDebug] Starting serialized operation: ${actionName}`);
    try {
      await operationFn();
      return true;
    } finally {
      lastLocalActionTimeRef.current = Date.now();
      isOperationBusyRef.current = false;
      setIsSaving(false);
      console.log(`[UndoDebug] Finished serialized operation: ${actionName}`);
    }
  };

  // Match management actions (Hold, Cancel, Delete)
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Undo history stack
  const [historyStack, setHistoryStack] = useState([]);

  // Change bowler dialog
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const [newBowlerName, setNewBowlerName] = useState('');
  const [newBowlerId, setNewBowlerId] = useState('');

  // End innings dialog & next innings opening players
  const [showEndInningsModal, setShowEndInningsModal] = useState(false);
  const [nextInningsBattingChoice, setNextInningsBattingChoice] = useState(null); // 'normal' | 'follow_on'
  const [secondInningsForm, setSecondInningsForm] = useState({
    striker: '',
    strikerId: '',
    nonStriker: '',
    nonStrikerId: '',
    bowler: '',
    bowlerId: ''
  });

  // Edit player name dialog (on the fly while playing)
  const [editPlayerModal, setEditPlayerModal] = useState({
    isOpen: false,
    role: '', // 'striker' | 'non_striker' | 'bowler'
    name: '',
    playerId: ''
  });

  const handleToggleHoldMatch = async () => {
    if (!matchData) return;
    const isHold = matchData.status === 'on_hold';
    const newStatus = isHold ? 'live' : 'on_hold';
    setMatchData((prev) => ({ ...prev, status: newStatus }));
    setShowActionsModal(false);
    try {
      await matchService.updateMatch(matchData.id, { status: newStatus });
    } catch (err) {
      console.error('Error updating match hold status:', err);
      setErrorMessage(`Failed to update match status: ${err.message}`);
    }
  };

  const handleConfirmCancelMatch = async () => {
    if (!matchData) return;
    setCancelConfirmOpen(false);
    setShowActionsModal(false);
    const newStatus = 'cancelled';
    const resultText = 'Match Cancelled';
    setMatchData((prev) => ({ ...prev, status: newStatus, result: resultText }));
    try {
      await matchService.updateMatch(matchData.id, { status: newStatus, result: resultText });
    } catch (err) {
      console.error('Error cancelling match:', err);
      setErrorMessage(`Failed to cancel match: ${err.message}`);
    }
  };

  const handleResumeCancelledMatch = async () => {
    if (!matchData) return;
    setMatchData((prev) => ({ ...prev, status: 'live', result: null }));
    try {
      await matchService.updateMatch(matchData.id, { status: 'live', result: null });
    } catch (err) {
      console.error('Error reopening match:', err);
    }
  };

  const handleConfirmDeleteMatch = async () => {
    if (!matchData) return;
    setDeleteConfirmOpen(false);
    setShowActionsModal(false);
    setIsSaving(true);
    try {
      await matchService.deleteMatch(matchData.id, adminToken);
      navigate('/matches');
    } catch (err) {
      console.error('Error deleting match:', err);
      setErrorMessage(`Failed to delete match: ${err.message}`);
      setIsSaving(false);
    }
  };

  // Load match data and reconcile with persisted balls
  const loadMatchAndBalls = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [match, dbInnings] = await Promise.all([
        matchService.getMatchById(matchId),
        inningsService.getInningsByMatch(matchId).catch(() => [])
      ]);
      if (match) {
        // Fetch persisted balls for the current innings to verify score consistency
        const currentInn = match.current_innings || 1;
        const balls = await scoringService.getInningsBalls(matchId, currentInn);

        if (Array.isArray(balls)) {
          const stats = scoringService.calculateInningsScore(balls);
          const isFirst = currentInn === 1;

          // Reconcile innings_data array
          let existingInnings = Array.isArray(match.innings_data) ? [...match.innings_data] : [];

          // Merge dbInnings if present to ensure all configured innings have their metadata & IDs
          if (Array.isArray(dbInnings) && dbInnings.length > 0) {
            dbInnings.forEach((dbInn) => {
              const idx = existingInnings.findIndex((i) => i.innings_number === dbInn.innings_number);
              if (idx >= 0) {
                existingInnings[idx] = {
                  ...dbInn,
                  ...existingInnings[idx],
                  id: dbInn.id || existingInnings[idx].id,
                  innings_status: dbInn.innings_status || existingInnings[idx].innings_status,
                  batting_team: dbInn.batting_team || existingInnings[idx].batting_team || existingInnings[idx].team_name,
                  bowling_team: dbInn.bowling_team || existingInnings[idx].bowling_team
                };
              } else {
                existingInnings.push({
                  ...dbInn,
                  team_name: dbInn.batting_team,
                  runs: dbInn.total_runs || 0,
                  wickets: dbInn.wickets || 0,
                  overs: formatOvers(dbInn.balls_completed || 0),
                  batters: [],
                  bowlers: [],
                  extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: dbInn.extras || 0 }
                });
              }
            });
            existingInnings.sort((a, b) => (a.innings_number || 0) - (b.innings_number || 0));
          }

          const innIdx = existingInnings.findIndex((inn) => inn.innings_number === currentInn);
          const currentBatTeam = isFirst
            ? (match.current_batting_team || match.team_a_name)
            : (match.current_batting_team || match.team_b_name);

          // Merge existing innings batters with calculated ball stats & active crease batters
          const existingBatters = existingInnings[innIdx]?.batters || [];
          const batterMap = new Map();

          // 1. Seed from existing batters to preserve batting order
          existingBatters.forEach((b) => {
            if (b?.name) batterMap.set(b.name, { ...b });
          });

          // 2. Overlay verified ball stats
          (stats.batters || []).forEach((b) => {
            if (b?.name) {
              const prev = batterMap.get(b.name) || {};
              batterMap.set(b.name, { ...prev, ...b });
            }
          });

          // 3. Ensure active crease batters are included and marked notOut: true (unless dismissed)
          if (match.striker?.name) {
            const prev = batterMap.get(match.striker.name) || {};
            batterMap.set(match.striker.name, {
              ...prev,
              ...match.striker,
              notOut: prev.dismissal ? false : true
            });
          }
          if (match.non_striker?.name) {
            const prev = batterMap.get(match.non_striker.name) || {};
            batterMap.set(match.non_striker.name, {
              ...prev,
              ...match.non_striker,
              notOut: prev.dismissal ? false : true
            });
          }

          const reconciledBatters = Array.from(batterMap.values());

          const syncedInningsObj = {
            ...(existingInnings[innIdx] || {}),
            innings_number: currentInn,
            team_name: currentBatTeam,
            batting_team: currentBatTeam,
            runs: stats.runs,
            total_runs: stats.runs,
            wickets: stats.wickets,
            overs: stats.overs,
            overs_completed: Math.floor(stats.legalBalls / 6),
            balls_completed: stats.legalBalls,
            batters: reconciledBatters.length > 0 ? reconciledBatters : existingBatters,
            bowlers: stats.bowlers.length > 0 ? stats.bowlers : (existingInnings[innIdx]?.bowlers || []),
            extras: stats.extras
          };

          if (innIdx >= 0) {
            existingInnings[innIdx] = { ...existingInnings[innIdx], ...syncedInningsObj };
          } else {
            existingInnings.push(syncedInningsObj);
          }

          // Reconcile summary with balls
          const isTeamA = currentBatTeam === match.team_a_name;
          const verifiedMatch = {
            ...match,
            team_a_score: isTeamA ? stats.runs : match.team_a_score,
            team_a_wickets: isTeamA ? stats.wickets : match.team_a_wickets,
            team_a_overs: isTeamA ? stats.overs : match.team_a_overs,
            team_b_score: !isTeamA ? stats.runs : match.team_b_score,
            team_b_wickets: !isTeamA ? stats.wickets : match.team_b_wickets,
            team_b_overs: !isTeamA ? stats.overs : match.team_b_overs,
            recent_balls: stats.recentBalls,
            current_over_deliveries: stats.currentOverDeliveries,
            completed_overs: stats.completedOvers,
            total_deliveries: balls.length,
            innings_data: existingInnings
          };
          setMatchData(verifiedMatch);
        } else {
          setMatchData(match);
        }
      } else {
        setMatchData(null);
      }
    } catch (err) {
      console.error('Error loading match and balls:', err);
      setErrorMessage(err.message || 'Error connecting to match database');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadMatchAndBalls();

    // Supabase Realtime multi-device synchronization
    let channel = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`realtime_live_match_${matchId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
          (payload) => {
            if (!isMounted || !payload.new) return;
            // Ignore if local operation is currently processing or finished within last 2 seconds
            if (isOperationBusyRef.current || (Date.now() - lastLocalActionTimeRef.current < 2000)) {
              console.log('[UndoDebug] Realtime: Ignored matches echo from local write');
              return;
            }
            console.log('[UndoDebug] Realtime: Applying external matches update');
            setMatchData((prev) => {
              if (!prev) return payload.new;
              return { ...prev, ...payload.new };
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ball_by_ball', filter: `match_id=eq.${matchId}` },
          (payload) => {
            if (!isMounted) return;
            if (isOperationBusyRef.current || (Date.now() - lastLocalActionTimeRef.current < 2000)) {
              console.log('[UndoDebug] Realtime: Ignored ball_by_ball echo from local write:', payload.eventType);
              return;
            }
            console.log('[UndoDebug] Realtime: External ball_by_ball change detected, syncing match and balls');
            loadMatchAndBalls(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'innings', filter: `match_id=eq.${matchId}` },
          () => {
            if (!isMounted) return;
            if (isOperationBusyRef.current || (Date.now() - lastLocalActionTimeRef.current < 2000)) {
              console.log('[UndoDebug] Realtime: Ignored innings echo from local write');
              return;
            }
            console.log('[UndoDebug] Realtime: External innings change detected, syncing match and balls');
            loadMatchAndBalls(true);
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [matchId]);

  if (loading) {
    return (
      <div className="ms-page flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ms-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-ms-text-muted">Loading match scoreboard & ball logs...</p>
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="ms-page max-w-lg mx-auto py-12 text-center">
        <h2 className="text-lg font-bold text-ms-text-primary mb-2">Match Not Found</h2>
        <p className="text-xs text-ms-text-muted mb-4">The requested match fixture could not be loaded from database.</p>
        <Link to="/matches" className="ms-btn ms-btn-primary text-xs">
          Browse All Matches
        </Link>
      </div>
    );
  }

  const currentInnNum = matchData.current_innings || 1;
  const isFirstInnings = currentInnNum === 1;
  const isTestMatch = matchData.match_type === 'test';
  const maxConfiguredInnings = isTestMatch ? (Number(matchData.configured_innings) || 4) : 2;
  const oversPerInnings = isTestMatch ? (Number(matchData.overs_per_innings || matchData.overs) || 20) : (Number(matchData.overs) || 20);

  const currentInnData = Array.isArray(matchData.innings_data)
    ? matchData.innings_data.find((inn) => inn.innings_number === currentInnNum)
    : null;

  const currentRuns = currentInnData?.runs ?? (isFirstInnings ? (matchData.team_a_score || 0) : (matchData.team_b_score || 0));
  const currentWickets = currentInnData?.wickets ?? (isFirstInnings ? (matchData.team_a_wickets || 0) : (matchData.team_b_wickets || 0));
  const currentOversStr = currentInnData?.overs ?? (isFirstInnings ? (matchData.team_a_overs || '0.0') : (matchData.team_b_overs || '0.0'));
  const currentBattingTeam = currentInnData?.batting_team || currentInnData?.team_name || matchData.current_batting_team || (isFirstInnings ? matchData.team_a_name : matchData.team_b_name);
  const currentBowlingTeam = currentInnData?.bowling_team || matchData.current_bowling_team || (currentBattingTeam === matchData.team_a_name ? matchData.team_b_name : matchData.team_a_name);

  // Convert overs string to legal balls count
  const [ovFull, ovBalls] = currentOversStr.split('.').map(Number);
  const currentLegalBalls = (ovFull || 0) * 6 + (ovBalls || 0);

  // Check if undo is possible in current innings
  const currentDeliveriesCount = (matchData.total_deliveries ?? 0) > 0
    ? matchData.total_deliveries
    : (matchData.recent_balls?.length ?? 0);
  const canPerformUndo = (currentDeliveriesCount > 0 || historyStack.length > 0 || currentLegalBalls > 0) && !isUndoing && !isSaving && !isOperationBusyRef.current;

  // Save current state for Undo
  const pushHistory = () => {
    setHistoryStack((prev) => [JSON.parse(JSON.stringify(matchData)), ...prev.slice(0, 30)]);
  };

  // Helper to resolve complete player metadata (id, player_id, photo_url) across crease snapshots, history, match data, and cache
  const resolvePlayerMetadata = (playerName, fallbackCandidates = []) => {
    if (!playerName) return null;
    const clean = String(playerName).trim().toUpperCase();

    // 1. Check fallback candidate objects (crease.savedCrease, historyStack[0], matchData)
    for (const cand of fallbackCandidates) {
      if (!cand) continue;
      const cName = (cand.name || cand.full_name || '').trim().toUpperCase();
      if (cName === clean) {
        if (cand.photo_url || cand.id || cand.player_id) {
          return cand;
        }
      }
    }

    // 2. Search matchData innings_data batters and bowlers
    if (Array.isArray(matchData?.innings_data)) {
      for (const inn of matchData.innings_data) {
        const foundB = (inn.batters || []).find(b => (b.name || '').trim().toUpperCase() === clean);
        if (foundB && (foundB.photo_url || foundB.id || foundB.player_id)) {
          return foundB;
        }
        const foundBw = (inn.bowlers || []).find(bw => (bw.name || '').trim().toUpperCase() === clean);
        if (foundBw && (foundBw.photo_url || foundBw.id || foundBw.player_id)) {
          return foundBw;
        }
      }
    }

    // 3. Search playerService cache
    const fromService = playerService.findPlayer(clean);
    if (fromService) {
      return {
        id: fromService.id,
        player_id: fromService.player_id,
        name: fromService.full_name || fromService.name || clean,
        photo_url: fromService.photo_url || null
      };
    }

    return null;
  };

  const handleScoreBall = async ({ runs, type, batsmanRuns = 0, isFour = false, isSix = false }) => {
    if (isOperationBusyRef.current || isUndoing || isSaving) {
      console.warn('[ScoringDebug] Scoring blocked: another operation is in flight');
      return;
    }
    if (isScoringDebounceRef.current) return;
    isScoringDebounceRef.current = true;
    setTimeout(() => {
      isScoringDebounceRef.current = false;
    }, 60);

    setErrorMessage(null);

    const isLegal = isLegalDelivery(type);
    const isWide = isWideDelivery(type);
    const isNb = isNoBallDelivery(type);
    const newLegalBalls = isLegal ? currentLegalBalls + 1 : currentLegalBalls;
    const newOversStr = formatOvers(newLegalBalls);
    const newTotalRuns = currentRuns + runs;

    const ballLabel = isWide
      ? (runs > 1 ? `${runs}Wd` : 'Wd')
      : isNb
      ? (runs > 1 ? `${runs}Nb` : 'Nb')
      : type === BALL_TYPES.BYE
      ? `${runs}B`
      : type === BALL_TYPES.LEG_BYE
      ? `${runs}Lb`
      : `${runs}`;

    const runsForBatsman = (type === BALL_TYPES.NORMAL && !isWide && !isNb) ? runs : batsmanRuns;
    const nextSeq = ((matchData.total_deliveries ?? matchData.recent_balls?.length ?? 0) + 1);
    const currentInningsId = currentInnData?.id || matchData.innings_data?.find(i => i.innings_number === currentInnNum)?.id || null;

    // 1. Prepare delivery event record for ball_by_ball table
    const ballRecord = {
      match_id: matchData.id,
      innings_id: currentInningsId,
      innings_number: matchData.current_innings || 1,
      over_number: Math.floor(currentLegalBalls / 6),
      ball_number: isLegal ? (currentLegalBalls % 6) + 1 : (currentLegalBalls % 6) || 1,
      delivery_sequence: nextSeq,
      striker_name: matchData.striker?.name || 'Striker',
      bowler_name: matchData.bowler?.name || 'Bowler',
      runs: runs,
      type: isWide ? 'wide' : (isNb ? 'no_ball' : String(type).toLowerCase()),
      batsman_runs: runsForBatsman,
      extras: {
        ...((isWide || isNb || type === BALL_TYPES.BYE || type === BALL_TYPES.LEG_BYE) ? {
          type: isWide ? 'wide' : (isNb ? 'no_ball' : String(type).toLowerCase()),
          runs: (isWide || isNb) ? (runs - runsForBatsman) : runs
        } : {}),
        crease_state: {
          striker: matchData.striker,
          non_striker: matchData.non_striker,
          bowler: matchData.bowler,
          status: matchData.status,
          result: matchData.result,
          winner_team: matchData.winner_team
        }
      },
      wicket: null
    };

    pushHistory();

    // 3. Update Striker stats
    let updatedStriker = {
      ...matchData.striker,
      runs: (matchData.striker?.runs || 0) + runsForBatsman,
      balls: (!isWide) ? (matchData.striker?.balls || 0) + 1 : (matchData.striker?.balls || 0),
      fours: isFour ? (matchData.striker?.fours || 0) + 1 : (matchData.striker?.fours || 0),
      sixes: isSix ? (matchData.striker?.sixes || 0) + 1 : (matchData.striker?.sixes || 0),
    };

    let updatedNonStriker = { ...matchData.non_striker };

    // Swap strike on odd runs
    let shouldSwapStrike = false;
    if (isWide || isNb) {
      const runningRuns = Math.max(0, runs - 1);
      if (runningRuns % 2 !== 0) shouldSwapStrike = true;
    } else {
      if (runs % 2 !== 0) shouldSwapStrike = true;
    }

    if (shouldSwapStrike) {
      const temp = updatedStriker;
      updatedStriker = updatedNonStriker;
      updatedNonStriker = temp;
    }

    // Over finished? Complete ONLY after 6 legal balls.
    const isOverFinished = isLegal && (newLegalBalls > 0) && (newLegalBalls % 6 === 0);
    if (isOverFinished) {
      const temp = updatedStriker;
      updatedStriker = updatedNonStriker;
      updatedNonStriker = temp;
    }

    // Update Bowler
    const bowlerBallsCount = (matchData.bowler?.ballsCount || 0) + (isLegal ? 1 : 0);
    const bowlerOvers = formatOvers(bowlerBallsCount);
    const bowlerRuns = (matchData.bowler?.runs || 0) + runs;
    const bowlerEcon = bowlerBallsCount > 0 ? ((bowlerRuns / bowlerBallsCount) * 6).toFixed(2) : '0.00';

    const updatedBowler = {
      ...matchData.bowler,
      overs: bowlerOvers,
      ballsCount: bowlerBallsCount,
      runs: bowlerRuns,
      economy: bowlerEcon,
    };

    // Check Match Completion
    let newStatus = matchData.status;
    let matchResult = matchData.result;
    let winnerTeam = matchData.winner_team;

    if (isTestMatch) {
      if (currentInnNum === maxConfiguredInnings && matchData.target) {
        if (newTotalRuns >= matchData.target) {
          newStatus = 'completed';
          const wicketsRemaining = 10 - currentWickets;
          winnerTeam = currentBattingTeam;
          matchResult = `${currentBattingTeam} won by ${wicketsRemaining} ${wicketsRemaining === 1 ? 'wicket' : 'wickets'}!`;
        } else if (newLegalBalls >= (oversPerInnings * 6) || currentWickets >= 10) {
          newStatus = 'completed';
          const diff = (matchData.target - 1) - newTotalRuns;
          if (diff > 0) {
            winnerTeam = currentBowlingTeam;
            matchResult = `${currentBowlingTeam} won by ${diff} runs!`;
          } else {
            winnerTeam = 'Draw';
            matchResult = 'Match Drawn!';
          }
        }
      } else if (currentInnNum === 1 && maxConfiguredInnings === 1 && (newLegalBalls >= (oversPerInnings * 6) || currentWickets >= 10)) {
        newStatus = 'completed';
        winnerTeam = currentBattingTeam;
        matchResult = `${currentBattingTeam} scored ${newTotalRuns}/${currentWickets} in ${newOversStr} ov.`;
      } else if (currentInnNum < maxConfiguredInnings && (newLegalBalls >= (oversPerInnings * 6) || currentWickets >= 10)) {
        setShowBowlerModal(false);
        setShowEndInningsModal(true);
      }
    } else {
      // Limited Overs
      if (!isFirstInnings && matchData.target) {
        if (newTotalRuns >= matchData.target) {
          newStatus = 'completed';
          const wicketsRemaining = 10 - currentWickets;
          winnerTeam = currentBattingTeam;
          matchResult = `${currentBattingTeam} won by ${wicketsRemaining} ${wicketsRemaining === 1 ? 'wicket' : 'wickets'}!`;
        } else if (newLegalBalls >= (oversPerInnings * 6) || currentWickets >= 10) {
          newStatus = 'completed';
          const diff = (matchData.target - 1) - newTotalRuns;
          if (diff > 0) {
            winnerTeam = currentBowlingTeam;
            matchResult = `${currentBowlingTeam} won by ${diff} runs!`;
          } else {
            winnerTeam = 'Tie';
            matchResult = 'Match Tied!';
          }
        }
      } else if (isFirstInnings && (newLegalBalls >= (oversPerInnings * 6) || currentWickets >= 10)) {
        setShowBowlerModal(false);
        setShowEndInningsModal(true);
      }
    }

    // Current over deliveries
    const currentDeliveries = [...(matchData.current_over_deliveries || []), ballLabel];
    let updatedCompletedOvers = [...(matchData.completed_overs || [])];
    let nextOverDeliveries = currentDeliveries;

    if (isOverFinished) {
      const overRuns = currentDeliveries.reduce((acc, b) => {
        const match = b.match(/\d+/);
        return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
      }, 0);
      updatedCompletedOvers.push({
        overNumber: newLegalBalls / 6,
        bowler: updatedBowler.name || 'Bowler',
        deliveries: [...currentDeliveries],
        runs: overRuns,
      });
      nextOverDeliveries = [];
    }

    const updatedBowlersHistory = Array.from(new Set([
      ...(matchData.bowlers_history || []),
      updatedBowler.name
    ].filter(Boolean)));

    // Maintain innings_data for full scorecard tab
    const curInnNum = matchData.current_innings || 1;
    const existingInningsList = [...(matchData.innings_data || [])];
    const innIdx = existingInningsList.findIndex((inn) => inn.innings_number === curInnNum);
    const existingBatters = existingInningsList[innIdx]?.batters ? [...existingInningsList[innIdx].batters] : [];
    const updatedBatters = [...existingBatters];

    const sIdx = updatedBatters.findIndex(b => b.name === updatedStriker.name);
    if (sIdx >= 0) {
      updatedBatters[sIdx] = { ...updatedBatters[sIdx], ...updatedStriker, notOut: true };
    } else {
      updatedBatters.push({ ...updatedStriker, notOut: true });
    }

    const nsIdx = updatedBatters.findIndex(b => b.name === updatedNonStriker.name);
    if (nsIdx >= 0) {
      updatedBatters[nsIdx] = { ...updatedBatters[nsIdx], ...updatedNonStriker, notOut: true };
    } else {
      updatedBatters.push({ ...updatedNonStriker, notOut: true });
    }

    const updatedInningsObj = {
      ...(existingInningsList[innIdx] || {}),
      id: currentInningsId || existingInningsList[innIdx]?.id,
      match_id: matchData.id,
      innings_number: curInnNum,
      team_name: currentBattingTeam,
      batting_team: currentBattingTeam,
      bowling_team: currentBowlingTeam,
      runs: newTotalRuns,
      total_runs: newTotalRuns,
      wickets: currentWickets,
      overs: newOversStr,
      overs_completed: Math.floor(newLegalBalls / 6),
      balls_completed: newLegalBalls,
      innings_status: 'live',
      batters: updatedBatters,
      bowlers: [
        ...(existingInningsList[innIdx]?.bowlers || []).filter(bw => bw.name !== updatedBowler.name),
        updatedBowler
      ],
      extras: existingInningsList[innIdx]?.extras || { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
    };

    if (innIdx >= 0) {
      existingInningsList[innIdx] = updatedInningsObj;
    } else {
      existingInningsList.push(updatedInningsObj);
    }

    // 4. Update match summary in database & local state
    const nextMatchData = {
      ...matchData,
      status: newStatus,
      result: matchResult,
      winner_team: winnerTeam,
      team_a_score: currentBattingTeam === matchData.team_a_name ? newTotalRuns : matchData.team_a_score,
      team_a_wickets: currentBattingTeam === matchData.team_a_name ? currentWickets : matchData.team_a_wickets,
      team_a_overs: currentBattingTeam === matchData.team_a_name ? newOversStr : matchData.team_a_overs,
      team_b_score: currentBattingTeam === matchData.team_b_name ? newTotalRuns : matchData.team_b_score,
      team_b_wickets: currentBattingTeam === matchData.team_b_name ? currentWickets : matchData.team_b_wickets,
      team_b_overs: currentBattingTeam === matchData.team_b_name ? newOversStr : matchData.team_b_overs,
      striker: updatedStriker,
      non_striker: updatedNonStriker,
      bowler: updatedBowler,
      bowlers_history: updatedBowlersHistory,
      recent_balls: [...(matchData.recent_balls || []).slice(-17), ballLabel],
      current_over_deliveries: nextOverDeliveries,
      completed_overs: updatedCompletedOvers,
      total_deliveries: nextSeq,
      innings_data: existingInningsList
    };

    setMatchData(nextMatchData);

    const isInningsOver = (
      newStatus === 'completed' ||
      (currentInnNum < maxConfiguredInnings && (newLegalBalls >= (oversPerInnings * 6) || newWickets >= 10))
    );

    if (isOverFinished && !isInningsOver) {
      setShowBowlerModal(true);
    }

    // Synchronize to Supabase ball_by_ball, innings, and matches tables via serialized mutex
    runSerializedOperation(`ScoreBall(${ballLabel})`, async () => {
      try {
        await scoringService.recordBall(matchData.id, ballRecord);
      } catch (err) {
        console.warn('Background ball save note:', err);
      }

      if (currentInningsId) {
        try {
          await inningsService.updateInnings(currentInningsId, {
            match_id: matchData.id,
            total_runs: newTotalRuns,
            wickets: currentWickets,
            overs_completed: Math.floor(newLegalBalls / 6),
            balls_completed: newLegalBalls,
            innings_status: 'live'
          });
        } catch (err) {
          console.warn('Innings update sync note:', err);
        }
      }

      try {
        await matchService.updateMatch(matchData.id, nextMatchData);
      } catch (err) {
        console.warn('Match summary sync note:', err);
      }
    });
  };

  const handleWicket = async ({ wicketType, isStriker, newBatter, newBatterId, fielder }) => {
    if (isOperationBusyRef.current || isSaving || isUndoing) return;
    setErrorMessage(null);

    const newWickets = currentWickets + 1;
    const newLegalBalls = currentLegalBalls + 1;
    const newOversStr = formatOvers(newLegalBalls);

    const foundNewBatter = playerService.findPlayer(newBatterId || newBatter);
    const newBatterObj = {
      id: foundNewBatter?.id || newBatterId || '',
      name: (newBatter?.trim() || `Batter ${newWickets + 2}`).toUpperCase(),
      player_id: foundNewBatter?.player_id || newBatterId || '',
      photo_url: foundNewBatter?.photo_url || null,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      notOut: true
    };

    const playerOutName = isStriker ? (matchData.striker?.name || 'Striker') : (matchData.non_striker?.name || 'Non-Striker');
    const nextSeq = ((matchData.total_deliveries ?? matchData.recent_balls?.length ?? 0) + 1);
    const currentInningsId = currentInnData?.id || matchData.innings_data?.find(i => i.innings_number === currentInnNum)?.id || null;

    // 1. Prepare wicket delivery record for ball_by_ball table
    const ballRecord = {
      match_id: matchData.id,
      innings_id: currentInningsId,
      innings_number: matchData.current_innings || 1,
      over_number: Math.floor(currentLegalBalls / 6),
      ball_number: (currentLegalBalls % 6) + 1,
      delivery_sequence: nextSeq,
      striker_name: matchData.striker?.name || 'Striker',
      bowler_name: matchData.bowler?.name || 'Bowler',
      runs: 0,
      type: 'wicket',
      batsman_runs: 0,
      extras: {
        crease_state: {
          striker: matchData.striker,
          non_striker: matchData.non_striker,
          bowler: matchData.bowler,
          status: matchData.status,
          result: matchData.result,
          winner_team: matchData.winner_team
        }
      },
      wicket: {
        wicketType,
        playerOut: playerOutName,
        isStriker,
        newBatter: newBatterObj.name,
        fielder: fielder || ''
      }
    };

    pushHistory();

    let finalStriker = isStriker ? newBatterObj : matchData.striker;
    let finalNonStriker = !isStriker ? newBatterObj : matchData.non_striker;

    // Update bowler wickets
    const bowlerBallsCount = (matchData.bowler?.ballsCount || 0) + 1;
    const bowlerOvers = formatOvers(bowlerBallsCount);
    const updatedBowler = {
      ...matchData.bowler,
      overs: bowlerOvers,
      ballsCount: bowlerBallsCount,
      wickets: (matchData.bowler?.wickets || 0) + (wicketType !== 'Run Out' ? 1 : 0),
    };

    const isOverFinished = newLegalBalls > 0 && newLegalBalls % 6 === 0;
    if (isOverFinished) {
      // Rotate strike at end of over
      const temp = finalStriker;
      finalStriker = finalNonStriker;
      finalNonStriker = temp;
    }

    let newStatus = matchData.status;
    let matchResult = matchData.result;
    let winnerTeam = matchData.winner_team;

    if (isTestMatch) {
      if (currentInnNum === maxConfiguredInnings && matchData.target && newWickets >= 10) {
        newStatus = 'completed';
        const diff = (matchData.target - 1) - currentRuns;
        if (diff > 0) {
          winnerTeam = currentBowlingTeam;
          matchResult = `${currentBowlingTeam} won by ${diff} runs!`;
        } else {
          winnerTeam = 'Tie';
          matchResult = 'Match Tied!';
        }
      } else if (currentInnNum === 1 && maxConfiguredInnings === 1 && newWickets >= 10) {
        newStatus = 'completed';
        winnerTeam = currentBattingTeam;
        matchResult = `${currentBattingTeam} scored ${currentRuns}/${newWickets} in ${newOversStr} ov.`;
      } else if (currentInnNum < maxConfiguredInnings && newWickets >= 10) {
        setShowBowlerModal(false);
        setShowEndInningsModal(true);
      }
    } else {
      // Limited Overs
      if (!isFirstInnings && matchData.target && newWickets >= 10) {
        newStatus = 'completed';
        const diff = (matchData.target - 1) - currentRuns;
        winnerTeam = diff > 0 ? currentBowlingTeam : 'Tie';
        matchResult = diff > 0 ? `${currentBowlingTeam} won by ${diff} runs!` : 'Match Tied!';
      } else if (isFirstInnings && newWickets >= 10) {
        setShowBowlerModal(false);
        setShowEndInningsModal(true);
      }
    }

    const currentDeliveries = [...(matchData.current_over_deliveries || []), 'W'];
    let updatedCompletedOvers = [...(matchData.completed_overs || [])];
    let nextOverDeliveries = currentDeliveries;

    if (isOverFinished) {
      const overRuns = currentDeliveries.reduce((acc, b) => {
        const match = b.match(/\d+/);
        return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
      }, 0);
      updatedCompletedOvers.push({
        overNumber: newLegalBalls / 6,
        bowler: updatedBowler.name || 'Bowler',
        deliveries: [...currentDeliveries],
        runs: overRuns,
      });
      nextOverDeliveries = [];
    }

    const updatedBowlersHistory = Array.from(new Set([
      ...(matchData.bowlers_history || []),
      updatedBowler.name
    ].filter(Boolean)));

    // Maintain innings_data
    const curInnNum = matchData.current_innings || 1;
    const existingInningsList = [...(matchData.innings_data || [])];
    const innIdx = existingInningsList.findIndex((inn) => inn.innings_number === curInnNum);
    const existingBatters = existingInningsList[innIdx]?.batters ? [...existingInningsList[innIdx].batters] : [];
    const updatedBatters = [...existingBatters];

    const dismissalLabel = fielder ? `${wicketType} (${fielder})` : wicketType;
    const dismissedRaw = isStriker ? matchData.striker : matchData.non_striker;
    const dismissedBatter = {
      ...(dismissedRaw || {}),
      name: playerOutName,
      balls: (dismissedRaw?.balls || 0) + (isStriker ? 1 : 0),
      notOut: false,
      dismissal: dismissalLabel
    };

    // Update dismissed batter in place
    const outIdx = updatedBatters.findIndex(b => b.name === playerOutName);
    if (outIdx >= 0) {
      updatedBatters[outIdx] = { ...updatedBatters[outIdx], ...dismissedBatter };
    } else {
      updatedBatters.push(dismissedBatter);
    }

    // Update surviving batter in place
    const survivingBatter = isStriker ? matchData.non_striker : matchData.striker;
    if (survivingBatter?.name) {
      const survIdx = updatedBatters.findIndex(b => b.name === survivingBatter.name);
      if (survIdx >= 0) {
        updatedBatters[survIdx] = { ...updatedBatters[survIdx], ...survivingBatter, notOut: true };
      } else {
        updatedBatters.push({ ...survivingBatter, notOut: true });
      }
    }

    // Add or update incoming new batter
    const newIdx = updatedBatters.findIndex(b => b.name === newBatterObj.name);
    if (newIdx >= 0) {
      updatedBatters[newIdx] = { ...updatedBatters[newIdx], ...newBatterObj, notOut: true };
    } else {
      updatedBatters.push({ ...newBatterObj, notOut: true });
    }

    const updatedInningsObj = {
      ...(existingInningsList[innIdx] || {}),
      id: currentInningsId || existingInningsList[innIdx]?.id,
      match_id: matchData.id,
      innings_number: curInnNum,
      team_name: currentBattingTeam,
      batting_team: currentBattingTeam,
      bowling_team: currentBowlingTeam,
      runs: currentRuns,
      total_runs: currentRuns,
      wickets: newWickets,
      overs: newOversStr,
      overs_completed: Math.floor(newLegalBalls / 6),
      balls_completed: newLegalBalls,
      innings_status: 'live',
      batters: updatedBatters,
      bowlers: [
        ...(existingInningsList[innIdx]?.bowlers || []).filter(bw => bw.name !== updatedBowler.name),
        updatedBowler
      ],
      extras: existingInningsList[innIdx]?.extras || { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
    };

    if (innIdx >= 0) {
      existingInningsList[innIdx] = updatedInningsObj;
    } else {
      existingInningsList.push(updatedInningsObj);
    }

    const nextMatchData = {
      ...matchData,
      status: newStatus,
      result: matchResult,
      winner_team: winnerTeam,
      team_a_score: currentBattingTeam === matchData.team_a_name ? currentRuns : matchData.team_a_score,
      team_a_wickets: currentBattingTeam === matchData.team_a_name ? newWickets : matchData.team_a_wickets,
      team_a_overs: currentBattingTeam === matchData.team_a_name ? newOversStr : matchData.team_a_overs,
      team_b_score: currentBattingTeam === matchData.team_b_name ? currentRuns : matchData.team_b_score,
      team_b_wickets: currentBattingTeam === matchData.team_b_name ? newWickets : matchData.team_b_wickets,
      team_b_overs: currentBattingTeam === matchData.team_b_name ? newOversStr : matchData.team_b_overs,
      striker: finalStriker,
      non_striker: finalNonStriker,
      bowler: updatedBowler,
      bowlers_history: updatedBowlersHistory,
      recent_balls: [...(matchData.recent_balls || []).slice(-17), 'W'],
      current_over_deliveries: nextOverDeliveries,
      completed_overs: updatedCompletedOvers,
      total_deliveries: nextSeq,
      innings_data: existingInningsList
    };

    setMatchData(nextMatchData);

    const isInningsOver = (
      newStatus === 'completed' ||
      (currentInnNum < maxConfiguredInnings && (newLegalBalls >= (oversPerInnings * 6) || newWickets >= 10))
    );

    if (isOverFinished && !isInningsOver) {
      setShowBowlerModal(true);
    }

    // Synchronize to Supabase ball_by_ball, innings, and matches tables via serialized mutex
    runSerializedOperation('Wicket', async () => {
      try {
        await scoringService.recordBall(matchData.id, ballRecord);
      } catch (err) {
        console.warn('Background wicket save note:', err);
      }

      if (currentInningsId) {
        try {
          await inningsService.updateInnings(currentInningsId, {
            match_id: matchData.id,
            total_runs: currentRuns,
            wickets: newWickets,
            overs_completed: Math.floor(newLegalBalls / 6),
            balls_completed: newLegalBalls,
            innings_status: 'live'
          });
        } catch (err) {
          console.warn('Innings update sync note:', err);
        }
      }

      try {
        await matchService.updateMatch(matchData.id, nextMatchData);
      } catch (err) {
        console.warn('Match summary sync note:', err);
      }
    });
  };

  const handleUndo = async () => {
    if (isOperationBusyRef.current || isSaving || isUndoing) {
      console.warn('[UndoDebug] handleUndo ignored: database operation actively processing');
      return;
    }

    console.log('[UndoDebug] Undo button clicked for match:', matchData.id, 'innings:', matchData.current_innings || 1);

    // Check if the last delivery was a wicket or completed the match
    const isWicketLast = matchData.recent_balls?.length > 0 && matchData.recent_balls[matchData.recent_balls.length - 1] === 'W';
    const isMatchCompleted = matchData.status === 'completed';

    if (isWicketLast || isMatchCompleted) {
      setUndoConfirmModal({
        isOpen: true,
        title: isMatchCompleted ? 'Undo Match-Ending Delivery?' : 'Undo Wicket Delivery?',
        message: ''
      });
      return;
    }

    await executeUndo();
  };

  const executeUndo = async () => {
    if (isOperationBusyRef.current || isUndoing) {
      console.warn('[UndoDebug] executeUndo blocked: operation in progress');
      return;
    }
    isOperationBusyRef.current = true;
    setIsUndoing(true);
    setIsSaving(true);
    lastLocalActionTimeRef.current = Date.now();
    setErrorMessage(null);
    setSuccessMessage(null);
    setUndoConfirmModal({ isOpen: false, title: '', message: '' });

    try {
      const currentInn = matchData.current_innings || 1;
      const isFirst = currentInn === 1;

      console.log(`[UndoDebug] Database operation started: reversing latest delivery for match ${matchData.id}, innings ${currentInn}`);

      // 1. Delete delivery from Supabase / localStorage scoped to current innings
      const undoResult = await scoringService.undoBall(matchData.id, currentInn);
      if (!undoResult?.success) {
        throw new Error(undoResult?.error || 'No deliveries available to undo in this innings');
      }

      const removedBall = undoResult.removed;
      console.log('[UndoDebug] Latest delivery identified and reversed:', removedBall?.id, 'seq:', removedBall?.delivery_sequence);

      // 2. Fetch authoritative remaining deliveries
      const remainingBalls = await scoringService.getInningsBalls(matchData.id, currentInn);
      const stats = scoringService.calculateInningsScore(remainingBalls);

      // 3. Reconstruct active crease positions (striker, non-striker, bowler)
      const crease = scoringService.reconstructCrease(
        remainingBalls,
        { striker: matchData.striker, nonStriker: matchData.non_striker, bowler: matchData.bowler },
        removedBall
      );

      const previousSnapshot = historyStack.length > 0 ? historyStack[0] : null;

      // Resolve striker metadata & stats preserving complete player object & profile photo
      const strikerMeta = resolvePlayerMetadata(crease.strikerName, [
        crease.savedCrease?.striker,
        crease.savedCrease?.non_striker,
        previousSnapshot?.striker,
        previousSnapshot?.non_striker,
        matchData.striker,
        matchData.non_striker
      ]);

      const strikerStat = stats.batters.find(b => b.name === crease.strikerName);
      const restoredStriker = {
        ...(strikerMeta || {}),
        name: crease.strikerName,
        id: strikerMeta?.id || strikerMeta?.player_id || '',
        player_id: strikerMeta?.player_id || '',
        photo_url: strikerMeta?.photo_url || null,
        runs: strikerStat?.runs ?? (crease.savedCrease?.striker?.name === crease.strikerName ? crease.savedCrease.striker.runs : 0),
        balls: strikerStat?.balls ?? (crease.savedCrease?.striker?.name === crease.strikerName ? crease.savedCrease.striker.balls : 0),
        fours: strikerStat?.fours ?? (crease.savedCrease?.striker?.name === crease.strikerName ? crease.savedCrease.striker.fours : 0),
        sixes: strikerStat?.sixes ?? (crease.savedCrease?.striker?.name === crease.strikerName ? crease.savedCrease.striker.sixes : 0),
        strikeRate: (strikerStat?.balls || 0) > 0 ? ((strikerStat.runs / strikerStat.balls) * 100).toFixed(1) : '0.0',
        notOut: true
      };

      // Resolve non-striker metadata & stats preserving complete player object & profile photo
      const nonStrikerMeta = resolvePlayerMetadata(crease.nonStrikerName, [
        crease.savedCrease?.non_striker,
        crease.savedCrease?.striker,
        previousSnapshot?.non_striker,
        previousSnapshot?.striker,
        matchData.non_striker,
        matchData.striker
      ]);

      const nonStrikerStat = stats.batters.find(b => b.name === crease.nonStrikerName);
      const restoredNonStriker = {
        ...(nonStrikerMeta || {}),
        name: crease.nonStrikerName,
        id: nonStrikerMeta?.id || nonStrikerMeta?.player_id || '',
        player_id: nonStrikerMeta?.player_id || '',
        photo_url: nonStrikerMeta?.photo_url || null,
        runs: nonStrikerStat?.runs ?? (crease.savedCrease?.non_striker?.name === crease.nonStrikerName ? crease.savedCrease.non_striker.runs : 0),
        balls: nonStrikerStat?.balls ?? (crease.savedCrease?.non_striker?.name === crease.nonStrikerName ? crease.savedCrease.non_striker.balls : 0),
        fours: nonStrikerStat?.fours ?? (crease.savedCrease?.non_striker?.name === crease.nonStrikerName ? crease.savedCrease.non_striker.fours : 0),
        sixes: nonStrikerStat?.sixes ?? (crease.savedCrease?.non_striker?.name === crease.nonStrikerName ? crease.savedCrease.non_striker.sixes : 0),
        strikeRate: (nonStrikerStat?.balls || 0) > 0 ? ((nonStrikerStat.runs / nonStrikerStat.balls) * 100).toFixed(1) : '0.0',
        notOut: true
      };

      // Resolve bowler metadata & stats preserving complete player object & profile photo
      const bowlerMeta = resolvePlayerMetadata(crease.bowlerName, [
        crease.savedCrease?.bowler,
        previousSnapshot?.bowler,
        matchData.bowler
      ]);

      const bowlerStat = stats.bowlers.find(bw => bw.name === crease.bowlerName);
      const restoredBowler = {
        ...(bowlerMeta || {}),
        name: crease.bowlerName,
        id: bowlerMeta?.id || bowlerMeta?.player_id || '',
        player_id: bowlerMeta?.player_id || '',
        photo_url: bowlerMeta?.photo_url || null,
        overs: bowlerStat?.overs ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.overs : '0.0'),
        runs: bowlerStat?.runs ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.runs : 0),
        wickets: bowlerStat?.wickets ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.wickets : 0),
        economy: bowlerStat?.economy ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.economy : '0.00'),
        maidens: bowlerStat?.maidens ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.maidens : 0),
        ballsCount: bowlerStat?.ballsCount ?? (crease.savedCrease?.bowler?.name === crease.bowlerName ? crease.savedCrease.bowler.ballsCount : 0)
      };

      // 4. Revert Match Completion if criteria no longer met
      let newStatus = matchData.status;
      let newResult = matchData.result;
      let newWinner = matchData.winner_team;

      if (matchData.status === 'completed') {
        if (isTestMatch) {
          if (currentInn === maxConfiguredInnings && matchData.target) {
            if (stats.runs < matchData.target && stats.legalBalls < (oversPerInnings * 6) && stats.wickets < 10) {
              newStatus = 'live';
              newResult = null;
              newWinner = null;
            }
          } else if (currentInn === 1 && maxConfiguredInnings === 1) {
            if (stats.legalBalls < (oversPerInnings * 6) && stats.wickets < 10) {
              newStatus = 'live';
              newResult = null;
              newWinner = null;
            }
          }
        } else {
          if (!isFirst && matchData.target) {
            if (stats.runs < matchData.target && stats.legalBalls < (oversPerInnings * 6) && stats.wickets < 10) {
              newStatus = 'live';
              newResult = null;
              newWinner = null;
            }
          } else if (isFirst) {
            if (stats.legalBalls < (oversPerInnings * 6) && stats.wickets < 10) {
              newStatus = 'live';
              newResult = null;
              newWinner = null;
            }
          }
        }
      }

      // 5. Dismiss any open end-of-over / end-of-innings dialogs
      setShowBowlerModal(false);
      setShowEndInningsModal(false);

      // 6. Reconcile innings_data for scorecard tab while preserving complete player profiles
      const existingInningsList = Array.isArray(matchData.innings_data) ? [...matchData.innings_data] : [];
      const innIdx = existingInningsList.findIndex((inn) => inn.innings_number === currentInn);
      const currentBatTeam = existingInningsList[innIdx]?.batting_team || existingInningsList[innIdx]?.team_name || (isFirst ? (matchData.current_batting_team || matchData.team_a_name) : (matchData.current_batting_team || matchData.team_b_name));
      const currentInningsId = existingInningsList[innIdx]?.id || currentInnData?.id;

      const reconciledBattersAfterUndo = (stats.batters || []).map((b) => {
        const existing = (existingInningsList[innIdx]?.batters || []).find((eb) => eb.name === b.name);
        const meta = resolvePlayerMetadata(b.name, [existing, restoredStriker, restoredNonStriker]);
        return {
          ...(existing || {}),
          ...(meta || {}),
          ...b,
          id: existing?.id || meta?.id || b.player_id || '',
          player_id: existing?.player_id || meta?.player_id || '',
          photo_url: existing?.photo_url || meta?.photo_url || null
        };
      });

      const reconciledBowlersAfterUndo = (stats.bowlers || []).map((bw) => {
        const existing = (existingInningsList[innIdx]?.bowlers || []).find((ebw) => ebw.name === bw.name);
        const meta = resolvePlayerMetadata(bw.name, [existing, restoredBowler]);
        return {
          ...(existing || {}),
          ...(meta || {}),
          ...bw,
          id: existing?.id || meta?.id || bw.player_id || '',
          player_id: existing?.player_id || meta?.player_id || '',
          photo_url: existing?.photo_url || meta?.photo_url || null
        };
      });

      const updatedInningsObj = {
        ...(existingInningsList[innIdx] || {}),
        id: currentInningsId || existingInningsList[innIdx]?.id,
        match_id: matchData.id,
        innings_number: currentInn,
        team_name: currentBatTeam,
        batting_team: currentBatTeam,
        runs: stats.runs,
        total_runs: stats.runs,
        wickets: stats.wickets,
        overs: stats.overs,
        overs_completed: Math.floor(stats.legalBalls / 6),
        balls_completed: stats.legalBalls,
        innings_status: 'live',
        batters: reconciledBattersAfterUndo,
        bowlers: reconciledBowlersAfterUndo,
        extras: stats.extras,
        fall_of_wickets: stats.fallOfWickets
      };

      if (innIdx >= 0) {
        existingInningsList[innIdx] = updatedInningsObj;
      } else {
        existingInningsList.push(updatedInningsObj);
      }

      if (currentInningsId) {
        inningsService.updateInnings(currentInningsId, {
          match_id: matchData.id,
          total_runs: stats.runs,
          wickets: stats.wickets,
          overs_completed: Math.floor(stats.legalBalls / 6),
          balls_completed: stats.legalBalls,
          innings_status: 'live'
        }).catch(err => console.warn('Innings undo sync note:', err));
      }

      // 7. Pop in-memory history stack
      setHistoryStack((prev) => prev.slice(1));

      // 8. Build complete authoritative state
      const isTeamA = currentBatTeam === matchData.team_a_name;
      const revertedState = {
        ...matchData,
        status: newStatus,
        result: newResult,
        winner_team: newWinner,
        team_a_score: isTeamA ? stats.runs : matchData.team_a_score,
        team_a_wickets: isTeamA ? stats.wickets : matchData.team_a_wickets,
        team_a_overs: isTeamA ? stats.overs : matchData.team_a_overs,
        team_b_score: !isTeamA ? stats.runs : matchData.team_b_score,
        team_b_wickets: !isTeamA ? stats.wickets : matchData.team_b_wickets,
        team_b_overs: !isTeamA ? stats.overs : matchData.team_b_overs,
        striker: restoredStriker,
        non_striker: restoredNonStriker,
        bowler: restoredBowler,
        recent_balls: stats.recentBalls,
        current_over_deliveries: stats.currentOverDeliveries,
        completed_overs: stats.completedOvers,
        total_deliveries: remainingBalls.length,
        innings_data: existingInningsList
      };

      setMatchData(revertedState);

      // 9. Synchronize to database
      await matchService.updateMatch(matchData.id, revertedState);

      console.log('[UndoDebug] Frontend state updated and database confirmed after undo');
      setSuccessMessage('Delivery undone successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('[UndoDebug] Database operation failed during undo:', err);
      setErrorMessage(`Failed to undo delivery: ${err.message}`);
    } finally {
      lastLocalActionTimeRef.current = Date.now();
      isOperationBusyRef.current = false;
      setIsUndoing(false);
      setIsSaving(false);
      console.log('[UndoDebug] Undo operation completed; buttons re-enabled');
    }
  };

  const handleSwapStrike = async () => {
    pushHistory();
    setMatchData((prev) => {
      const swapped = {
        ...prev,
        striker: prev.non_striker,
        non_striker: prev.striker,
      };
      matchService.updateMatch(prev.id, swapped).catch(console.warn);
      return swapped;
    });
  };

  const applySelectedBowler = async (cleanName, bowlerPlayerId = '') => {
    const clean = cleanName?.trim()?.toUpperCase();
    if (!clean) return;

    // Rule check: Cannot be active batsman
    const strikerName = matchData?.striker?.name?.trim()?.toUpperCase();
    const nonStrikerName = matchData?.non_striker?.name?.trim()?.toUpperCase();
    if (clean === strikerName || clean === nonStrikerName) {
      alert(`${clean} is currently batting and cannot bowl.`);
      return;
    }

    // Rule check: Cannot bowl consecutive overs
    const lastOverBowler = (
      matchData.completed_overs && matchData.completed_overs.length > 0
        ? matchData.completed_overs[matchData.completed_overs.length - 1]?.bowler
        : null
    )?.trim()?.toUpperCase();

    if (lastOverBowler && clean === lastOverBowler) {
      alert(`${clean} just bowled the previous over. Bowlers cannot bowl two consecutive overs.`);
      return;
    }

    const foundBowler = playerService.findPlayer(bowlerPlayerId || clean);

    // Look for previous stats in current innings to preserve overs, wickets, runs
    const currentInnNum = matchData.current_innings || 1;
    const existingInningsList = [...(matchData.innings_data || [])];
    const innIdx = existingInningsList.findIndex(
      (inn) => inn.innings_number === currentInnNum
    );
    const existingInnBowlers = innIdx >= 0 ? (existingInningsList[innIdx]?.bowlers || []) : [];
    const prevBowlerStats = existingInnBowlers.find(
      (b) => b.name?.trim()?.toUpperCase() === clean
    );

    const updatedBowlerObj = {
      id: foundBowler?.id || bowlerPlayerId || prevBowlerStats?.id || '',
      name: clean,
      player_id: foundBowler?.player_id || bowlerPlayerId || prevBowlerStats?.player_id || '',
      photo_url: foundBowler?.photo_url || prevBowlerStats?.photo_url || null,
      overs: prevBowlerStats?.overs || '0.0',
      maidens: prevBowlerStats?.maidens || 0,
      runs: prevBowlerStats?.runs || 0,
      wickets: prevBowlerStats?.wickets || 0,
      economy: prevBowlerStats?.economy || '0.00'
    };

    pushHistory();

    const updatedHistory = Array.from(new Set([
      ...(matchData.bowlers_history || []),
      clean
    ].filter(Boolean)));

    if (innIdx >= 0) {
      const filtered = existingInnBowlers.filter(b => b.name?.trim()?.toUpperCase() !== clean);
      existingInningsList[innIdx] = {
        ...existingInningsList[innIdx],
        bowlers: [...filtered, updatedBowlerObj]
      };
    }

    const nextState = {
      ...matchData,
      bowlers_history: updatedHistory,
      bowler: updatedBowlerObj,
      innings_data: existingInningsList
    };

    setMatchData(nextState);
    setNewBowlerName('');
    setNewBowlerId('');
    setShowBowlerModal(false);

    try {
      await matchService.updateMatch(matchData.id, nextState);
    } catch (err) {
      console.warn('Failed to update bowler in database:', err);
    }
  };

  const handleSelectPreviousBowler = async (bName) => {
    await applySelectedBowler(bName);
  };

  const handleChangeBowlerConfirm = async () => {
    await applySelectedBowler(newBowlerName, newBowlerId);
  };

  // Open Edit Player Name dialog
  const handleOpenEditPlayer = (role, currentName) => {
    const currentPlayer = role === 'striker'
      ? matchData?.striker
      : (role === 'non_striker' ? matchData?.non_striker : matchData?.bowler);

    setEditPlayerModal({
      isOpen: true,
      role,
      name: currentName || '',
      playerId: currentPlayer?.player_id || ''
    });
  };

  const handleSavePlayerName = async (e) => {
    if (e) e.preventDefault();
    const clean = editPlayerModal.name.trim().toUpperCase();
    if (!clean) return;

    pushHistory();
    const foundEdited = playerService.findPlayer(editPlayerModal.playerId || clean);

    setMatchData((prev) => {
      const updated = { ...prev };
      const oldName = editPlayerModal.role === 'striker'
        ? prev.striker?.name
        : (editPlayerModal.role === 'non_striker' ? prev.non_striker?.name : prev.bowler?.name);
      const newPlayerId = editPlayerModal.playerId || '';
      const photo = foundEdited?.photo_url || prev[editPlayerModal.role]?.photo_url || null;
      const pid = foundEdited?.id || prev[editPlayerModal.role]?.id || '';

      if (editPlayerModal.role === 'striker') {
        updated.striker = { ...updated.striker, name: clean, player_id: newPlayerId || updated.striker?.player_id || '', photo_url: photo, id: pid };
      } else if (editPlayerModal.role === 'non_striker') {
        updated.non_striker = { ...updated.non_striker, name: clean, player_id: newPlayerId || updated.non_striker?.player_id || '', photo_url: photo, id: pid };
      } else if (editPlayerModal.role === 'bowler') {
        updated.bowler = { ...updated.bowler, name: clean, player_id: newPlayerId || updated.bowler?.player_id || '', photo_url: photo, id: pid };
        updated.bowlers_history = Array.from(new Set([
          ...(prev.bowlers_history || []).map(n => n === oldName ? clean : n),
          clean
        ]));
      }

      // Also update name and player_id in innings_data if present
      if (oldName && updated.innings_data) {
        const curInn = updated.current_innings || 1;
        updated.innings_data = updated.innings_data.map(inn => {
          if (inn.innings_number === curInn) {
            const updatedBatters = (inn.batters || []).map(b => b.name === oldName ? { ...b, name: clean, player_id: newPlayerId || b.player_id || '', photo_url: photo || b.photo_url || null } : b);
            const updatedBowlers = (inn.bowlers || []).map(bw => bw.name === oldName ? { ...bw, name: clean, player_id: newPlayerId || bw.player_id || '', photo_url: photo || bw.photo_url || null } : bw);
            return { ...inn, batters: updatedBatters, bowlers: updatedBowlers };
          }
          return inn;
        });
      }

      matchService.updateMatch(prev.id, updated).catch(console.warn);
      return updated;
    });

    setEditPlayerModal({ isOpen: false, role: '', name: '', playerId: '' });
  };

  const handleStartNextInnings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!secondInningsForm.striker || !secondInningsForm.strikerId) {
      alert('Please search and select a registered Opening Striker.');
      return;
    }
    if (!secondInningsForm.nonStriker || !secondInningsForm.nonStrikerId) {
      alert('Please search and select a registered Opening Non-Striker.');
      return;
    }
    if (!secondInningsForm.bowler || !secondInningsForm.bowlerId) {
      alert('Please search and select a registered Opening Bowler.');
      return;
    }

    // 3-way duplicate opening player validation
    const sId = secondInningsForm.strikerUuid || secondInningsForm.strikerId;
    const nsId = secondInningsForm.nonStrikerUuid || secondInningsForm.nonStrikerId;
    const bId = secondInningsForm.bowlerUuid || secondInningsForm.bowlerId;
    const sName = (secondInningsForm.striker || '').trim().toLowerCase();
    const nsName = (secondInningsForm.nonStriker || '').trim().toLowerCase();
    const bName = (secondInningsForm.bowler || '').trim().toLowerCase();

    if (
      sId === nsId ||
      sId === bId ||
      nsId === bId ||
      sName === nsName ||
      sName === bName ||
      nsName === bName
    ) {
      alert('Each opening position must have a different player. Please select another player.');
      return;
    }

    const currentInn = matchData.current_innings || 1;
    const nextInnNumber = currentInn + 1;

    const strikerName = (secondInningsForm.striker?.trim() || 'Opener 1').toUpperCase();
    const nonStrikerName = (secondInningsForm.nonStriker?.trim() || 'Opener 2').toUpperCase();
    const bowlerName = (secondInningsForm.bowler?.trim() || 'Opening Bowler').toUpperCase();

    let nextBatting = currentBowlingTeam;
    let nextBowling = currentBattingTeam;

    // Follow-on check in Test Cricket (at end of Innings 2)
    if (isTestMatch && currentInn === 2 && nextInningsBattingChoice === 'follow_on') {
      nextBatting = currentBattingTeam; // Team that batted in Inn 2 bats again
      nextBowling = currentBowlingTeam;
    }

    const newStriker = {
      id: secondInningsForm.strikerUuid || '',
      name: strikerName,
      player_id: secondInningsForm.strikerId || '',
      photo_url: secondInningsForm.strikerPhoto || null,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      notOut: true
    };
    const newNonStriker = {
      id: secondInningsForm.nonStrikerUuid || '',
      name: nonStrikerName,
      player_id: secondInningsForm.nonStrikerId || '',
      photo_url: secondInningsForm.nonStrikerPhoto || null,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      notOut: true
    };
    const newBowler = {
      id: secondInningsForm.bowlerUuid || '',
      name: bowlerName,
      player_id: secondInningsForm.bowlerId || '',
      photo_url: secondInningsForm.bowlerPhoto || null,
      overs: '0.0',
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: '0.00'
    };

    const existingInningsList = [...(matchData.innings_data || [])];

    // Mark current innings completed in list
    const curIdx = existingInningsList.findIndex(i => i.innings_number === currentInn);
    if (curIdx >= 0) {
      existingInningsList[curIdx] = {
        ...existingInningsList[curIdx],
        runs: currentRuns,
        total_runs: currentRuns,
        wickets: currentWickets,
        overs: currentOversStr,
        overs_completed: Math.floor(currentLegalBalls / 6),
        balls_completed: currentLegalBalls,
        innings_status: 'completed'
      };
    }

    // Calculate Target if moving into the final configured innings
    let nextTarget = null;
    if (!isTestMatch) {
      // Limited Overs 2nd innings target
      if (nextInnNumber === 2) {
        nextTarget = currentRuns + 1;
      }
    } else {
      if (nextInnNumber === maxConfiguredInnings) {
        let bowlingTeamRuns = 0;
        let battingTeamRuns = 0;

        for (let i = 1; i <= currentInn; i++) {
          const inn = existingInningsList.find(x => x.innings_number === i);
          const runsScored = i === currentInn ? currentRuns : (inn?.total_runs ?? inn?.runs ?? 0);
          const innBatTeam = inn?.batting_team || inn?.team_name || (i % 2 === 1 ? matchData.team_a_name : matchData.team_b_name);

          if (innBatTeam === nextBowling) {
            bowlingTeamRuns += runsScored;
          } else if (innBatTeam === nextBatting) {
            battingTeamRuns += runsScored;
          }
        }

        nextTarget = Math.max(1, (bowlingTeamRuns - battingTeamRuns) + 1);
      }
    }

    const nextInnIdx = existingInningsList.findIndex(inn => inn.innings_number === nextInnNumber);
    const existingNextInn = nextInnIdx >= 0 ? existingInningsList[nextInnIdx] : null;

    const newInningsObj = {
      ...(existingNextInn || {}),
      id: existingNextInn?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inn-${matchData.id}-${nextInnNumber}`),
      match_id: matchData.id,
      innings_number: nextInnNumber,
      team_name: nextBatting,
      batting_team: nextBatting,
      bowling_team: nextBowling,
      runs: 0,
      total_runs: 0,
      wickets: 0,
      overs: '0.0',
      overs_completed: 0,
      balls_completed: 0,
      innings_status: 'live',
      target: nextTarget,
      batters: [newStriker, newNonStriker],
      bowlers: [newBowler],
      extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
    };

    if (nextInnIdx >= 0) {
      existingInningsList[nextInnIdx] = newInningsObj;
    } else {
      existingInningsList.push(newInningsObj);
    }
    existingInningsList.sort((a, b) => (a.innings_number || 0) - (b.innings_number || 0));

    const isNextTeamA = nextBatting === matchData.team_a_name;
    const nextState = {
      ...matchData,
      current_innings: nextInnNumber,
      target: nextTarget,
      current_batting_team: nextBatting,
      current_bowling_team: nextBowling,
      team_a_score: isNextTeamA ? 0 : matchData.team_a_score,
      team_a_wickets: isNextTeamA ? 0 : matchData.team_a_wickets,
      team_a_overs: isNextTeamA ? '0.0' : matchData.team_a_overs,
      team_b_score: !isNextTeamA ? 0 : matchData.team_b_score,
      team_b_wickets: !isNextTeamA ? 0 : matchData.team_b_wickets,
      team_b_overs: !isNextTeamA ? '0.0' : matchData.team_b_overs,
      striker: newStriker,
      non_striker: newNonStriker,
      bowler: newBowler,
      recent_balls: [],
      current_over_deliveries: [],
      completed_overs: [],
      bowlers_history: [bowlerName],
      innings_data: existingInningsList
    };

    setMatchData(nextState);
    setShowEndInningsModal(false);
    setShowBowlerModal(false);
    setNewBowlerName('');
    setNewBowlerId('');
    setNextInningsBattingChoice(null);
    setSecondInningsForm({ striker: '', nonStriker: '', bowler: '' });

    // Mark current innings completed in database
    const currentInningsId = currentInnData?.id || existingInningsList.find(i => i.innings_number === currentInn)?.id;
    if (currentInningsId) {
      inningsService.updateInnings(currentInningsId, {
        match_id: matchData.id,
        innings_status: 'completed',
        total_runs: currentRuns,
        wickets: currentWickets,
        overs_completed: Math.floor(currentLegalBalls / 6),
        balls_completed: currentLegalBalls
      }).catch(err => console.warn('Innings complete sync note:', err));
    }

    // Mark next innings live in database
    if (newInningsObj.id) {
      inningsService.updateInnings(newInningsObj.id, {
        match_id: matchData.id,
        batting_team: nextBatting,
        bowling_team: nextBowling,
        innings_status: 'live',
        target: nextTarget
      }).catch(err => console.warn('Innings live sync note:', err));
    }

    try {
      await matchService.updateMatch(matchData.id, nextState);
    } catch (err) {
      console.warn('Failed to start next innings on server:', err);
      setErrorMessage(`Server sync warning: ${err.message}`);
    }
  };

  const copyLiveLink = async () => {
    await shareMatchResult(matchData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Get complete list of all previous bowlers in match to show as quick 1-tap chips
  const currentInningsData = matchData.innings_data?.find(
    (inn) => inn.innings_number === (matchData.current_innings || 1)
  );

  // Bowler who bowled the immediate previous over in this innings cannot bowl consecutive overs
  const lastOverBowlerName = (
    matchData.completed_overs && matchData.completed_overs.length > 0
      ? matchData.completed_overs[matchData.completed_overs.length - 1]?.bowler
      : null
  )?.trim()?.toUpperCase();

  const previousBowlers = Array.from(new Set([
    ...(matchData.bowlers_history || []),
    ...(matchData.completed_overs || []).map((o) => o.bowler),
    matchData.opening_bowler_name,
    ...(currentInningsData?.bowlers || []).map((b) => b.name)
  ].map((n) => n?.trim()).filter(Boolean)))
    // Filter out active striker and non-striker
    .filter((n) => {
      const up = n.toUpperCase();
      const sUp = matchData.striker?.name?.trim()?.toUpperCase();
      const nsUp = matchData.non_striker?.name?.trim()?.toUpperCase();
      return up !== sUp && up !== nsUp;
    });

  return (
    <div className="ms-scoring-screen">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-2 py-1 border-b border-ms-border">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/matches"
            className="p-1.5 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary flex-shrink-0 cursor-pointer"
            title="Back to matches"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <div className="truncate">
            <span className="text-xs sm:text-sm font-black text-ms-text-primary truncate block">
              {matchData.title || 'Live Match'}
            </span>
            <span className="text-[10px] text-ms-cyan font-bold truncate block">
              {currentBattingTeam} vs {currentBowlingTeam}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Quick Tab Switcher */}
          <div className="flex rounded-lg bg-ms-bg-card p-0.5 border border-ms-border">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-ms-cyan text-ms-text-inverse shadow-sm'
                  : 'text-ms-text-muted hover:text-ms-text-primary'
              }`}
            >
              Scoring
            </button>
            <button
              onClick={() => setActiveTab('scorecard')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scorecard'
                  ? 'bg-ms-cyan text-ms-text-inverse shadow-sm'
                  : 'text-ms-text-muted hover:text-ms-text-primary'
              }`}
            >
              Scorecard
            </button>
          </div>

          <button
            onClick={() => loadMatchAndBalls(true)}
            className="p-1.5 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-cyan flex-shrink-0 cursor-pointer"
            title="Refresh from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={copyLiveLink}
            className="p-1.5 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary flex-shrink-0 cursor-pointer"
            title="Share match scorecard"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowActionsModal(true)}
            className="p-1.5 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary hover:border-ms-cyan/50 flex-shrink-0 cursor-pointer transition-colors"
            title="Match Actions (Hold, Cancel, Delete)"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* On Hold Status Banner */}
      {matchData.status === 'on_hold' && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
            <span>Match is ON HOLD (Paused)</span>
          </div>
          <button
            type="button"
            onClick={handleToggleHoldMatch}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Resume</span>
          </button>
        </div>
      )}

      {/* Cancelled Status Banner */}
      {matchData.status === 'cancelled' && (
        <div className="bg-red-500/15 border border-red-500/40 text-red-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>Match has been CANCELLED</span>
          </div>
          <button
            type="button"
            onClick={handleResumeCancelledMatch}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs border border-slate-600 cursor-pointer"
          >
            Reopen Match
          </button>
        </div>
      )}

      {/* Prominent Database Error Alert */}
      {errorMessage && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-white hover:text-red-300 font-bold px-1.5 py-0.5 rounded cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-300 hover:text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Scoring Area */}
      {activeTab === 'live' ? (
        <div className="flex flex-col gap-2 w-full max-w-[500px] mx-auto">
          {/* TV Broadcast Scoreboard Ribbon & Player Stats */}
          <Scoreboard
            battingTeam={currentBattingTeam}
            bowlingTeam={currentBowlingTeam}
            runs={currentRuns}
            wickets={currentWickets}
            legalBalls={currentLegalBalls}
            totalOvers={oversPerInnings}
            striker={matchData.striker}
            nonStriker={matchData.non_striker}
            bowler={matchData.bowler}
            target={matchData.target}
            status={matchData.status}
            recentBalls={matchData.recent_balls || []}
            currentOverDeliveries={matchData.current_over_deliveries || []}
            completedOvers={matchData.completed_overs || []}
            onEditPlayer={handleOpenEditPlayer}
            isTest={matchData.match_type === 'test'}
            inningsNumber={currentInnNum}
            allInnings={matchData.innings_data || []}
          />

          {/* Result banner if match is complete */}
          {matchData.status === 'completed' && matchData.result && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-[#0c162c] border-2 border-amber-500/70 dark:border-amber-400 text-center shadow-lg dark:shadow-[0_0_20px_rgba(245,158,11,0.22)]">
              <div className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-300 flex items-center justify-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 drop-shadow-sm" />
                <span className="tracking-wide">{matchData.result}</span>
              </div>
            </div>
          )}

          {/* Scoring Controls Keypad */}
          {matchData.status !== 'completed' ? (
            <ScoringPad
              onScoreBall={handleScoreBall}
              onWicket={handleWicket}
              onUndo={handleUndo}
              onSwapStrike={handleSwapStrike}
              onChangeBowler={() => setShowBowlerModal(true)}
              onEndInnings={(currentInnNum < maxConfiguredInnings) ? () => {
                setShowBowlerModal(false);
                setShowEndInningsModal(true);
              } : null}
              canUndo={canPerformUndo}
              isUndoing={isUndoing}
              strikerName={matchData.striker?.name}
              nonStrikerName={matchData.non_striker?.name}
              bowlerName={matchData.bowler?.name}
            />
          ) : (
            <div className="p-4 text-center ms-card bg-ms-bg-card border-ms-border rounded-xl space-y-2.5 shadow-md">
              <p className="text-sm text-ms-text-primary font-bold">Match concluded.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isUndoing || isSaving || isOperationBusyRef.current}
                  className="py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Reverse match-concluding delivery"
                >
                  {isUndoing ? <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Undo2 className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{isUndoing ? 'Undoing...' : 'Undo Match-Ending Ball'}</span>
                </button>
                <button
                  onClick={() => shareMatchResult(matchData)}
                  className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </button>
                <button
                  onClick={() => setActiveTab('scorecard')}
                  className="py-2 px-3.5 rounded-lg bg-ms-cyan hover:bg-ms-cyan-light text-ms-text-inverse text-xs font-bold cursor-pointer"
                >
                  View Full Scorecard
                </button>
                <Link
                  to="/matches/create"
                  className="py-2 px-3.5 rounded-lg bg-ms-bg-card hover:bg-ms-bg-input border border-ms-border text-ms-text-primary text-xs font-bold cursor-pointer no-underline"
                >
                  New Match
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Full Scorecard View */
        <div className="flex-1 overflow-y-auto pr-1">
          <Scorecard match={matchData} innings={matchData.innings_data || []} />
        </div>
      )}

      {/* Change Bowler Dialog Modal */}
      {showBowlerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl overflow-visible">
            <h3 className="text-base font-black text-ms-text-primary mb-3 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-ms-cyan" />
              <span>Select Next Bowler</span>
            </h3>

            {/* Quick 1-Tap Chips of Previous Bowlers */}
            {previousBowlers.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold text-ms-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Previous Bowlers in this match</span>
                  <span className="text-[9px] font-semibold text-ms-cyan">Tap to select directly</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-ms-bg-input rounded-xl border border-ms-border">
                  {previousBowlers.map((bName) => {
                    const isLastBowler = bName.trim().toUpperCase() === lastOverBowlerName;
                    return (
                      <button
                        key={bName}
                        type="button"
                        disabled={isLastBowler}
                        onClick={() => handleSelectPreviousBowler(bName)}
                        title={isLastBowler ? 'Cannot bowl consecutive overs' : `Select ${bName} as next bowler`}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isLastBowler
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                            : 'ms-btn-elevated hover:border-ms-cyan hover:text-ms-cyan cursor-pointer active:scale-95'
                        }`}
                      >
                        <User className="w-3 h-3 opacity-70" />
                        <span>{bName}</span>
                        {isLastBowler && (
                          <span className="text-[9px] font-normal opacity-75">(last over)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              <label className="ms-input-label text-xs">Search Registered Bowler (*)</label>
              <PlayerSelector
                value={newBowlerName}
                selectedId={newBowlerId}
                onChange={(player) => {
                  setNewBowlerName(player ? player.name : '');
                  setNewBowlerId(player ? (player.player_id || player.id) : '');
                }}
                disabledPlayers={[matchData?.striker?.name, matchData?.non_striker?.name]}
                placeholder="Search bowler by name or ID..."
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewBowlerName('');
                  setNewBowlerId('');
                  setShowBowlerModal(false);
                }}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Skip / Keep Same
              </button>
              <button
                type="button"
                onClick={handleChangeBowlerConfirm}
                disabled={!newBowlerId || !newBowlerName.trim()}
                className="ms-btn ms-btn-primary ms-btn-sm flex-1 cursor-pointer disabled:opacity-50"
              >
                Confirm Bowler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Name Dialog Modal */}
      {editPlayerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleSavePlayerName} className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl">
            <h3 className="text-sm font-black text-ms-text-primary mb-2 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-slate-800 dark:text-white" />
              <span>
                Edit {editPlayerModal.role === 'striker' ? 'Striker' : editPlayerModal.role === 'non_striker' ? 'Non-Striker' : 'Bowler'} Name
              </span>
            </h3>
            <p className="text-xs text-ms-text-secondary mb-3">
              Select replacement registered player from list:
            </p>

            <div className="mb-4">
              <PlayerSelector
                value={editPlayerModal.name}
                selectedId={editPlayerModal.playerId}
                onChange={(player) =>
                  setEditPlayerModal((prev) => ({
                    ...prev,
                    name: player ? player.name : '',
                    playerId: player ? (player.player_id || player.id) : ''
                  }))
                }
                placeholder="Search player by name or ID..."
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditPlayerModal({ isOpen: false, role: '', name: '', playerId: '' })}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editPlayerModal.playerId || !editPlayerModal.name}
                className="ms-btn ms-btn-primary ms-btn-sm flex-1 cursor-pointer disabled:opacity-50"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* End Innings & Start Next Innings Modal */}
      {showEndInningsModal && (() => {
        const curInn = matchData.current_innings || 1;
        const nextInn = curInn + 1;
        const existingInns = matchData.innings_data || [];

        // Check follow-on eligibility after Innings 2 in Test Cricket (if match has at least 3 innings)
        // Innings 1: Team A, Innings 2: Team B
        let isFollowOnEligible = false;
        let followOnLead = 0;
        if (isTestMatch && curInn === 2 && maxConfiguredInnings >= 3) {
          const inn1Runs = existingInns.find(i => i.innings_number === 1)?.runs || 0;
          const inn2Runs = currentRuns;
          followOnLead = inn1Runs - inn2Runs;
          const threshold = (oversPerInnings <= 25) ? 50 : 75;
          if (followOnLead >= threshold) {
            isFollowOnEligible = true;
          }
        }

        const effectiveBattingChoice = nextInningsBattingChoice || 'normal';
        let upcomingBattingTeam = currentBowlingTeam;
        let upcomingBowlingTeam = currentBattingTeam;

        if (isTestMatch && curInn === 2 && maxConfiguredInnings >= 3 && effectiveBattingChoice === 'follow_on') {
          upcomingBattingTeam = currentBattingTeam; // Team B follows on
          upcomingBowlingTeam = currentBowlingTeam;
        }

        const inningsName = curInn === 1 ? '1st' : curInn === 2 ? '2nd' : curInn === 3 ? '3rd' : `${curInn}th`;
        const nextInningsName = nextInn === 2 ? '2nd' : nextInn === 3 ? '3rd' : nextInn === 4 ? '4th' : `${nextInn}th`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl text-left my-auto">
              <div className="text-center mb-3">
                <Trophy className="w-8 h-8 text-black dark:text-white mx-auto mb-1.5" />
                <h3 className="text-base font-black text-ms-text-primary">
                  End of {inningsName} Innings
                </h3>
                <p className="text-xs text-ms-text-secondary mt-0.5">
                  {currentBattingTeam} scored <strong className="font-score font-bold tabular-nums">{currentRuns}/{currentWickets}</strong> in <span className="font-score font-semibold tabular-nums">{currentOversStr}</span> ov.
                </p>

                {/* Status or Target Equation */}
                {!isTestMatch ? (
                  <div className="p-2.5 bg-ms-bg-input rounded-xl border border-ms-border mt-2">
                    <span className="text-[11px] text-ms-text-muted block">Target for {currentBowlingTeam}:</span>
                    <span className="text-xl font-bold text-ms-cyan font-score tabular-nums">{currentRuns + 1} Runs</span>
                  </div>
                ) : (
                  <div className="p-2 bg-ms-bg-input rounded-xl border border-ms-border mt-2 text-xs">
                    {nextInn === maxConfiguredInnings ? (
                      <span className="text-ms-text-secondary font-bold text-ms-cyan">
                        Innings {curInn} concluded. Final {nextInningsName} Innings upcoming — target will be calculated for chase!
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-ms-text-secondary">
                          {currentBowlingTeam} will now bat in the {nextInningsName} Innings.
                        </span>
                        {curInn === 2 && maxConfiguredInnings >= 3 && (
                          <span className="text-ms-text-primary font-bold block">
                            {followOnLead >= 0
                              ? `${currentBowlingTeam} leads by ${followOnLead} runs.`
                              : `${currentBattingTeam} leads by ${Math.abs(followOnLead)} runs.`}
                          </span>
                        )}
                        {isFollowOnEligible && (
                          <span className="text-amber-800 dark:text-amber-400 font-bold block text-[11px]">
                            ⚡ Follow-on eligible! Lead of {followOnLead} runs satisfies threshold.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Follow-on Decision Switcher if eligible at end of Innings 2 */}
              {isTestMatch && curInn === 2 && isFollowOnEligible && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                  <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center justify-between">
                    <span>Captain's Follow-On Choice:</span>
                    <span className="text-[10px] uppercase font-mono px-1 rounded bg-amber-500/20">Decision</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNextInningsBattingChoice('normal')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        effectiveBattingChoice === 'normal'
                          ? 'bg-ms-cyan text-ms-text-inverse shadow-xs'
                          : 'bg-ms-bg-input text-ms-text-secondary hover:text-ms-text-primary border border-ms-border'
                      }`}
                    >
                      Bat Again ({currentBowlingTeam})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextInningsBattingChoice('follow_on')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        effectiveBattingChoice === 'follow_on'
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : 'bg-ms-bg-input text-ms-text-secondary hover:text-ms-text-primary border border-ms-border'
                      }`}
                    >
                      Enforce Follow-On
                    </button>
                  </div>
                </div>
              )}

              {/* Next Innings Players Entry */}
              <form onSubmit={handleStartNextInnings} className="space-y-2.5 border-t border-ms-border pt-3">
                <div className="text-xs font-bold text-ms-cyan uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{nextInningsName} Innings Opening Players</span>
                </div>

                <div>
                  <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                    Opening Striker ({upcomingBattingTeam}) *
                  </label>
                  <PlayerSelector
                    value={secondInningsForm.striker}
                    selectedId={secondInningsForm.strikerId}
                    onChange={(player) =>
                      setSecondInningsForm((prev) => ({
                        ...prev,
                        striker: player ? player.name : '',
                        strikerId: player ? player.player_id : '',
                        strikerUuid: player ? player.id : '',
                        strikerPhoto: player ? (player.photo_url || '') : ''
                      }))
                    }
                    disabledPlayers={[
                      secondInningsForm.nonStrikerUuid,
                      secondInningsForm.nonStrikerId,
                      secondInningsForm.nonStriker,
                      secondInningsForm.bowlerUuid,
                      secondInningsForm.bowlerId,
                      secondInningsForm.bowler
                    ].filter(Boolean)}
                    placeholder="Search opening striker by name or ID..."
                    required
                  />
                </div>

                <div>
                  <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                    Opening Non-Striker ({upcomingBattingTeam}) *
                  </label>
                  <PlayerSelector
                    value={secondInningsForm.nonStriker}
                    selectedId={secondInningsForm.nonStrikerId}
                    onChange={(player) =>
                      setSecondInningsForm((prev) => ({
                        ...prev,
                        nonStriker: player ? player.name : '',
                        nonStrikerId: player ? player.player_id : '',
                        nonStrikerUuid: player ? player.id : '',
                        nonStrikerPhoto: player ? (player.photo_url || '') : ''
                      }))
                    }
                    disabledPlayers={[
                      secondInningsForm.strikerUuid,
                      secondInningsForm.strikerId,
                      secondInningsForm.striker,
                      secondInningsForm.bowlerUuid,
                      secondInningsForm.bowlerId,
                      secondInningsForm.bowler
                    ].filter(Boolean)}
                    placeholder="Search opening non-striker by name or ID..."
                    required
                  />
                </div>

                <div>
                  <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                    Opening Bowler ({upcomingBowlingTeam}) *
                  </label>
                  <PlayerSelector
                    value={secondInningsForm.bowler}
                    selectedId={secondInningsForm.bowlerId}
                    onChange={(player) =>
                      setSecondInningsForm((prev) => ({
                        ...prev,
                        bowler: player ? player.name : '',
                        bowlerId: player ? player.player_id : '',
                        bowlerUuid: player ? player.id : '',
                        bowlerPhoto: player ? (player.photo_url || '') : ''
                      }))
                    }
                    disabledPlayers={[
                      secondInningsForm.strikerUuid,
                      secondInningsForm.strikerId,
                      secondInningsForm.striker,
                      secondInningsForm.nonStrikerUuid,
                      secondInningsForm.nonStrikerId,
                      secondInningsForm.nonStriker
                    ].filter(Boolean)}
                    placeholder="Search opening bowler by name or ID..."
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndInningsModal(false);
                      setNextInningsBattingChoice(null);
                    }}
                    className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer text-center"
                  >
                    Keep Scoring {inningsName}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !secondInningsForm.strikerId ||
                      !secondInningsForm.nonStrikerId ||
                      !secondInningsForm.bowlerId
                    }
                    className="ms-btn ms-btn-primary ms-btn-sm flex-1 cursor-pointer text-center disabled:opacity-50"
                  >
                    Start {nextInningsName} Innings
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Match Actions Modal (Hold, Cancel, Delete) */}
      {showActionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-ms-border mb-4">
              <h3 className="text-base font-black text-ms-text-primary flex items-center gap-2">
                <span>Match Management</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowActionsModal(false)}
                className="p-1 rounded-lg text-ms-text-muted hover:text-ms-text-primary hover:bg-ms-bg-elevated cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Hold / Resume Match */}
              <button
                type="button"
                onClick={handleToggleHoldMatch}
                className="w-full p-3 rounded-xl bg-ms-bg-elevated hover:bg-ms-bg-elevated/70 border border-ms-border flex items-center gap-3 text-left transition-all cursor-pointer group"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  matchData.status === 'on_hold' ? 'bg-lime-500/15 text-lime-600 dark:text-lime-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {matchData.status === 'on_hold' ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                </div>
                <div className="text-xs font-bold text-ms-text-primary group-hover:text-ms-cyan transition-colors">
                  {matchData.status === 'on_hold' ? 'Resume Match' : 'Hold Match (Pause)'}
                </div>
              </button>

              {/* Option 2: Cancel Match */}
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={matchData.status === 'cancelled'}
                className="w-full p-3 rounded-xl bg-ms-bg-elevated hover:bg-ms-bg-elevated/70 border border-ms-border flex items-center gap-3 text-left transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-ms-text-primary group-hover:text-orange-400 transition-colors">
                  Cancel Match
                </div>
              </button>

              {/* Option 3: Delete Match (Admin only) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="w-full p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-red-400 group-hover:text-red-300 transition-colors">
                    Delete Match Permanently
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Match Confirmation Dialog */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-orange-500/40 shadow-2xl rounded-2xl text-center">
            <Ban className="w-10 h-10 text-orange-400 mx-auto mb-2.5" />
            <h3 className="text-base font-black text-ms-text-primary mb-4">
              Cancel This Match?
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelMatch}
                className="ms-btn ms-btn-danger ms-btn-sm flex-1 cursor-pointer"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Match Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-red-500/50 shadow-2xl rounded-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2.5" />
            <h3 className="text-base font-black text-ms-text-primary mb-4">
              Permanently Delete Match?
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMatch}
                className="ms-btn ms-btn-danger ms-btn-sm flex-1 cursor-pointer"
              >
                Delete Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Confirmation Dialog (For Wickets & Concluded Match Events) */}
      {undoConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border border-cyan-500/50 shadow-2xl rounded-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center mx-auto mb-3">
              <Undo2 className="w-5 h-5 text-cyan-500" />
            </div>
            <h3 className="text-base font-black text-ms-text-primary mb-3">
              {undoConfirmModal.title}
            </h3>
            {undoConfirmModal.message && (
              <p className="text-xs text-ms-text-secondary leading-relaxed mb-4">
                {undoConfirmModal.message}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUndoConfirmModal({ isOpen: false, title: '', message: '' })}
                className="ms-btn ms-btn-outline ms-btn-sm flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeUndo}
                className="ms-btn ms-btn-primary ms-btn-sm flex-1 cursor-pointer"
              >
                Confirm Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
