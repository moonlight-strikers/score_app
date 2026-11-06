import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  Camera,
  Trash2,
  Loader2
} from 'lucide-react';
import { playerService } from '../services/playerService';
import { useLanguage } from '../contexts/LanguageContext';
import {
  pickImageFromDevice,
  processAndResizeImage,
  uploadPlayerPhoto,
  cleanupOldPhoto,
  getPlayerInitials,
  getSignedPhotoUrl
} from '../utils/photoService';
import PlayerAvatar from '../components/PlayerAvatar';
import { useAdmin } from '../contexts/AdminContext';
import ConfirmModal from '../components/ConfirmModal';

export default function Players() {
  const { t } = useLanguage();
  const { isAdmin, adminToken } = useAdmin();

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 3-dot Action Menu state
  const [openMenuPlayerId, setOpenMenuPlayerId] = useState(null);

  // In-app delete player state
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [deletePlayerError, setDeletePlayerError] = useState(null);

  // Add / Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Photo management state
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedBlob, setSelectedBlob] = useState(null);
  const [photoAction, setPhotoAction] = useState('keep'); // 'keep' | 'update' | 'remove'
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Photo Zoom / Preview Modal state
  const [zoomedPlayer, setZoomedPlayer] = useState(null);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState('');

  useEffect(() => {
    if (zoomedPlayer?.photo_url) {
      getSignedPhotoUrl(zoomedPlayer.photo_url)
        .then((url) => setZoomedPhotoUrl(url || zoomedPlayer.photo_url))
        .catch(() => setZoomedPhotoUrl(zoomedPlayer.photo_url));
    } else {
      setZoomedPhotoUrl('');
    }
  }, [zoomedPlayer]);

  useEffect(() => {
    loadPlayers();
  }, []);

  // Close zoom modal on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && zoomedPlayer) {
        setZoomedPlayer(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedPlayer]);

  // Close action 3-dot menu on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openMenuPlayerId && !event.target.closest('.action-menu-container')) {
        setOpenMenuPlayerId(null);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuPlayerId]);

  async function loadPlayers() {
    setLoading(true);
    try {
      const data = await playerService.getPlayers();
      setPlayers(data || []);
    } catch (err) {
      console.error('Failed to load players:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenAddModal = () => {
    setOpenMenuPlayerId(null);
    setModalMode('add');
    setTargetPlayer(null);
    setPlayerNameInput('');
    setPhotoPreview(null);
    setSelectedBlob(null);
    setPhotoAction('keep');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (player) => {
    setOpenMenuPlayerId(null);
    setModalMode('edit');
    setTargetPlayer(player);
    setPlayerNameInput((player.full_name || player.name || '').toUpperCase());
    setPhotoPreview(player.photo_url || null);
    setSelectedBlob(null);
    setPhotoAction('keep');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTargetPlayer(null);
    setPlayerNameInput('');
    setPhotoPreview(null);
    setSelectedBlob(null);
    setPhotoAction('keep');
    setModalError('');
  };

  const handlePickPhoto = async () => {
    setModalError('');
    setIsProcessingPhoto(true);
    try {
      const rawImage = await pickImageFromDevice();
      if (!rawImage) {
        setIsProcessingPhoto(false);
        return;
      }

      const { blob, previewUrl } = await processAndResizeImage(rawImage, 300, 300, 0.88);
      setSelectedBlob(blob);
      setPhotoPreview(previewUrl);
      setPhotoAction('update');
    } catch (err) {
      console.error('Photo selection or processing error:', err);
      setModalError(err.message || 'Failed to select image. Please try again.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedBlob(null);
    setPhotoPreview(null);
    setPhotoAction('remove');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const trimmed = playerNameInput.trim().toUpperCase();
    if (!trimmed) {
      setModalError('Please enter a player name');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      if (modalMode === 'add') {
        let uploadedUrl = null;
        if (photoAction === 'update' && selectedBlob) {
          // Upload photo first using timestamped identifier
          uploadedUrl = await uploadPlayerPhoto(
            `player_${Date.now()}`,
            selectedBlob,
            null
          );
        }
        await playerService.addPlayer(trimmed, uploadedUrl, adminToken);
      } else if (modalMode === 'edit' && targetPlayer) {
        if (photoAction === 'update' && selectedBlob) {
          // Upload new photo and cleanup old one
          const uploadedUrl = await uploadPlayerPhoto(
            targetPlayer.player_id || targetPlayer.id,
            selectedBlob,
            targetPlayer.photo_url
          );
          await playerService.updatePlayer(targetPlayer.id, trimmed, uploadedUrl);
        } else if (photoAction === 'remove') {
          // Remove photo reference and cleanup storage
          if (targetPlayer.photo_url) {
            await cleanupOldPhoto(targetPlayer.photo_url);
          }
          await playerService.updatePlayer(targetPlayer.id, trimmed, null);
        } else {
          // Keep existing photo, update name only
          await playerService.updatePlayer(targetPlayer.id, trimmed);
        }
      }

      handleCloseModal();
      await loadPlayers();
    } catch (err) {
      console.error('Failed to save player:', err);
      setModalError(err.message || 'Failed to save player. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlayer = (player) => {
    setOpenMenuPlayerId(null);
    setDeletePlayerError(null);
    setPlayerToDelete(player);
  };

  const handleConfirmDeletePlayer = async () => {
    if (!playerToDelete) return;
    setDeletingPlayer(true);
    setDeletePlayerError(null);
    try {
      if (playerToDelete.photo_url) {
        await cleanupOldPhoto(playerToDelete.photo_url);
      }
      await playerService.deletePlayer(playerToDelete.id, adminToken);
      await loadPlayers();
      setPlayerToDelete(null);
    } catch (err) {
      console.error('Failed to delete player:', err);
      setDeletePlayerError(err.message || 'Failed to delete player.');
    } finally {
      setDeletingPlayer(false);
    }
  };

  // Filter players by name or player_id
  const filteredPlayers = players.filter((player) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const nameMatch = (player.full_name || player.name || '').toLowerCase().includes(q);
    const idMatch = (player.player_id || '').toLowerCase().includes(q);
    return nameMatch || idMatch;
  });

  return (
    <div className="ms-page pb-12 max-w-[1000px] mx-auto px-4 md:px-6 pt-4">
      {/* Search Bar & Add Player (Admin) */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 flex items-center w-full rounded-full border border-cyan-500 dark:border-cyan-500/80 bg-white dark:bg-[#0b1329] shadow-xs focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('players.searchPlaceholder') || 'Search players by name...'}
            className="w-full pl-11 pr-10 py-2.5 text-xs sm:text-sm font-semibold rounded-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="ms-btn ms-btn-primary ms-btn-sm flex-shrink-0 cursor-pointer"
            title="Add Player"
          >
            <UserPlus />
            <span className="hidden sm:inline">{t('players.addPlayer') || 'Add Player'}</span>
          </button>
        )}
      </div>

      {/* Total Registered Player Count (Placed below search bar and immediately above Players table) */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs sm:text-sm font-semibold text-ms-cyan flex items-center gap-1.5">
          <span className="font-bold tabular-nums font-score text-sm sm:text-base text-ms-cyan">
            {players.length}
          </span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            Registered Players
          </span>
        </span>
      </div>

      {/* Players Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-ms-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">{t('common.loading') || 'Loading players...'}</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-30" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              {searchQuery ? 'No matching players found' : 'No registered players yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-ms-text-muted mb-4 max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different search query or add a new player to the squad.'
                : 'Click Add Player above to register your first team player.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="ms-btn ms-btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5"
              >
                <UserPlus className="w-4 h-4 text-black dark:text-white" />
                <span>Add Player</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-ms-border bg-slate-100/80 dark:bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                  {/* Column 1: Player ID */}
                  <th scope="col" className="py-3.5 px-4 sm:px-6 w-28 sm:w-32">
                    Player ID
                  </th>
                  {/* Column 2: Player Photo */}
                  <th scope="col" className="py-3.5 px-3 sm:px-4 w-20 text-center">
                    Photo
                  </th>
                  {/* Column 3: Player Name */}
                  <th scope="col" className="py-3.5 px-4 sm:px-6">
                    Player Name
                  </th>
                  {/* Column 4: Actions */}
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right w-24 sm:w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-ms-border/60 text-xs sm:text-sm">
                {filteredPlayers.map((player) => (
                  <tr
                    key={player.id || player.player_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* 1. Player ID */}
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-cyan-600 dark:text-ms-cyan align-middle">
                      {player.player_id}
                    </td>

                    {/* 2. Player Photo (Circular 38-42px with fallback avatar & click-to-zoom) */}
                    <td className="py-3 px-3 sm:px-4 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <PlayerAvatar
                          player={player}
                          size="lg"
                          onClick={() => setZoomedPlayer(player)}
                          className="hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                      </div>
                    </td>

                    {/* 3. Player Name - ALWAYS IN CAPS */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold tracking-wide text-black dark:text-white uppercase align-middle">
                      {(player.full_name || player.name || '').toUpperCase()}
                    </td>

                    {/* 4. Actions: Three-Dot Menu (ONLY Edit) */}
                    <td className="py-3.5 px-4 sm:px-6 text-right relative align-middle">
                      <div className="relative inline-block text-left action-menu-container">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuPlayerId(openMenuPlayerId === player.id ? null : player.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Floating Action Menu */}
                        {openMenuPlayerId === player.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-32 z-50 bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 animate-fadeIn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(player)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                              <span>Edit</span>
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeletePlayer(player)}
                                className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors mt-0.5 border-t border-slate-100 dark:border-slate-800"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Player Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-ms-border rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-ms-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-600 dark:text-ms-cyan" />
                <h3 className="text-sm font-bold text-black dark:text-white">
                  {modalMode === 'add' ? 'Add Player' : 'Edit Player'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Player ID info (if editing) */}
              {modalMode === 'edit' && targetPlayer && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-slate-400 mb-1">
                    Player ID
                  </label>
                  <div className="px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-ms-border font-mono font-bold text-cyan-700 dark:text-ms-cyan">
                    {targetPlayer.player_id}
                  </div>
                </div>
              )}

              {/* Player Photo Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black dark:text-slate-200">
                  Player Photo
                </label>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-ms-border">
                  {/* Photo Preview Circle */}
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500/40 bg-slate-200 dark:bg-slate-800 shadow-inner flex items-center justify-center">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold text-base uppercase flex items-center justify-center select-none">
                          {getPlayerInitials(playerNameInput || (targetPlayer?.full_name ?? 'Player'))}
                        </div>
                      )}
                    </div>
                    {isProcessingPhoto && (
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Upload & Remove Buttons */}
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      JPG, PNG, WebP (max 5MB). Resized to 300×300.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePickPhoto}
                        disabled={isProcessingPhoto || submitting}
                        className="ms-btn ms-btn-outline ms-btn-sm cursor-pointer disabled:opacity-50"
                      >
                        <Camera />
                        <span>{photoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>

                      {photoPreview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          disabled={isProcessingPhoto || submitting}
                          className="ms-btn ms-btn-danger ms-btn-sm cursor-pointer disabled:opacity-50"
                          title="Remove photo"
                        >
                          <Trash2 />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Name */}
              <div>
                <label className="block text-xs font-bold text-black dark:text-slate-200 mb-1.5">
                  Player Name *
                </label>
                <input
                  type="text"
                  value={playerNameInput}
                  onChange={(e) => {
                    setPlayerNameInput(e.target.value.toUpperCase());
                    if (modalError) setModalError('');
                  }}
                  placeholder="Enter player name (e.g. Ashok)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-ms-border text-black dark:text-white placeholder-slate-400 font-bold uppercase focus:outline-none focus:border-cyan-500 tracking-wide"
                  autoFocus={modalMode === 'add'}
                  required
                />
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-1">
                  Unique player name. Duplicate names are not permitted.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-ms-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="ms-btn ms-btn-outline ms-btn-sm cursor-pointer"
                >
                  <X />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting || isProcessingPhoto || !playerNameInput.trim()}
                  className="ms-btn ms-btn-primary ms-btn-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check />
                      <span>{modalMode === 'add' ? 'Save Player' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Zoom / Large Preview Modal */}
      {zoomedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xs animate-fadeIn"
          onClick={() => setZoomedPlayer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-[92vw] max-h-[85vh] sm:max-w-md w-full flex flex-col items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-ms-border rounded-2xl shadow-2xl p-4 sm:p-5 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-ms-border">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-mono font-bold text-xs text-cyan-600 dark:text-ms-cyan px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                  {zoomedPlayer.player_id}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white uppercase truncate tracking-wide">
                  {(zoomedPlayer.full_name || zoomedPlayer.name || 'Player').toUpperCase()}
                </h3>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setZoomedPlayer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close preview (Esc)"
                aria-label="Close photo preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Container with object-contain */}
            <div className="w-full flex items-center justify-center min-h-[220px] max-h-[60vh] overflow-hidden rounded-xl bg-slate-100 dark:bg-black/40">
              {zoomedPhotoUrl ? (
                <img
                  src={zoomedPhotoUrl}
                  alt={zoomedPlayer.full_name || 'Player profile'}
                  className="w-full max-h-[60vh] object-contain rounded-xl select-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.zoom-fallback');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`zoom-fallback w-32 h-32 rounded-full bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-700 dark:text-cyan-400 font-bold text-3xl uppercase flex items-center justify-center select-none shadow-inner my-6 ${zoomedPhotoUrl ? 'hidden' : 'flex'}`}
              >
                {getPlayerInitials(zoomedPlayer.full_name || zoomedPlayer.name)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Player Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(playerToDelete)}
        onClose={() => {
          if (!deletingPlayer) {
            setPlayerToDelete(null);
            setDeletePlayerError(null);
          }
        }}
        onConfirm={handleConfirmDeletePlayer}
        title="Delete Player?"
        message={
          playerToDelete ? (
            <span>
              Are you sure you want to delete player{' '}
              <strong className="text-ms-text-primary">
                "{(playerToDelete.full_name || playerToDelete.name || '').toUpperCase()}"
              </strong>
              ? This cannot be undone.
            </span>
          ) : (
            'This action cannot be undone.'
          )
        }
        confirmText="Delete Player"
        cancelText="Cancel"
        isDestructive={true}
        loading={deletingPlayer}
        error={deletePlayerError}
      />
    </div>
  );
}
