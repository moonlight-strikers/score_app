import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Scoreboard from '../components/Scoreboard';
import ScoringPad from '../components/ScoringPad';
import Scorecard from '../components/Scorecard';
import { matchService } from '../services/matchService';
import { scoringService } from '../services/scoringService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { BALL_TYPES, isLegalDelivery, formatOvers } from '../utils/cricketRules';
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
  AlertTriangle
} from 'lucide-react';
import { shareMatchResult } from '../utils/shareMatch';

export default function LiveMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'scorecard'
  const [copied, setCopied] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Match management actions (Hold, Cancel, Delete)
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Undo history stack
  const [historyStack, setHistoryStack] = useState([]);

  // Change bowler dialog
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const [newBowlerName, setNewBowlerName] = useState('');

  // End innings dialog & 2nd innings opening players
  const [showEndInningsModal, setShowEndInningsModal] = useState(false);
  const [secondInningsForm, setSecondInningsForm] = useState({
    striker: '',
    nonStriker: '',
    bowler: ''
  });

  // Edit player name dialog (on the fly while playing)
  const [editPlayerModal, setEditPlayerModal] = useState({
    isOpen: false,
    role: '', // 'striker' | 'non_striker' | 'bowler'
    name: ''
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
      await matchService.deleteMatch(matchData.id);
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
      const match = await matchService.getMatchById(matchId);
      if (match) {
        // Fetch persisted balls for the current innings to verify score consistency
        const currentInn = match.current_innings || 1;
        const balls = await scoringService.getInningsBalls(matchId, currentInn);

        if (balls && balls.length > 0) {
          const stats = scoringService.calculateInningsScore(balls);
          const isFirst = currentInn === 1;

          // Reconcile innings_data array
          const existingInnings = Array.isArray(match.innings_data) ? [...match.innings_data] : [];
          const innIdx = existingInnings.findIndex((inn) => inn.innings_number === currentInn);
          const currentBatTeam = isFirst
            ? (match.current_batting_team || match.team_a_name)
            : (match.current_batting_team || match.team_b_name);

          const syncedInningsObj = {
            innings_number: currentInn,
            team_name: currentBatTeam,
            runs: stats.runs,
            wickets: stats.wickets,
            overs: stats.overs,
            batters: stats.batters.length > 0 ? stats.batters : (existingInnings[innIdx]?.batters || []),
            bowlers: stats.bowlers.length > 0 ? stats.bowlers : (existingInnings[innIdx]?.bowlers || []),
            extras: stats.extras
          };

          if (innIdx >= 0) {
            existingInnings[innIdx] = { ...existingInnings[innIdx], ...syncedInningsObj };
          } else {
            existingInnings.push(syncedInningsObj);
          }

          // Reconcile summary with balls
          const verifiedMatch = {
            ...match,
            team_a_score: isFirst ? stats.runs : match.team_a_score,
            team_a_wickets: isFirst ? stats.wickets : match.team_a_wickets,
            team_a_overs: isFirst ? stats.overs : match.team_a_overs,
            team_b_score: !isFirst ? stats.runs : match.team_b_score,
            team_b_wickets: !isFirst ? stats.wickets : match.team_b_wickets,
            team_b_overs: !isFirst ? stats.overs : match.team_b_overs,
            recent_balls: stats.recentBalls.length > 0 ? stats.recentBalls : (match.recent_balls || []),
            current_over_deliveries: stats.currentOverDeliveries,
            completed_overs: stats.completedOvers.length > 0 ? stats.completedOvers : (match.completed_overs || []),
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
            if (isMounted && payload.new) {
              setMatchData((prev) => {
                if (!prev) return payload.new;
                return { ...prev, ...payload.new };
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ball_by_ball', filter: `match_id=eq.${matchId}` },
          () => {
            if (isMounted) {
              loadMatchAndBalls(true);
            }
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

  const isFirstInnings = (matchData.current_innings || 1) === 1;
  const currentRuns = isFirstInnings ? (matchData.team_a_score || 0) : (matchData.team_b_score || 0);
  const currentWickets = isFirstInnings ? (matchData.team_a_wickets || 0) : (matchData.team_b_wickets || 0);
  const currentOversStr = isFirstInnings ? (matchData.team_a_overs || '0.0') : (matchData.team_b_overs || '0.0');
  const currentBattingTeam = matchData.current_batting_team || matchData.team_a_name;
  const currentBowlingTeam = matchData.current_bowling_team || matchData.team_b_name;

  // Convert overs string to legal balls count
  const [ovFull, ovBalls] = currentOversStr.split('.').map(Number);
  const currentLegalBalls = (ovFull || 0) * 6 + (ovBalls || 0);

  // Save current state for Undo
  const pushHistory = () => {
    setHistoryStack((prev) => [JSON.parse(JSON.stringify(matchData)), ...prev.slice(0, 15)]);
  };

  const handleScoreBall = async ({ runs, type, batsmanRuns = 0, isFour = false, isSix = false }) => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    const isLegal = isLegalDelivery(type);
    const newLegalBalls = isLegal ? currentLegalBalls + 1 : currentLegalBalls;
    const newOversStr = formatOvers(newLegalBalls);
    const newTotalRuns = currentRuns + runs;

    const ballLabel = type === BALL_TYPES.WIDE
      ? (runs > 1 ? `${runs}Wd` : 'Wd')
      : type === BALL_TYPES.NO_BALL
      ? (runs > 1 ? `${runs}Nb` : 'Nb')
      : type === BALL_TYPES.BYE
      ? `${runs}B`
      : type === BALL_TYPES.LEG_BYE
      ? `${runs}Lb`
      : `${runs}`;

    const runsForBatsman = type === BALL_TYPES.NORMAL ? runs : batsmanRuns;

    // 1. Prepare delivery event record for ball_by_ball table
    const ballRecord = {
      match_id: matchData.id,
      innings_number: matchData.current_innings || 1,
      over_number: Math.floor(currentLegalBalls / 6),
      ball_number: isLegal ? (currentLegalBalls % 6) + 1 : (currentLegalBalls % 6) || 1,
      delivery_sequence: (matchData.recent_balls?.length || 0) + (currentLegalBalls || 0) + 1,
      striker_name: matchData.striker?.name || 'Striker',
      bowler_name: matchData.bowler?.name || 'Bowler',
      runs: runs,
      type: type.toLowerCase(),
      batsman_runs: runsForBatsman,
      extras: (type === BALL_TYPES.WIDE || type === BALL_TYPES.NO_BALL || type === BALL_TYPES.BYE || type === BALL_TYPES.LEG_BYE) ? {
        type: type.toLowerCase(),
        runs: (type === BALL_TYPES.WIDE || type === BALL_TYPES.NO_BALL) ? (runs - runsForBatsman) : runs
      } : null,
      wicket: null
    };

    // 2. Insert into ball_by_ball FIRST. If insert fails, DO NOT update React state.
    try {
      await scoringService.recordBall(matchData.id, ballRecord);
    } catch (err) {
      console.error('Failed to insert ball:', err);
      setErrorMessage(`Failed to save ball to database: ${err.message || 'Network error'}`);
      setIsSaving(false);
      return;
    }

    pushHistory();

    // 3. Update Striker stats
    let updatedStriker = {
      ...matchData.striker,
      runs: (matchData.striker?.runs || 0) + runsForBatsman,
      balls: isLegal ? (matchData.striker?.balls || 0) + 1 : (matchData.striker?.balls || 0),
      fours: isFour ? (matchData.striker?.fours || 0) + 1 : (matchData.striker?.fours || 0),
      sixes: isSix ? (matchData.striker?.sixes || 0) + 1 : (matchData.striker?.sixes || 0),
    };

    let updatedNonStriker = { ...matchData.non_striker };

    // Swap strike on odd runs if normal ball or bye/leg-bye
    const oddRuns = runs % 2 !== 0;
    const shouldSwapStrike = (type === BALL_TYPES.NORMAL || type === BALL_TYPES.BYE || type === BALL_TYPES.LEG_BYE) && oddRuns;
    if (shouldSwapStrike) {
      const temp = updatedStriker;
      updatedStriker = updatedNonStriker;
      updatedNonStriker = temp;
    }

    // Over finished?
    const isOverFinished = isLegal && (newLegalBalls % 6 === 0);
    if (isOverFinished) {
      // Rotate strike at end of over
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

    if (!isFirstInnings && matchData.target) {
      if (newTotalRuns >= matchData.target) {
        newStatus = 'completed';
        const wicketsRemaining = 10 - currentWickets;
        winnerTeam = currentBattingTeam;
        matchResult = `${currentBattingTeam} won by ${wicketsRemaining} ${wicketsRemaining === 1 ? 'wicket' : 'wickets'}!`;
      } else if (newLegalBalls >= (matchData.overs * 6) || currentWickets >= 10) {
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
    }

    // Check End of 1st Innings
    if (isFirstInnings && (newLegalBalls >= (matchData.overs * 6) || currentWickets >= 10)) {
      setShowEndInningsModal(true);
    }

    // Current over deliveries
    const prevOverEnded = currentLegalBalls > 0 && currentLegalBalls % 6 === 0;
    const updatedOverDeliveries = prevOverEnded
      ? [ballLabel]
      : [...(matchData.current_over_deliveries || []), ballLabel];

    // Maintain completed overs history
    let updatedCompletedOvers = [...(matchData.completed_overs || [])];
    if (isOverFinished) {
      const overRuns = updatedOverDeliveries.reduce((acc, b) => {
        const match = b.match(/\d+/);
        return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
      }, 0);
      updatedCompletedOvers.push({
        overNumber: newLegalBalls / 6,
        bowler: updatedBowler.name || 'Bowler',
        deliveries: [...updatedOverDeliveries],
        runs: overRuns,
      });
    }

    const updatedBowlersHistory = Array.from(new Set([
      ...(matchData.bowlers_history || []),
      updatedBowler.name
    ].filter(Boolean)));

    // Maintain innings_data for full scorecard tab
    const currentInnNum = matchData.current_innings || 1;
    const existingInningsList = [...(matchData.innings_data || [])];
    const innIdx = existingInningsList.findIndex((inn) => inn.innings_number === currentInnNum);

    const updatedInningsObj = {
      innings_number: currentInnNum,
      team_name: currentBattingTeam,
      runs: newTotalRuns,
      wickets: currentWickets,
      overs: newOversStr,
      batters: [
        ...(existingInningsList[innIdx]?.batters || []).filter(b => b.name !== updatedStriker.name && b.name !== updatedNonStriker.name),
        updatedStriker,
        updatedNonStriker
      ],
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
      team_a_score: isFirstInnings ? newTotalRuns : matchData.team_a_score,
      team_a_wickets: isFirstInnings ? currentWickets : matchData.team_a_wickets,
      team_a_overs: isFirstInnings ? newOversStr : matchData.team_a_overs,
      team_b_score: !isFirstInnings ? newTotalRuns : matchData.team_b_score,
      team_b_wickets: !isFirstInnings ? currentWickets : matchData.team_b_wickets,
      team_b_overs: !isFirstInnings ? newOversStr : matchData.team_b_overs,
      striker: updatedStriker,
      non_striker: updatedNonStriker,
      bowler: updatedBowler,
      bowlers_history: updatedBowlersHistory,
      recent_balls: [...(matchData.recent_balls || []).slice(-17), ballLabel],
      current_over_deliveries: updatedOverDeliveries,
      completed_overs: updatedCompletedOvers,
      innings_data: existingInningsList
    };

    setMatchData(nextMatchData);

    if (isOverFinished && newStatus !== 'completed') {
      setShowBowlerModal(true);
    }

    try {
      await matchService.updateMatch(matchData.id, nextMatchData);
    } catch (err) {
      console.warn('Match summary sync note:', err);
      setErrorMessage(`Match summary sync error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWicket = async ({ wicketType, isStriker, newBatter, fielder }) => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    const newWickets = currentWickets + 1;
    const newLegalBalls = currentLegalBalls + 1;
    const newOversStr = formatOvers(newLegalBalls);

    const newBatterObj = {
      name: newBatter?.trim() || `Batter ${newWickets + 2}`,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      notOut: true
    };

    const playerOutName = isStriker ? (matchData.striker?.name || 'Striker') : (matchData.non_striker?.name || 'Non-Striker');

    // 1. Prepare wicket delivery record for ball_by_ball table
    const ballRecord = {
      match_id: matchData.id,
      innings_number: matchData.current_innings || 1,
      over_number: Math.floor(currentLegalBalls / 6),
      ball_number: (currentLegalBalls % 6) + 1,
      delivery_sequence: (matchData.recent_balls?.length || 0) + (currentLegalBalls || 0) + 1,
      striker_name: matchData.striker?.name || 'Striker',
      bowler_name: matchData.bowler?.name || 'Bowler',
      runs: 0,
      type: 'wicket',
      batsman_runs: 0,
      extras: null,
      wicket: {
        wicketType,
        playerOut: playerOutName,
        isStriker,
        newBatter: newBatterObj.name,
        fielder: fielder || ''
      }
    };

    // 2. Insert into ball_by_ball FIRST
    try {
      await scoringService.recordBall(matchData.id, ballRecord);
    } catch (err) {
      console.error('Failed to insert wicket:', err);
      setErrorMessage(`Failed to save wicket to database: ${err.message || 'Network error'}`);
      setIsSaving(false);
      return;
    }

    pushHistory();

    const finalStriker = isStriker ? newBatterObj : matchData.striker;
    const finalNonStriker = !isStriker ? newBatterObj : matchData.non_striker;

    // Update bowler wickets
    const bowlerBallsCount = (matchData.bowler?.ballsCount || 0) + 1;
    const bowlerOvers = formatOvers(bowlerBallsCount);
    const updatedBowler = {
      ...matchData.bowler,
      overs: bowlerOvers,
      ballsCount: bowlerBallsCount,
      wickets: (matchData.bowler?.wickets || 0) + (wicketType !== 'Run Out' ? 1 : 0),
    };

    const isOverFinished = newLegalBalls % 6 === 0;

    let newStatus = matchData.status;
    let matchResult = matchData.result;
    let winnerTeam = matchData.winner_team;

    if (!isFirstInnings && matchData.target && newWickets >= 10) {
      newStatus = 'completed';
      const diff = (matchData.target - 1) - currentRuns;
      winnerTeam = diff > 0 ? currentBowlingTeam : 'Tie';
      matchResult = diff > 0 ? `${currentBowlingTeam} won by ${diff} runs!` : 'Match Tied!';
    } else if (isFirstInnings && newWickets >= 10) {
      setShowEndInningsModal(true);
    }

    const prevOverEnded = currentLegalBalls > 0 && currentLegalBalls % 6 === 0;
    const updatedOverDeliveries = prevOverEnded
      ? ['W']
      : [...(matchData.current_over_deliveries || []), 'W'];

    let updatedCompletedOvers = [...(matchData.completed_overs || [])];
    if (newLegalBalls % 6 === 0) {
      const overRuns = updatedOverDeliveries.reduce((acc, b) => {
        const match = b.match(/\d+/);
        return acc + (match ? parseInt(match[0], 10) : (b.includes('Wd') || b.includes('Nb') ? 1 : 0));
      }, 0);
      updatedCompletedOvers.push({
        overNumber: newLegalBalls / 6,
        bowler: updatedBowler.name || 'Bowler',
        deliveries: [...updatedOverDeliveries],
        runs: overRuns,
      });
    }

    const updatedBowlersHistory = Array.from(new Set([
      ...(matchData.bowlers_history || []),
      updatedBowler.name
    ].filter(Boolean)));

    // Maintain innings_data
    const currentInnNum = matchData.current_innings || 1;
    const existingInningsList = [...(matchData.innings_data || [])];
    const innIdx = existingInningsList.findIndex((inn) => inn.innings_number === currentInnNum);

    const updatedInningsObj = {
      innings_number: currentInnNum,
      team_name: currentBattingTeam,
      runs: currentRuns,
      wickets: newWickets,
      overs: newOversStr,
      batters: [
        ...(existingInningsList[innIdx]?.batters || []).filter(b => b.name !== finalStriker.name && b.name !== finalNonStriker.name),
        finalStriker,
        finalNonStriker
      ],
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
      team_a_score: isFirstInnings ? currentRuns : matchData.team_a_score,
      team_a_wickets: isFirstInnings ? newWickets : matchData.team_a_wickets,
      team_a_overs: isFirstInnings ? newOversStr : matchData.team_a_overs,
      team_b_score: !isFirstInnings ? currentRuns : matchData.team_b_score,
      team_b_wickets: !isFirstInnings ? newWickets : matchData.team_b_wickets,
      team_b_overs: !isFirstInnings ? newOversStr : matchData.team_b_overs,
      striker: finalStriker,
      non_striker: finalNonStriker,
      bowler: updatedBowler,
      bowlers_history: updatedBowlersHistory,
      recent_balls: [...(matchData.recent_balls || []).slice(-17), 'W'],
      current_over_deliveries: updatedOverDeliveries,
      completed_overs: updatedCompletedOvers,
      innings_data: existingInningsList
    };

    setMatchData(nextMatchData);

    if (isOverFinished && newStatus !== 'completed') {
      setShowBowlerModal(true);
    }

    try {
      await matchService.updateMatch(matchData.id, nextMatchData);
    } catch (err) {
      console.warn('Scoring sync note:', err);
      setErrorMessage(`Match summary sync error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await scoringService.undoBall(matchData.id);

      // Re-fetch balls and strictly calculate innings score from persisted balls
      const currentInn = matchData.current_innings || 1;
      const balls = await scoringService.getInningsBalls(matchData.id, currentInn);
      const stats = scoringService.calculateInningsScore(balls);
      const isFirst = currentInn === 1;

      const previousState = historyStack[0];
      setHistoryStack((prev) => prev.slice(1));

      const revertedState = {
        ...(previousState || matchData),
        team_a_score: isFirst ? stats.runs : matchData.team_a_score,
        team_a_wickets: isFirst ? stats.wickets : matchData.team_a_wickets,
        team_a_overs: isFirst ? stats.overs : matchData.team_a_overs,
        team_b_score: !isFirst ? stats.runs : matchData.team_b_score,
        team_b_wickets: !isFirst ? stats.wickets : matchData.team_b_wickets,
        team_b_overs: !isFirst ? stats.overs : matchData.team_b_overs,
        recent_balls: stats.recentBalls,
        current_over_deliveries: stats.currentOverDeliveries,
        completed_overs: stats.completedOvers
      };

      setMatchData(revertedState);
      await matchService.updateMatch(matchData.id, revertedState);
    } catch (err) {
      console.error('Undo error:', err);
      setErrorMessage(`Failed to undo delivery: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwapStrike = async () => {
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

  const handleChangeBowlerConfirm = async () => {
    const clean = newBowlerName.trim();
    if (!clean) return;

    setMatchData((prev) => {
      const updatedHistory = Array.from(new Set([
        ...(prev.bowlers_history || []),
        prev.bowler?.name,
        clean
      ].filter(Boolean)));

      const updated = {
        ...prev,
        bowlers_history: updatedHistory,
        bowler: {
          name: clean,
          overs: '0.0',
          maidens: 0,
          runs: 0,
          wickets: 0,
          economy: '0.00'
        }
      };
      matchService.updateMatch(prev.id, updated).catch(console.warn);
      return updated;
    });
    setNewBowlerName('');
    setShowBowlerModal(false);
  };

  // Open Edit Player Name dialog
  const handleOpenEditPlayer = (role, currentName) => {
    setEditPlayerModal({
      isOpen: true,
      role,
      name: currentName || ''
    });
  };

  const handleSavePlayerName = async (e) => {
    if (e) e.preventDefault();
    const clean = editPlayerModal.name.trim();
    if (!clean) return;

    setMatchData((prev) => {
      const updated = { ...prev };
      if (editPlayerModal.role === 'striker') {
        updated.striker = { ...updated.striker, name: clean };
      } else if (editPlayerModal.role === 'non_striker') {
        updated.non_striker = { ...updated.non_striker, name: clean };
      } else if (editPlayerModal.role === 'bowler') {
        updated.bowler = { ...updated.bowler, name: clean };
        updated.bowlers_history = Array.from(new Set([...(prev.bowlers_history || []), clean]));
      }
      matchService.updateMatch(prev.id, updated).catch(console.warn);
      return updated;
    });

    setEditPlayerModal({ isOpen: false, role: '', name: '' });
  };

  const handleStartSecondInnings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const strikerName = secondInningsForm.striker?.trim() || 'Opener 1';
    const nonStrikerName = secondInningsForm.nonStriker?.trim() || 'Opener 2';
    const bowlerName = secondInningsForm.bowler?.trim() || 'Opening Bowler';

    const target = currentRuns + 1;
    const nextBatting = currentBowlingTeam;
    const nextBowling = currentBattingTeam;

    const newStriker = { name: strikerName, runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true };
    const newNonStriker = { name: nonStrikerName, runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true };
    const newBowler = { name: bowlerName, overs: '0.0', maidens: 0, runs: 0, wickets: 0, economy: '0.00' };

    const existingInningsList = [...(matchData.innings_data || [])];
    const secondInningsObj = {
      innings_number: 2,
      team_name: nextBatting,
      runs: 0,
      wickets: 0,
      overs: '0.0',
      batters: [newStriker, newNonStriker],
      bowlers: [newBowler],
      extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
    };

    const nextState = {
      ...matchData,
      current_innings: 2,
      target: target,
      current_batting_team: nextBatting,
      current_bowling_team: nextBowling,
      team_b_score: 0,
      team_b_wickets: 0,
      team_b_overs: '0.0',
      striker: newStriker,
      non_striker: newNonStriker,
      bowler: newBowler,
      recent_balls: [],
      current_over_deliveries: [],
      completed_overs: [],
      bowlers_history: [bowlerName],
      innings_data: [...existingInningsList.filter(inn => inn.innings_number !== 2), secondInningsObj]
    };

    setMatchData(nextState);
    setShowEndInningsModal(false);

    try {
      await matchService.updateMatch(matchData.id, nextState);
    } catch (err) {
      console.warn('Failed to start 2nd innings on server:', err);
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
  const previousBowlers = Array.from(new Set([
    ...(matchData.bowlers_history || []),
    ...(matchData.completed_overs || []).map((o) => o.bowler),
    matchData.bowler?.name,
    matchData.opening_bowler_name,
    ...(currentInningsData?.bowlers || []).map((b) => b.name)
  ].map((n) => n?.trim()).filter(Boolean)));

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
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
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
            totalOvers={matchData.overs || 16}
            striker={matchData.striker}
            nonStriker={matchData.non_striker}
            bowler={matchData.bowler}
            target={matchData.target}
            status={matchData.status}
            recentBalls={matchData.recent_balls || []}
            currentOverDeliveries={matchData.current_over_deliveries || []}
            completedOvers={matchData.completed_overs || []}
            onEditPlayer={handleOpenEditPlayer}
          />

          {/* Result banner if match is complete */}
          {matchData.status === 'completed' && matchData.result && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-cyan-900/60 to-cyan-950/60 border border-cyan-500/40 text-center shadow-lg">
              <div className="text-sm font-black text-amber-300 flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{matchData.result}</span>
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
              onEndInnings={isFirstInnings ? () => setShowEndInningsModal(true) : null}
              canUndo={historyStack.length > 0}
              strikerName={matchData.striker?.name}
              nonStrikerName={matchData.non_striker?.name}
              bowlerName={matchData.bowler?.name}
            />
          ) : (
            <div className="p-4 text-center ms-card bg-ms-bg-card border-ms-border rounded-xl space-y-2.5 shadow-md">
              <p className="text-sm text-ms-text-primary font-bold">Match concluded.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
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
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl">
            <h3 className="text-base font-black text-ms-text-primary mb-1 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-ms-cyan" />
              <span>Select Next Bowler</span>
            </h3>
            <p className="text-xs text-ms-text-muted mb-3">
              Tap a previous bowler or type a new bowler name:
            </p>

            {/* Quick 1-Tap Chips of Previous Bowlers */}
            {previousBowlers.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold text-ms-text-muted uppercase tracking-wider mb-1.5">
                  Previous Bowlers in this match
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-ms-bg-input rounded-xl border border-ms-border">
                  {previousBowlers.map((bName) => (
                    <button
                      key={bName}
                      type="button"
                      onClick={() => {
                        setNewBowlerName(bName);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        newBowlerName === bName
                          ? 'bg-ms-cyan text-ms-text-inverse shadow-sm'
                          : 'bg-ms-bg-card border border-ms-border text-ms-text-primary hover:border-ms-cyan'
                      }`}
                    >
                      <User className="w-3 h-3 opacity-70" />
                      <span>{bName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              <label className="ms-input-label text-xs">Or type bowler name</label>
              <input
                type="text"
                value={newBowlerName}
                onChange={(e) => setNewBowlerName(e.target.value)}
                placeholder="e.g. Next Bowler"
                className="ms-input text-sm py-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChangeBowlerConfirm();
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewBowlerName('');
                  setShowBowlerModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-ms-bg-elevated hover:bg-ms-bg-elevated/70 text-ms-text-secondary hover:text-ms-text-primary border border-ms-border text-xs font-bold cursor-pointer"
              >
                Skip / Keep Same
              </button>
              <button
                type="button"
                onClick={handleChangeBowlerConfirm}
                disabled={!newBowlerName.trim()}
                className="flex-1 py-2 rounded-xl bg-ms-cyan hover:bg-ms-cyan-light text-ms-text-inverse text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
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
              <Edit2 className="w-4 h-4 text-ms-cyan" />
              <span>
                Edit {editPlayerModal.role === 'striker' ? 'Striker' : editPlayerModal.role === 'non_striker' ? 'Non-Striker' : 'Bowler'} Name
              </span>
            </h3>
            <p className="text-xs text-ms-text-secondary mb-3">
              Enter the player's name directly:
            </p>

            <input
              type="text"
              value={editPlayerModal.name}
              onChange={(e) => setEditPlayerModal({ ...editPlayerModal, name: e.target.value })}
              placeholder="Enter player name"
              className="ms-input text-sm py-2 mb-4"
              autoFocus
              required
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditPlayerModal({ isOpen: false, role: '', name: '' })}
                className="flex-1 py-2 rounded-xl bg-ms-bg-elevated hover:bg-ms-bg-elevated/70 text-ms-text-secondary hover:text-ms-text-primary border border-ms-border text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-ms-cyan hover:bg-ms-cyan-light text-ms-text-inverse text-xs font-black shadow-md cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* End Innings & Start 2nd Innings Modal */}
      {showEndInningsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-ms-border shadow-2xl rounded-2xl text-left my-auto">
            <div className="text-center mb-3">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-1.5" />
              <h3 className="text-base font-black text-ms-text-primary">
                End of 1st Innings
              </h3>
              <p className="text-xs text-ms-text-secondary mt-0.5">
                {currentBattingTeam} scored <strong>{currentRuns}/{currentWickets}</strong> in {currentOversStr} ov.
              </p>
              <div className="p-2.5 bg-ms-bg-input rounded-xl border border-ms-border mt-2">
                <span className="text-[11px] text-ms-text-muted block">Target for {currentBowlingTeam}:</span>
                <span className="text-xl font-black text-ms-cyan font-mono">{currentRuns + 1} Runs</span>
              </div>
            </div>

            {/* 2nd Innings Players Entry */}
            <form onSubmit={handleStartSecondInnings} className="space-y-2.5 border-t border-ms-border pt-3">
              <div className="text-xs font-bold text-ms-cyan uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>2nd Innings Opening Players</span>
              </div>

              <div>
                <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                  Opening Striker ({currentBowlingTeam}) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batter 1"
                  value={secondInningsForm.striker}
                  onChange={(e) => setSecondInningsForm((prev) => ({ ...prev, striker: e.target.value }))}
                  className="ms-input text-xs py-1.5"
                />
              </div>

              <div>
                <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                  Opening Non-Striker ({currentBowlingTeam}) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batter 2"
                  value={secondInningsForm.nonStriker}
                  onChange={(e) => setSecondInningsForm((prev) => ({ ...prev, nonStriker: e.target.value }))}
                  className="ms-input text-xs py-1.5"
                />
              </div>

              <div>
                <label className="ms-input-label text-[11px] font-semibold text-ms-text-secondary">
                  Opening Bowler ({currentBattingTeam}) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bowler 1"
                  value={secondInningsForm.bowler}
                  onChange={(e) => setSecondInningsForm((prev) => ({ ...prev, bowler: e.target.value }))}
                  className="ms-input text-xs py-1.5"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndInningsModal(false)}
                  className="flex-1 py-2 rounded-xl bg-ms-bg-elevated text-ms-text-secondary hover:text-ms-text-primary border border-ms-border text-xs font-bold cursor-pointer text-center"
                >
                  Keep Scoring 1st
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-ms-cyan hover:bg-ms-cyan-light text-ms-text-inverse text-xs font-black shadow-md cursor-pointer text-center"
                >
                  Start 2nd Innings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  matchData.status === 'on_hold' ? 'bg-lime-500/15 text-lime-400' : 'bg-amber-500/15 text-amber-400'
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
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-ms-text-primary group-hover:text-orange-400 transition-colors">
                  Cancel Match
                </div>
              </button>

              {/* Option 3: Delete Match */}
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
            </div>
          </div>
        </div>
      )}

      {/* Cancel Match Confirmation Dialog */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="ms-card p-5 max-w-sm w-full bg-ms-bg-card border-orange-500/40 shadow-2xl rounded-2xl text-center">
            <Ban className="w-10 h-10 text-orange-400 mx-auto mb-2.5" />
            <h3 className="text-base font-black text-ms-text-primary mb-1">
              Cancel This Match?
            </h3>
            <p className="text-xs text-ms-text-secondary mb-4">
              Are you sure you want to mark this match as cancelled? Scoring will stop and the status will be broadcast as cancelled.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl bg-ms-bg-elevated text-ms-text-secondary hover:text-ms-text-primary border border-ms-border text-xs font-bold cursor-pointer"
              >
                No, Keep Playing
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelMatch}
                className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Yes, Cancel Match
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
            <h3 className="text-base font-black text-ms-text-primary mb-1">
              Permanently Delete Match?
            </h3>
            <p className="text-xs text-ms-text-secondary mb-4">
              This action cannot be undone. All ball-by-ball deliveries, wickets, and score records for <strong>{matchData.team_a_name} vs {matchData.team_b_name}</strong> will be erased from Supabase.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl bg-ms-bg-elevated text-ms-text-secondary hover:text-ms-text-primary border border-ms-border text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMatch}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
