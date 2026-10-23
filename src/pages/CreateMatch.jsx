import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../services/matchService';
import { Trophy, Shield, User, ArrowRight, Sparkles } from 'lucide-react';

export default function CreateMatch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    venue: '',
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
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
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

      const newMatchData = {
        title: formData.title || 'Saturday Night Match',
        venue: formData.venue || 'Oval Ground',
        ball_type: formData.ball_type || 'Tennis Ball',
        match_type: 'tennis_ball',
        overs: Number(formData.overs) || 20,
        max_overs_per_bowler: Number(formData.max_overs_per_bowler) || 4,
        team_a_name: formData.team_a_name || 'Team A',
        team_b_name: formData.team_b_name || 'Team B',
        toss_winner: formData.toss_winner || formData.team_a_name || 'Team A',
        toss_decision: formData.toss_decision,
        current_batting_team: battingFirst,
        current_bowling_team: bowlingFirst,
        current_over_deliveries: [],
        recent_balls: [],
        striker: {
          name: formData.striker_name?.trim() || 'Striker',
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        non_striker: {
          name: formData.non_striker_name?.trim() || 'Non-Striker',
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          notOut: true
        },
        bowler: {
          name: formData.opening_bowler_name?.trim() || 'Opening Bowler',
          overs: '0.0',
          maidens: 0,
          runs: 0,
          wickets: 0,
          economy: '0.00'
        },
        innings_data: [
          {
            innings_number: 1,
            team_name: battingFirst,
            runs: 0,
            wickets: 0,
            overs: '0.0',
            batters: [
              { name: formData.striker_name?.trim() || 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true },
              { name: formData.non_striker_name?.trim() || 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true }
            ],
            bowlers: [
              { name: formData.opening_bowler_name?.trim() || 'Opening Bowler', overs: '0.0', maidens: 0, runs: 0, wickets: 0, economy: '0.00' }
            ],
            extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 }
          }
        ]
      };

      const created = await matchService.createMatch(newMatchData);
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
          <h1 className="text-xl font-bold text-ms-text-primary tracking-tight">
            Create Match
          </h1>
          <p className="text-xs text-ms-text-secondary">
            Set up teams and opening players to start live scoring
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
        {/* Match Overs Card */}
        <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
          <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Match Overs</span>
          </h2>

          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {[6, 8, 10, 12, 20, 25].map((ov) => (
                <button
                  key={ov}
                  type="button"
                  onClick={() => handleOversPreset(ov)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center truncate ${
                    Number(formData.overs) === ov
                      ? 'bg-ms-cyan text-ms-text-inverse border-ms-cyan shadow-sm'
                      : 'bg-ms-bg-input border-ms-border text-ms-text-secondary hover:text-ms-text-primary hover:border-ms-border-light'
                  }`}
                >
                  {ov} Overs
                </button>
              ))}
            </div>
            <div className="pt-1">
              <label className="ms-input-label text-[11px]">Or custom overs</label>
              <input
                type="number"
                name="overs"
                min="1"
                max="50"
                value={formData.overs}
                onChange={handleChange}
                required
                className="ms-input text-xs py-1.5"
              />
            </div>
          </div>
        </div>

        {/* Teams & Toss Card */}
        <div className="ms-card p-3.5 border-ms-border-light bg-ms-bg-card shadow-sm">
          <h2 className="text-xs font-bold text-ms-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
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
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
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
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
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
            <User className="w-3.5 h-3.5" />
            <span>Opening Players (Editable anytime while playing)</span>
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="ms-input-label text-xs">Opening Striker (*)</label>
                <input
                  type="text"
                  name="striker_name"
                  value={formData.striker_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Batter 1"
                  className="ms-input text-xs"
                />
              </div>

              <div>
                <label className="ms-input-label text-xs">Opening Non-Striker</label>
                <input
                  type="text"
                  name="non_striker_name"
                  value={formData.non_striker_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Batter 2"
                  className="ms-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="ms-input-label text-xs">Opening Bowler</label>
              <input
                type="text"
                name="opening_bowler_name"
                value={formData.opening_bowler_name}
                onChange={handleChange}
                required
                placeholder="e.g. Bowler 1"
                className="ms-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Start Match Button */}
        <button
          type="submit"
          disabled={loading}
          className="ms-btn ms-btn-primary w-full py-2.5 text-xs font-bold shadow-md shadow-cyan-900/30 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl"
        >
          <span>{loading ? 'Creating Match...' : 'Start Match & Open Scoring Pad'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
