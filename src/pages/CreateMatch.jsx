import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../services/matchService';
import { inningsService } from '../services/inningsService';
import { Trophy, Shield, User, ArrowRight, Sparkles, Zap, Layers } from 'lucide-react';

export default function CreateMatch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    non_striker_name: '',
    opening_bowler_name: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const isPlayerName = ['striker_name', 'non_striker_name', 'opening_bowler_name'].includes(name);
    const processedValue = isPlayerName ? value.toUpperCase() : value;
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
    setFormData((prev) => ({
      ...prev,
      overs: ov,
      max_overs_per_bowler: Math.max(1, Math.ceil(ov / 5))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      if (isNaN(parsedOvers) || parsedOvers < 1 || parsedOvers > 200) {
        alert('Please enter a valid number of overs (between 1 and 200).');
        setLoading(false);
        return;
      }

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
            { name: (formData.striker_name?.trim() || 'Striker').toUpperCase(), runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true },
            { name: (formData.non_striker_name?.trim() || 'Non-Striker').toUpperCase(), runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true }
          ] : [],
          bowlers: i === 1 ? [
            { name: (formData.opening_bowler_name?.trim() || 'Bowler').toUpperCase(), overs: '0.0', maidens: 0, runs: 0, wickets: 0, economy: '0.00' }
          ] : [],
          extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
        });
      }

      const newMatchData = {
        title: formData.title || (isTest ? 'Test Match' : 'Saturday Night Match'),
        venue: formData.venue || 'Oval Ground',
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
          name: (formData.striker_name?.trim() || 'Striker').toUpperCase(),
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        non_striker: {
          name: (formData.non_striker_name?.trim() || 'Non-Striker').toUpperCase(),
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        bowler: {
          name: (formData.opening_bowler_name?.trim() || 'Bowler').toUpperCase(),
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
    <div className="ms-page pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <img
          src="/logo.png"
          alt="MoonLight Strikers"
          className="w-10 h-10 rounded-xl object-cover border border-ms-cyan/30 shadow-xs"
        />
        <div>
          <h1 className="text-xl font-semibold text-ms-text-primary tracking-tight">
            Create Match
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
        {/* Match Format Card: Limited Overs vs Test Match */}
        <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
          <h2 className="text-xs font-semibold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-black dark:text-white" />
            <span>Match Format</span>
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
              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                formData.match_type !== 'test'
                  ? 'bg-ms-cyan text-ms-text-inverse border-ms-cyan shadow-sm'
                  : 'bg-ms-bg-input border-ms-border text-ms-text-secondary hover:text-ms-text-primary'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-black dark:text-white" />
              <span className="font-semibold text-xs sm:text-sm">Limited Overs</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData((prev) => ({
                ...prev,
                match_type: 'test',
                overs: 20,
                max_overs_per_bowler: 99
              }))}
              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                formData.match_type === 'test'
                  ? 'bg-ms-cyan text-ms-text-inverse border-ms-cyan shadow-sm'
                  : 'bg-ms-bg-input border-ms-border text-ms-text-secondary hover:text-ms-text-primary'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-black dark:text-white" />
              <span className="font-semibold text-xs sm:text-sm">Test Match</span>
            </button>
          </div>
        </div>

        {/* Match Overs Card */}
        {formData.match_type !== 'test' ? (
          <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
            <h2 className="text-sm font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-black dark:text-white" />
              <span>Match Overs</span>
            </h2>

            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                {[6, 8, 10, 12, 20, 25].map((ov) => (
                  <button
                    key={ov}
                    type="button"
                    onClick={() => handleOversPreset(ov)}
                    className={`py-1.5 px-1 rounded-lg text-base sm:text-lg font-score font-bold tabular-nums leading-tight border transition-all cursor-pointer text-center truncate active:scale-[0.98] ${
                      Number(formData.overs) === ov
                        ? 'bg-cyan-500 text-slate-950 font-black border-cyan-500 shadow-sm'
                        : 'bg-ms-bg-input border-ms-border text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-ms-border-light'
                    }`}
                  >
                    {ov} Overs
                  </button>
                ))}
              </div>
              <div className="pt-1">
                <label className="ms-input-label text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Or custom overs</label>
                <input
                  type="number"
                  name="overs"
                  min="1"
                  max="100"
                  value={formData.overs}
                  onChange={handleChange}
                  required
                  className="ms-input text-base py-1.5 font-score tabular-nums font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Number of Innings Card (Test Cricket only) */}
            <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
              <h2 className="text-sm font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-black dark:text-white" />
                <span>Number of Innings</span>
              </h2>

              <div className="grid grid-cols-3 gap-2">
                {[2, 4, 6].map((inn) => (
                  <button
                    key={inn}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, configured_innings: inn }))}
                    className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer active:scale-[0.98] ${
                      Number(formData.configured_innings) === inn
                        ? 'bg-cyan-500 text-slate-950 font-black border-cyan-500 shadow-sm'
                        : 'bg-ms-bg-input border-ms-border text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400'
                    }`}
                  >
                    {inn} Innings
                  </button>
                ))}
              </div>
            </div>

            {/* Overs Per Innings Card */}
            <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
              <h2 className="text-sm font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-black dark:text-white" />
                <span>Overs Per Innings</span>
              </h2>

              <div className="space-y-2.5">
                {/* Provided options: 15, 20, 25, 30 Overs (plus 10 for testing) */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 15, 20, 25, 30].map((ov) => (
                    <button
                      key={ov}
                      type="button"
                      onClick={() => handleOversPreset(ov)}
                      className={`py-1.5 px-1 rounded-lg text-sm sm:text-base font-score font-bold tabular-nums leading-tight border transition-all cursor-pointer text-center truncate active:scale-[0.98] ${
                        Number(formData.overs) === ov
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-500 shadow-sm'
                          : 'bg-ms-bg-input border-ms-border text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-ms-border-light'
                      }`}
                    >
                      {ov} Ov
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <label className="ms-input-label text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Custom Overs</label>
                  <input
                    type="number"
                    name="overs"
                    min="1"
                    max="200"
                    value={formData.overs}
                    onChange={handleChange}
                    required
                    placeholder="Enter custom overs per innings"
                    className="ms-input text-base py-1.5 font-score tabular-nums font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Teams & Toss Card */}
        <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
          <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-black dark:text-white" />
            <span>Teams & Toss</span>
          </h2>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="ms-input-label text-xs">Team A</label>
                <input
                  type="text"
                  name="team_a_name"
                  value={formData.team_a_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Team A"
                  className="ms-input text-xs"
                />
              </div>

              <div>
                <label className="ms-input-label text-xs">Team B</label>
                <input
                  type="text"
                  name="team_b_name"
                  value={formData.team_b_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Team B"
                  className="ms-input text-xs"
                />
              </div>
            </div>

            {/* Toss Won By — Segmented Pill Selection */}
            <div className="space-y-1.5 pt-1">
              <label className="ms-input-label text-xs font-semibold">Toss Won By</label>
              <div className="ms-segmented">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, toss_winner: prev.team_a_name || 'Team A' }))}
                  className={`ms-segmented-item ${
                    formData.toss_winner !== (formData.team_b_name || 'Team B')
                      ? 'ms-segmented-item-active'
                      : ''
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" />
                  <span className="truncate">{formData.team_a_name || 'Team A'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, toss_winner: prev.team_b_name || 'Team B' }))}
                  className={`ms-segmented-item ${
                    formData.toss_winner === (formData.team_b_name || 'Team B')
                      ? 'ms-segmented-item-active'
                      : ''
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" />
                  <span className="truncate">{formData.team_b_name || 'Team B'}</span>
                </button>
              </div>
            </div>

            {/* Toss Decision — Segmented Pill Selection */}
            <div className="space-y-1.5">
              <label className="ms-input-label text-xs font-semibold">Toss Decision</label>
              <div className="ms-segmented">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, toss_decision: 'bat' }))}
                  className={`ms-segmented-item ${
                    formData.toss_decision !== 'bowl' ? 'ms-segmented-item-active' : ''
                  }`}
                >
                  <span>🏏 Bat First</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, toss_decision: 'bowl' }))}
                  className={`ms-segmented-item ${
                    formData.toss_decision === 'bowl' ? 'ms-segmented-item-active' : ''
                  }`}
                >
                  <span>⚾ Bowl First</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enter Players on the fly */}
        <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card">
          <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-black dark:text-white" />
            <span>Opening Players</span>
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="ms-input-label text-xs">Striker (*)</label>
                <input
                  type="text"
                  name="striker_name"
                  value={formData.striker_name}
                  onChange={handleChange}
                  required
                  className="ms-input text-xs uppercase"
                />
              </div>

              <div>
                <label className="ms-input-label text-xs">Non-Striker</label>
                <input
                  type="text"
                  name="non_striker_name"
                  value={formData.non_striker_name}
                  onChange={handleChange}
                  required
                  className="ms-input text-xs uppercase"
                />
              </div>
            </div>

            <div>
              <label className="ms-input-label text-xs">Bowler</label>
              <input
                type="text"
                name="opening_bowler_name"
                value={formData.opening_bowler_name}
                onChange={handleChange}
                required
                className="ms-input text-xs uppercase"
              />
            </div>
          </div>
        </div>

        {/* Start Match Button */}
        <button
          type="submit"
          disabled={loading}
          className="ms-btn ms-btn-primary w-full py-2.5 text-xs font-bold shadow-md shadow-cyan-900/30 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl active:scale-[0.98] transition-all"
        >
          <span>{loading ? 'Creating Match...' : 'Start Match'}</span>
          <ArrowRight className="w-4 h-4 text-black dark:text-white" />
        </button>
      </form>
    </div>
  );
}
