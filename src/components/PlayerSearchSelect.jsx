import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, AlertCircle, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { playerService } from '../services/playerService';
import PlayerAvatar from './PlayerAvatar';

/**
 * Standardized Searchable Player Selection Component
 * Capsule/Pill shaped search bar matching the exact MoonLight Strikers design specification.
 * - Displays circular photo inside search suggestions (32-36px) with Name and Player ID.
 * - Displays circular photo immediately to the left of the selected player's name.
 * - Dynamically filters out already selected players (UUID comparison).
 */
export default function PlayerSearchSelect({
  value, // { id, player_id, name } or string name
  selectedId, // optional explicit player ID (P001, etc.)
  onChange, // ({ id, player_id, name, full_name, photo_url } | null) => void
  placeholder = 'Search players by name or ID...',
  disabledPlayers = [], // list of player UUIDs, IDs, or names that cannot be selected
  required = false,
  className = '',
  autoFocus = false,
  id = ''
}) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [dropUp, setDropUp] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Load registered players on mount
  useEffect(() => {
    let isMounted = true;
    playerService.getPlayers().then((list) => {
      if (isMounted) {
        setAllPlayers(list || []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync with incoming value prop
  useEffect(() => {
    if (!value) {
      setSelectedPlayer(null);
      setQuery('');
      return;
    }

    const currentName = typeof value === 'object' ? (value.name || value.full_name) : value;
    const currentId = typeof value === 'object' ? (value.id || value.player_id) : selectedId;

    if (allPlayers.length > 0 && (currentName || currentId)) {
      const matched = allPlayers.find((p) => {
        if (currentId && (p.id === currentId || p.player_id === currentId)) return true;
        if (currentName && p.full_name?.trim().toLowerCase() === currentName.toString().trim().toLowerCase()) return true;
        return false;
      });

      if (matched) {
        setSelectedPlayer(matched);
        setQuery(matched.full_name.toUpperCase());
        return;
      }
    }

    if (currentName) {
      setQuery(currentName.toString().toUpperCase());
    }
  }, [value, selectedId, allPlayers]);

  // Dynamic dropup check when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  }, [isOpen]);

  // Handle click outside to close dropdown and enforce valid selection
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        if (selectedPlayer) {
          setQuery(selectedPlayer.full_name.toUpperCase());
        } else {
          setQuery('');
          if (onChange) onChange(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPlayer, onChange]);

  const handleInputChange = (e) => {
    const text = (e.target.value || '').toUpperCase();
    setQuery(text);
    setHasInteracted(true);
    setIsOpen(true);

    // Strict Rule: Clear selection if user types/changes text after selecting
    if (selectedPlayer && selectedPlayer.full_name.toUpperCase() !== text.trim()) {
      setSelectedPlayer(null);
      if (onChange) onChange(null);
    }
  };

  const handleSelect = (player) => {
    const upperName = (player.full_name || '').toUpperCase();
    const updated = { ...player, full_name: upperName };
    setSelectedPlayer(updated);
    setQuery(upperName);
    setIsOpen(false);
    setHasInteracted(true);
    if (onChange) {
      onChange({
        id: player.id,
        player_id: player.player_id,
        name: upperName,
        full_name: upperName,
        photo_url: player.photo_url || null
      });
    }
  };

  const handleClear = () => {
    setSelectedPlayer(null);
    setQuery('');
    setIsOpen(false);
    if (onChange) onChange(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const isPlayerDisabled = (player) => {
    return disabledPlayers.some((d) => {
      if (!d) return false;
      const dName = typeof d === 'object' ? (d.name || d.full_name) : d;
      const dId = typeof d === 'object' ? (d.id || d.player_id) : d;
      return (
        (dId && (player.id === dId || player.player_id === dId)) ||
        (dName && player.full_name?.trim().toLowerCase() === dName.toString().trim().toLowerCase())
      );
    });
  };

  // Filter registered players based on search query (name or player_id) AND exclude disabled/already chosen players
  const trimmedQuery = query.trim().toLowerCase();
  const suggestions = allPlayers.filter((p) => {
    // 1. Dynamic filtering: Exclude players already selected in another field
    if (isPlayerDisabled(p)) {
      return false;
    }
    // 2. Query filter
    if (!trimmedQuery) return true;
    const nameMatch = (p.full_name || '').toLowerCase().includes(trimmedQuery);
    const idMatch = (p.player_id || '').toLowerCase().includes(trimmedQuery);
    return nameMatch || idMatch;
  });

  const isInvalid = required && hasInteracted && !selectedPlayer;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Standardized Capsule Search Input Container */}
      <div
        className={`relative flex items-center w-full rounded-full border transition-all ${
          selectedPlayer
            ? 'border-cyan-500 shadow-sm shadow-cyan-500/10'
            : isInvalid
            ? 'border-rose-500 shadow-sm shadow-rose-500/10'
            : 'border-cyan-500 dark:border-cyan-500/80 hover:border-cyan-400 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20'
        } bg-white dark:bg-[#0b1329]`}
      >
        {/* Left: Selected Player Avatar OR Search Icon */}
        {selectedPlayer ? (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex-shrink-0 z-10 pointer-events-none">
            <PlayerAvatar
              player={selectedPlayer}
              size="sm"
              className="border border-cyan-500/40"
            />
          </div>
        ) : (
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0" />
        )}

        {/* Search Input Field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full ${
            selectedPlayer ? 'pl-12 font-bold' : 'pl-11'
          } pr-16 py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:normal-case placeholder:font-normal focus:outline-none`}
        />

        {/* Right Action: Selected player ID badge and/or Clear button */}
        <div className="absolute right-3 flex items-center gap-1.5">
          {selectedPlayer ? (
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
                <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>{selectedPlayer.player_id}</span>
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[9999] ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          } bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-cyan-500/40 rounded-2xl shadow-2xl max-h-60 overflow-y-auto animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800/60`}
        >
          {suggestions.length > 0 ? (
            suggestions.map((player) => {
              const isCurrent = selectedPlayer?.player_id === player.player_id;

              return (
                <button
                  key={player.id || player.player_id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur before click
                    handleSelect(player);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-100/90 dark:bg-cyan-500/25 border-l-4 border-l-cyan-600 dark:border-l-cyan-400 font-bold text-cyan-950 dark:text-cyan-100 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-cyan-500/10 text-slate-900 dark:text-slate-200 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {/* Photo on left (32-36px), Name beside photo, Player ID below */}
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      player={player}
                      size="md"
                      className="border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-xs sm:text-sm uppercase tracking-tight text-slate-900 dark:text-white">
                        {player.full_name}
                      </span>
                      <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
                        {player.player_id}
                      </span>
                    </div>
                  </div>

                  {isCurrent && (
                    <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                  )}
                </button>
              );
            })
          ) : (
            /* No Player Found Message */
            <div className="p-4 text-center">
              <AlertCircle className="w-6 h-6 text-amber-500 dark:text-amber-400 mx-auto mb-1.5 opacity-90" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {query ? `No player found matching "${query}"` : 'No available players'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-2">
                Add this player from Players Management to register them.
              </p>
              <Link
                to="/players"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 underline"
              >
                <span>Go to Players Management</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Validation Message if unselected on blur */}
      {isInvalid && (
        <div className="text-[10px] font-semibold text-rose-400 mt-1.5 ml-3 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>Please select a registered player from the suggestions</span>
        </div>
      )}
    </div>
  );
}
