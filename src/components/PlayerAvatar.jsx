import React, { useState, useEffect } from 'react';
import { getPlayerInitials, getSignedPhotoUrl } from '../utils/photoService';
import { playerService } from '../services/playerService';

/**
 * Standardized Circular Player Avatar Component
 * - Automatically resolves photo path/URL via UUID, player_id, or player object
 * - Generates & caches signed URLs for private Supabase Storage
 * - Falls back to elegant initials avatar if photo is missing or fails to load
 * - Mobile and APK compatible with consistent circular sizing
 */
export default function PlayerAvatar({
  player = null, // { id, player_id, full_name, name, photo_url } or string (UUID / player_id / name)
  photoUrl = '', // optional explicit photo URL or path override
  name = '', // optional name fallback for initials
  playerId = '', // optional player ID fallback
  size = 'md', // 'xs' (24px) | 'sm' (28px) | 'md' (34px) | 'lg' (40px) | 'xl' (56px)
  className = '',
  showBorder = true,
  onClick = null
}) {
  const [imgUrl, setImgUrl] = useState('');
  const [imgError, setImgError] = useState(false);

  // Resolve player info from object or playerService cache
  let resolvedPlayer = typeof player === 'object' && player !== null ? { ...player } : null;

  // If player object is missing photo_url or id, enhance it from playerService cache
  if (resolvedPlayer && !resolvedPlayer.photo_url) {
    const cached = playerService.findPlayer(resolvedPlayer.id || resolvedPlayer.player_id || resolvedPlayer.name || resolvedPlayer.full_name);
    if (cached) {
      resolvedPlayer = {
        ...cached,
        ...resolvedPlayer,
        photo_url: cached.photo_url || null,
        id: resolvedPlayer.id || cached.id,
        player_id: resolvedPlayer.player_id || cached.player_id
      };
    }
  } else if (!resolvedPlayer && player) {
    resolvedPlayer = playerService.findPlayer(player);
  }

  const rawPhoto = photoUrl || resolvedPlayer?.photo_url || (typeof player === 'string' && player.startsWith('http') ? player : '');
  const playerName = resolvedPlayer?.full_name || resolvedPlayer?.name || name || (typeof player === 'string' ? player : 'Player');
  const initials = getPlayerInitials(playerName);

  // Resolve signed or public URL with in-memory caching
  useEffect(() => {
    let isMounted = true;
    setImgError(false);

    if (!rawPhoto) {
      setImgUrl('');
      return;
    }

    getSignedPhotoUrl(rawPhoto)
      .then((url) => {
        if (isMounted) {
          setImgUrl(url || '');
        }
      })
      .catch(() => {
        if (isMounted) {
          setImgUrl(rawPhoto);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [rawPhoto]);

  // Size mappings (32-36px for md, 38-42px for lg, 24px for xs)
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-[34px] h-[34px] text-xs',
    lg: 'w-10 h-10 text-xs',
    xl: 'w-14 h-14 text-base font-bold'
  }[size] || 'w-[34px] h-[34px] text-xs';

  const borderClass = showBorder && !className.includes('border-')
    ? 'border border-slate-200 dark:border-slate-700/80 shadow-2xs'
    : '';

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 select-none overflow-hidden ${sizeClasses} ${borderClass} ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform p-0 bg-transparent' : ''
      } ${className}`}
      title={playerName}
    >
      {imgUrl && !imgError ? (
        <img
          src={imgUrl}
          alt={playerName}
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-bold uppercase flex items-center justify-center">
          {initials}
        </div>
      )}
    </Component>
  );
}
