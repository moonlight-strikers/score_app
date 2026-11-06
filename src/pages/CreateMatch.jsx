import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../services/matchService';
import { inningsService } from '../services/inningsService';
import Stepper, { Step } from '../components/Stepper';
import PlayerSelector from '../components/PlayerSelector';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Trophy,
  Shield,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Layers,
  AlertCircle
} from 'lucide-react';

export default function CreateMatch() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    venue: '',
    match_type: 'limited_overs',
    configured_innings: 4,
    ball_type: 'Tennis Ball',
    overs: 20,
    max_overs_per_bowler: 4,
    team_a_name: 'Team A',
    team_b_name: 'Team B',
    toss_winner: 'Team A',
    toss_decision: 'bat',
    striker_name: '',
    striker_id: '',
    non_striker_name: '',
    non_striker_id: '',
    opening_bowler_name: '',
    opening_bowler_id: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const isPlayerName = ['striker_name', 'non_striker_name', 'opening_bowler_name'].includes(name);
    const processedValue = isPlayerName ? value.toUpperCase() : value;

    if (error) setError('');

    setFormData((prev) => {
      const updated = { ...prev, [name]: processedValue };
      if (name === 'team_a_name' && prev.toss_winner === prev.team_a_name) {
        updated.toss_winner = value;
      }
      if (name === 'team_b_name' && prev.toss_winner === prev.team_b_name) {
        updated.toss_winner = value;
      }
      return updated;
    });
  };

  const handleOversPreset = (ov) => {
    if (error) setError('');
    setFormData((prev) => ({
      ...prev,
      overs: ov,
      max_overs_per_bowler: Math.max(1, Math.ceil(ov / 5))
    }));
  };

  const validateStep = (stepNumber) => {
    if (stepNumber === 1) {
      const parsedOvers = Number(formData.overs);
      if (isNaN(parsedOvers) || parsedOvers < 1 || parsedOvers > 200) {
        setError('Please enter a valid number of overs (between 1 and 200).');
        return false;
      }
      if (formData.match_type === 'test') {
        const inn = Number(formData.configured_innings);
        if (![1, 2, 3, 4].includes(inn)) {
          setError('Please select number of innings (1, 2, 3, or 4).');
          return false;
        }
      }
      return true;
    }

    if (stepNumber === 2) {
      const a = (formData.team_a_name || '').trim();
      const b = (formData.team_b_name || '').trim();
      if (!a) {
        setError('Team A name is required.');
        return false;
      }
      if (!b) {
        setError('Team B name is required.');
        return false;
      }
      if (a.toLowerCase() === b.toLowerCase()) {
        setError('Team A and Team B cannot have identical names.');
        return false;
      }
      return true;
    }

    if (stepNumber === 3) {
      if (!formData.striker_id || !formData.striker_name) {
        setError('Please search and select a registered player for Striker.');
        return false;
      }
      if (!formData.non_striker_id || !formData.non_striker_name) {
        setError('Please search and select a registered player for Non-Striker.');
        return false;
      }
      if (!formData.opening_bowler_id || !formData.opening_bowler_name) {
        setError('Please search and select a registered player for Opening Bowler.');
        return false;
      }

      // Check duplicates using UUID (or player_id / normalized name)
      const sId = formData.striker_uuid || formData.striker_id;
      const nsId = formData.non_striker_uuid || formData.non_striker_id;
      const bId = formData.opening_bowler_uuid || formData.opening_bowler_id;
      const sName = (formData.striker_name || '').trim().toLowerCase();
      const nsName = (formData.non_striker_name || '').trim().toLowerCase();
      const bName = (formData.opening_bowler_name || '').trim().toLowerCase();

      if (
        sId === nsId ||
        sId === bId ||
        nsId === bId ||
        sName === nsName ||
        sName === bName ||
        nsName === bName
      ) {
        setError('Each opening position must have a different player. Please select another player.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError('');
      setCurrentStep((prev) => Math.min(3, prev + 1));
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleStepChange = (targetStep) => {
    if (targetStep < currentStep) {
      setError('');
      setCurrentStep(targetStep);
    } else {
      let canAdvance = true;
      for (let s = currentStep; s < targetStep; s++) {
        if (!validateStep(s)) {
          canAdvance = false;
          break;
        }
      }
      if (canAdvance) {
        setError('');
        setCurrentStep(targetStep);
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setLoading(true);

    try {
      const battingFirst =
        (formData.toss_winner === formData.team_a_name && formData.toss_decision === 'bat') ||
        (formData.toss_winner === formData.team_b_name && formData.toss_decision === 'bowl')
          ? formData.team_a_name
          : formData.team_b_name;

      const bowlingFirst =
        battingFirst === formData.team_a_name ? formData.team_b_name : formData.team_a_name;

      const isTest = formData.match_type === 'test';
      const configuredInnings = isTest ? (Number(formData.configured_innings) || 4) : 2;
      const parsedOvers = Number(formData.overs);

      // Generate all configured innings in advance
      const initialInningsList = [];
      for (let i = 1; i <= configuredInnings; i++) {
        const isOdd = i % 2 === 1;
        const innBatting = isOdd ? battingFirst : bowlingFirst;
        const innBowling = isOdd ? bowlingFirst : battingFirst;

        initialInningsList.push({
          innings_number: i,
          team_name: innBatting,
          bowling_team: innBowling,
          runs: 0,
          wickets: 0,
          overs: '0.0',
          batters: i === 1 ? [
            {
              id: formData.striker_uuid || '',
              name: (formData.striker_name?.trim() || 'Striker').toUpperCase(),
              player_id: formData.striker_id || '',
              photo_url: formData.striker_photo || null,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              notOut: true
            },
            {
              id: formData.non_striker_uuid || '',
              name: (formData.non_striker_name?.trim() || 'Non-Striker').toUpperCase(),
              player_id: formData.non_striker_id || '',
              photo_url: formData.non_striker_photo || null,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              notOut: true
            }
          ] : [],
          bowlers: i === 1 ? [
            {
              id: formData.opening_bowler_uuid || '',
              name: (formData.opening_bowler_name?.trim() || 'Bowler').toUpperCase(),
              player_id: formData.opening_bowler_id || '',
              photo_url: formData.opening_bowler_photo || null,
              overs: '0.0',
              maidens: 0,
              runs: 0,
              wickets: 0,
              economy: '0.00'
            }
          ] : [],
          extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
        });
      }

      const newMatchData = {
        title: formData.title || (isTest ? 'Test Match' : 'Saturday Night Match'),
        venue: formData.venue || '',
        ball_type: formData.ball_type || 'Tennis Ball',
        match_type: isTest ? 'test' : 'limited_overs',
        configured_innings: configuredInnings,
        overs_per_innings: parsedOvers,
        overs: parsedOvers,
        max_overs_per_bowler: isTest ? 99 : (Number(formData.max_overs_per_bowler) || Math.max(1, Math.ceil(parsedOvers / 5))),
        team_a_name: formData.team_a_name || 'Team A',
        team_b_name: formData.team_b_name || 'Team B',
        toss_winner: formData.toss_winner || formData.team_a_name || 'Team A',
        toss_decision: formData.toss_decision,
        current_batting_team: battingFirst,
        current_bowling_team: bowlingFirst,
        current_innings: 1,
        current_over_deliveries: [],
        recent_balls: [],
        striker: {
          id: formData.striker_uuid || '',
          name: (formData.striker_name?.trim() || 'Striker').toUpperCase(),
          player_id: formData.striker_id || '',
          photo_url: formData.striker_photo || null,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        non_striker: {
          id: formData.non_striker_uuid || '',
          name: (formData.non_striker_name?.trim() || 'Non-Striker').toUpperCase(),
          player_id: formData.non_striker_id || '',
          photo_url: formData.non_striker_photo || null,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        bowler: {
          id: formData.opening_bowler_uuid || '',
          name: (formData.opening_bowler_name?.trim() || 'Bowler').toUpperCase(),
          player_id: formData.opening_bowler_id || '',
          photo_url: formData.opening_bowler_photo || null,
          overs: '0.0',
          maidens: 0,
          runs: 0,
          wickets: 0,
          economy: '0.00'
        },
        innings_data: initialInningsList
      };

      const created = await matchService.createMatch(newMatchData);

      // Also create records in Supabase 'innings' table
      try {
        await inningsService.createInningsForMatch(created.id, configuredInnings, battingFirst, bowlingFirst);
      } catch (innErr) {
        console.warn('Note initializing innings in Supabase:', innErr);
      }

      navigate(`/live/${created.id}`);
    } catch (err) {
      console.error('Failed to create match:', err);
      alert(`Could not initialize match: ${err.message || 'Please check inputs and try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ms-page pb-8 max-w-xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <img
          src="/logo.png"
          alt="MoonLight Strikers"
          className="w-10 h-10 rounded-xl object-cover border border-ms-cyan/30 shadow-xs"
        />
        <div>
          <h1 className="text-xl font-bold text-ms-text-primary tracking-tight">
            {t('createMatch.title')}
          </h1>
          <p className="text-[11px] text-ms-text-muted">{t('createMatch.subtitle')}</p>
        </div>
      </div>

      {/* Validation Error Banner */}
      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3-Step Wizard Container */}
      <form onSubmit={handleSubmit} className="w-full">
        <Stepper
          step={currentStep}
          onStepChange={handleStepChange}
          linear={true}
          showFooter={false}
          theme={theme}
          accentColor="#0782C6"
          className="w-full"
        >
          {/* ============================================================ */}
          {/* STEP 1 – MATCH CONFIGURATION                                 */}
          {/* ============================================================ */}
          <Step title={t('createMatch.step1Title')}>
            <div className="flex flex-col gap-3.5 w-full pt-1">
              {/* Match Format Card */}
              <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm rounded-2xl">
                <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-black dark:text-white" />
                  <span>{t('createMatch.matchFormat')}</span>
                </h2>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      match_type: 'limited_overs',
                      overs: 20,
                      max_overs_per_bowler: 4
                    }))}
                    className={`py-2.5 px-3 rounded-full border text-xs sm:text-sm font-semibold transition-all text-center flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      formData.match_type !== 'test'
                        ? 'ms-btn-primary font-bold'
                        : 'ms-btn-elevated'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>{t('createMatch.limitedOvers')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      match_type: 'test',
                      overs: 20,
                      configured_innings: 4,
                      max_overs_per_bowler: 99
                    }))}
                    className={`py-2.5 px-3 rounded-full border text-xs sm:text-sm font-semibold transition-all text-center flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      formData.match_type === 'test'
                        ? 'ms-btn-primary font-bold'
                        : 'ms-btn-elevated'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>{t('createMatch.testMatch')}</span>
                  </button>
                </div>
              </div>

              {/* Match Overs Card (Limited Overs) */}
              {formData.match_type !== 'test' ? (
                <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm rounded-2xl">
                  <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-black dark:text-white" />
                    <span>{t('createMatch.matchOvers')}</span>
                  </h2>

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[6, 8, 10, 12, 20, 25].map((ov) => (
                        <button
                          key={ov}
                          type="button"
                          onClick={() => handleOversPreset(ov)}
                          className={`h-11 rounded-full text-sm sm:text-base font-score font-bold tabular-nums leading-tight border transition-all cursor-pointer text-center truncate active:scale-[0.98] flex items-center justify-center ${
                            Number(formData.overs) === ov
                              ? 'ms-btn-primary'
                              : 'ms-btn-elevated'
                          }`}
                        >
                          {ov}
                        </button>
                      ))}
                    </div>

                    <div className="pt-0.5">
                      <label className="ms-input-label text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('createMatch.customOvers')}
                      </label>
                      <input
                        type="number"
                        name="overs"
                        min="1"
                        max="200"
                        value={formData.overs}
                        onChange={handleChange}
                        required
                        placeholder={t('createMatch.enterCustomOvers')}
                        className="ms-input text-base py-2 font-score tabular-nums font-bold text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Number of Innings Card (Test Match: 4, 6 or 8) */}
                  <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm rounded-2xl">
                    <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>{t('createMatch.numberOfInnings')}</span>
                    </h2>

                    <div className="grid grid-cols-3 gap-2">
                      {[4, 6, 8].map((inn) => (
                        <button
                          key={inn}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, configured_innings: inn }))}
                          className={`h-11 rounded-full border text-xs sm:text-sm font-bold transition-all text-center cursor-pointer active:scale-[0.98] flex items-center justify-center ${
                            Number(formData.configured_innings) === inn
                              ? 'ms-btn-primary'
                              : 'ms-btn-elevated'
                          }`}
                        >
                          {inn} {t('common.innings')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Overs Per Innings Card */}
                  <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm rounded-2xl">
                    <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>{t('createMatch.oversPerInnings')}</span>
                    </h2>

                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[15, 20, 25].map((ov) => (
                          <button
                            key={ov}
                            type="button"
                            onClick={() => handleOversPreset(ov)}
                            className={`h-11 rounded-full text-sm sm:text-base font-score font-bold tabular-nums leading-tight border transition-all cursor-pointer text-center truncate active:scale-[0.98] flex items-center justify-center ${
                              Number(formData.overs) === ov
                                ? 'ms-btn-primary'
                                : 'ms-btn-elevated'
                            }`}
                          >
                            {ov}
                          </button>
                        ))}
                      </div>

                      <div className="pt-0.5">
                        <label className="ms-input-label text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('createMatch.customOversPerInnings')}
                        </label>
                        <input
                          type="number"
                          name="overs"
                          min="1"
                          max="200"
                          value={formData.overs}
                          onChange={handleChange}
                          required
                          placeholder={t('createMatch.enterCustomOversPerInnings')}
                          className="ms-input text-base py-2 font-score tabular-nums font-bold text-slate-900 dark:text-white rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 1 Navigation */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="ms-btn ms-btn-primary w-full cursor-pointer"
                >
                  <span>{t('createMatch.continueToTeams')}</span>
                  <ArrowRight />
                </button>
              </div>
            </div>
          </Step>

          {/* ============================================================ */}
          {/* STEP 2 – TEAMS & TOSS                                        */}
          {/* ============================================================ */}
          <Step title={t('createMatch.step2Title')}>
            <div className="flex flex-col gap-3.5 w-full pt-1">
              <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm rounded-2xl">
                <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-black dark:text-white" />
                  <span>{t('createMatch.teamNames')}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="ms-input-label text-xs font-semibold">{t('createMatch.teamAName')}</label>
                    <input
                      type="text"
                      name="team_a_name"
                      value={formData.team_a_name}
                      onChange={handleChange}
                      required
                      placeholder={t('createMatch.teamAPlaceholder')}
                      className="ms-input text-xs sm:text-sm py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="ms-input-label text-xs font-semibold">{t('createMatch.teamBName')}</label>
                    <input
                      type="text"
                      name="team_b_name"
                      value={formData.team_b_name}
                      onChange={handleChange}
                      required
                      placeholder={t('createMatch.teamBPlaceholder')}
                      className="ms-input text-xs sm:text-sm py-2 rounded-xl"
                    />
                  </div>
                </div>

                {/* Toss Won By — Segmented Selection */}
                <div className="space-y-1.5 pt-3 border-t border-ms-border/50 mt-3">
                  <label className="ms-input-label text-xs font-semibold">{t('createMatch.tossWinner')}</label>
                  <div className="ms-segmented">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, toss_winner: prev.team_a_name || 'Team A' }))}
                      className={`ms-segmented-item py-2 ${
                        formData.toss_winner !== (formData.team_b_name || 'Team B')
                          ? 'ms-segmented-item-active'
                          : ''
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" />
                      <span className="truncate font-bold text-xs sm:text-sm">{formData.team_a_name || 'Team A'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, toss_winner: prev.team_b_name || 'Team B' }))}
                      className={`ms-segmented-item py-2 ${
                        formData.toss_winner === (formData.team_b_name || 'Team B')
                          ? 'ms-segmented-item-active'
                          : ''
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" />
                      <span className="truncate font-bold text-xs sm:text-sm">{formData.team_b_name || 'Team B'}</span>
                    </button>
                  </div>
                </div>

                {/* Toss Decision — Segmented Selection */}
                <div className="space-y-1.5 pt-2">
                  <label className="ms-input-label text-xs font-semibold">{t('createMatch.tossDecision')}</label>
                  <div className="ms-segmented">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, toss_decision: 'bat' }))}
                      className={`ms-segmented-item py-2 ${
                        formData.toss_decision !== 'bowl' ? 'ms-segmented-item-active' : ''
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm">🏏 {t('createMatch.batFirst')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, toss_decision: 'bowl' }))}
                      className={`ms-segmented-item py-2 ${
                        formData.toss_decision === 'bowl' ? 'ms-segmented-item-active' : ''
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm">⚾ {t('createMatch.bowlFirst')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 Navigation */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleBack}
                  className="ms-btn ms-btn-outline cursor-pointer flex-none"
                >
                  <ArrowLeft />
                  <span>{t('common.back')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="ms-btn ms-btn-primary flex-1 cursor-pointer"
                >
                  <span>{t('createMatch.continueToPlayers')}</span>
                  <ArrowRight />
                </button>
              </div>
            </div>
          </Step>

          {/* ============================================================ */}
          {/* STEP 3 – OPENING PLAYERS                                     */}
          {/* ============================================================ */}
          <Step title={t('createMatch.step3Title')}>
            <div className="flex flex-col gap-3.5 w-full pt-1">
              <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card rounded-2xl shadow-sm overflow-visible">
                <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-black dark:text-white" />
                  <span>{t('createMatch.openingLineup')}</span>
                </h2>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="ms-input-label text-xs font-semibold">{t('createMatch.striker')} *</label>
                      <PlayerSelector
                        value={formData.striker_name}
                        selectedId={formData.striker_id}
                        onChange={(player) => {
                          if (error) setError('');
                          setFormData((prev) => ({
                            ...prev,
                            striker_name: player ? player.name : '',
                            striker_id: player ? player.player_id : '',
                            striker_uuid: player ? player.id : '',
                            striker_photo: player ? (player.photo_url || '') : ''
                          }));
                        }}
                        disabledPlayers={[
                          formData.non_striker_uuid,
                          formData.non_striker_id,
                          formData.non_striker_name,
                          formData.opening_bowler_uuid,
                          formData.opening_bowler_id,
                          formData.opening_bowler_name
                        ].filter(Boolean)}
                        placeholder="Search striker by name or ID..."
                        required
                      />
                    </div>

                    <div>
                      <label className="ms-input-label text-xs font-semibold">{t('createMatch.nonStriker')} *</label>
                      <PlayerSelector
                        value={formData.non_striker_name}
                        selectedId={formData.non_striker_id}
                        onChange={(player) => {
                          if (error) setError('');
                          setFormData((prev) => ({
                            ...prev,
                            non_striker_name: player ? player.name : '',
                            non_striker_id: player ? player.player_id : '',
                            non_striker_uuid: player ? player.id : '',
                            non_striker_photo: player ? (player.photo_url || '') : ''
                          }));
                        }}
                        disabledPlayers={[
                          formData.striker_uuid,
                          formData.striker_id,
                          formData.striker_name,
                          formData.opening_bowler_uuid,
                          formData.opening_bowler_id,
                          formData.opening_bowler_name
                        ].filter(Boolean)}
                        placeholder="Search non-striker by name or ID..."
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="ms-input-label text-xs font-semibold">{t('createMatch.openingBowler')} *</label>
                    <PlayerSelector
                      value={formData.opening_bowler_name}
                      selectedId={formData.opening_bowler_id}
                      onChange={(player) => {
                        if (error) setError('');
                        setFormData((prev) => ({
                          ...prev,
                          opening_bowler_name: player ? player.name : '',
                          opening_bowler_id: player ? player.player_id : '',
                          opening_bowler_uuid: player ? player.id : '',
                          opening_bowler_photo: player ? (player.photo_url || '') : ''
                        }));
                      }}
                      disabledPlayers={[
                        formData.striker_uuid,
                        formData.striker_id,
                        formData.striker_name,
                        formData.non_striker_uuid,
                        formData.non_striker_id,
                        formData.non_striker_name
                      ].filter(Boolean)}
                      placeholder="Search opening bowler by name or ID..."
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Match Details Preview Summary */}
              <div className="p-3 bg-[#0d172b] border border-cyan-500/20 rounded-xl text-xs space-y-1 text-slate-300">
                <div className="flex justify-between font-bold text-white">
                  <span>{formData.team_a_name || 'Team A'} {t('common.vs')} {formData.team_b_name || 'Team B'}</span>
                  <span className="text-cyan-400 capitalize">{formData.match_type === 'test' ? `${t('createMatch.testMatch')} (${formData.configured_innings} ${t('common.innings')})` : `${formData.overs} ${t('common.overs')}`}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('createMatch.tossResultPrefix')} <strong className="text-slate-200">{formData.toss_winner || formData.team_a_name}</strong> {t('createMatch.choseTo')} <strong className="text-slate-200">{formData.toss_decision === 'bat' ? t('createMatch.batFirst') : t('createMatch.bowlFirst')}</strong>
                </div>
              </div>

              {/* Step 3 Navigation: Back & Start Match */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="ms-btn ms-btn-outline cursor-pointer flex-none"
                >
                  <ArrowLeft />
                  <span>{t('common.back')}</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ms-btn ms-btn-primary flex-1 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? t('createMatch.creatingMatch') : t('createMatch.startMatch')}</span>
                </button>
              </div>
            </div>
          </Step>
        </Stepper>
      </form>
    </div>
  );
}
