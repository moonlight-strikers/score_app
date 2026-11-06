import { supabase, isSupabaseConfigured } from './supabase.js';
import { matchService } from './matchService.js';

const LOCAL_STORAGE_KEY = 'ms_registered_players';
let inMemoryPlayersCache = null;

function getSafeStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function savePlayersList(list) {
  inMemoryPlayersCache = list;
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }
}

// Initial default registered squad for MoonLight Strikers if no database/storage records exist yet
const INITIAL_REGISTERED_PLAYERS = [
  { player_id: 'P001', full_name: 'ASHOK' },
  { player_id: 'P002', full_name: 'ROHIT' },
  { player_id: 'P003', full_name: 'BUMRAH' },
  { player_id: 'P004', full_name: 'KRISHNA' },
  { player_id: 'P005', full_name: 'GOPI' },
  { player_id: 'P006', full_name: 'ARUN' },
  { player_id: 'P007', full_name: 'DINESH' },
  { player_id: 'P008', full_name: 'AAKASH' },
  { player_id: 'P009', full_name: 'VIKRAM' },
  { player_id: 'P010', full_name: 'HARISH' },
  { player_id: 'P011', full_name: 'RAMESH' },
  { player_id: 'P012', full_name: 'MANOJ' }
];

/**
 * Generate next sequential Player ID (P001, P002, ...)
 */
function calculateNextPlayerId(players = []) {
  let maxNum = 0;
  players.forEach((p) => {
    const code = p.player_id || '';
    const match = code.match(/^P(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  return `P${String(nextNum).padStart(3, '0')}`;
}

export const playerService = {
  /**
   * Get all registered players
   */
  async getPlayers() {
    let players = [];

    // 1. Try querying Supabase
    if (isSupabaseConfigured) {
      try {
        let { data, error } = await supabase
          .from('players')
          .select('id, player_id, full_name, name, photo_url, is_active, created_at')
          .order('player_id', { ascending: true });

        // If photo_url column is not yet added in Supabase (error 42703), retry without it
        if (error && error.code === '42703') {
          const retry = await supabase
            .from('players')
            .select('id, player_id, full_name, name, is_active, created_at')
            .order('player_id', { ascending: true });
          data = retry.data;
          error = retry.error;
        }

        if (!error && Array.isArray(data) && data.length > 0) {
          players = data.map((p, idx) => ({
            id: p.id || `p_${p.player_id || idx}`,
            player_id: p.player_id || `P${String(idx + 1).padStart(3, '0')}`,
            full_name: (p.full_name || p.name || '').trim().toUpperCase(),
            photo_url: p.photo_url || null,
            is_active: p.is_active !== false,
            created_at: p.created_at || new Date().toISOString()
          }));
        }
      } catch (err) {
        console.warn('Could not read players from Supabase, checking local storage:', err);
      }
    }

    // 2. Fall back to localStorage / in-memory cache
    if (!players || players.length === 0) {
      const storage = getSafeStorage();
      if (storage) {
        try {
          const raw = storage.getItem(LOCAL_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              players = parsed.map(p => ({
                ...p,
                full_name: (p.full_name || p.name || '').trim().toUpperCase(),
                photo_url: p.photo_url || null
              }));
            }
          }
        } catch (err) {
          console.warn('Error reading players from localStorage:', err);
        }
      } else if (inMemoryPlayersCache && inMemoryPlayersCache.length > 0) {
        players = inMemoryPlayersCache.map(p => ({
          ...p,
          full_name: (p.full_name || p.name || '').trim().toUpperCase(),
          photo_url: p.photo_url || null
        }));
      }
    }

    // 3. If still empty, seed from existing match records or initial defaults
    if (!players || players.length === 0) {
      players = await this.seedInitialPlayers();
    }

    // Ensure all players have sequential player_id, uppercase names, and valid format
    const copy = players.map(p => ({
      ...p,
      full_name: (p.full_name || p.name || '').trim().toUpperCase(),
      photo_url: p.photo_url || null
    }));
    copy.sort((a, b) => {
      const numA = parseInt((a.player_id || '').replace(/\D/g, '') || '0', 10);
      const numB = parseInt((b.player_id || '').replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });

    return copy;
  },

  /**
   * Seed players if empty
   */
  async seedInitialPlayers() {
    const discovered = new Set();

    try {
      const matches = await matchService.getMatches();
      (matches || []).forEach((m) => {
        (m.innings_data || []).forEach((inn) => {
          (inn.batters || []).forEach((b) => {
            if (b?.name && typeof b.name === 'string' && b.name.trim()) {
              discovered.add(b.name.trim().toUpperCase());
            }
          });
          (inn.bowlers || []).forEach((bw) => {
            if (bw?.name && typeof bw.name === 'string' && bw.name.trim()) {
              discovered.add(bw.name.trim().toUpperCase());
            }
          });
        });
      });
    } catch (e) {
      console.warn('Could not read matches for seeding players:', e);
    }

    let namesList = [];
    if (discovered.size > 0) {
      discovered.forEach((n) => namesList.push(n.toUpperCase()));
    } else {
      namesList = INITIAL_REGISTERED_PLAYERS.map((p) => p.full_name.toUpperCase());
    }

    const seeded = namesList.map((name, idx) => ({
      id: `p_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      player_id: `P${String(idx + 1).padStart(3, '0')}`,
      full_name: name.toUpperCase(),
      photo_url: null,
      is_active: true,
      created_at: new Date().toISOString()
    }));

    savePlayersList(seeded);

    // Attempt saving to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from('players').upsert(
          seeded.map((p) => ({
            id: p.id,
            player_id: p.player_id,
            full_name: p.full_name,
            name: p.full_name,
            is_active: true
          }))
        );
      } catch (e) {
        // Ignored if table not migrated in Supabase
      }
    }

    return seeded;
  },

  /**
   * Add a new registered player with duplicate prevention (Admin authorized)
   */
  async addPlayer(playerName, photoUrl = null, adminToken = null) {
    const trimmed = (playerName || '').trim().toUpperCase();
    if (!trimmed) {
      throw new Error('Player name cannot be empty');
    }

    const currentList = await this.getPlayers();

    // Check duplicate (case-insensitive & whitespace trimmed)
    const normalizedInput = trimmed.toLowerCase();
    const existing = currentList.find(
      (p) => (p.full_name || '').trim().toLowerCase() === normalizedInput
    );
    if (existing) {
      throw new Error(`Player "${trimmed}" is already registered with ID ${existing.player_id}`);
    }

    const nextId = calculateNextPlayerId(currentList);
    const newPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      player_id: nextId,
      full_name: trimmed,
      photo_url: photoUrl || null,
      is_active: true,
      created_at: new Date().toISOString()
    };

    currentList.push(newPlayer);
    savePlayersList(currentList);

    if (isSupabaseConfigured) {
      try {
        if (adminToken) {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_add_player', {
            p_token: adminToken,
            p_player_id: newPlayer.player_id,
            p_full_name: newPlayer.full_name,
            p_photo_url: photoUrl || null
          });

          if (!rpcErr && rpcData?.id) {
            newPlayer.id = rpcData.id;
            return newPlayer;
          }
        }

        // Direct insert fallback
        const insertPayload = {
          id: newPlayer.id,
          player_id: newPlayer.player_id,
          full_name: newPlayer.full_name,
          name: newPlayer.full_name,
          is_active: true
        };
        if (photoUrl) {
          insertPayload.photo_url = photoUrl;
        }
        const { error } = await supabase.from('players').insert([insertPayload]);
        if (error && error.code === '42703' && photoUrl) {
          // Retry without photo_url if column not added yet
          delete insertPayload.photo_url;
          await supabase.from('players').insert([insertPayload]);
        }
      } catch (err) {
        console.warn('Supabase player insert skipped/failed:', err);
      }
    }

    return newPlayer;
  },

  /**
   * Edit existing player name and photo (keeps player_id and id unchanged)
   */
  async updatePlayer(id, newName, photoUrl) {
    const trimmed = (newName || '').trim().toUpperCase();
    if (!trimmed) {
      throw new Error('Player name cannot be empty');
    }

    const currentList = await this.getPlayers();
    const targetIndex = currentList.findIndex((p) => p.id === id || p.player_id === id);
    if (targetIndex === -1) {
      throw new Error('Player not found');
    }

    // Check duplicate among OTHER players
    const normalizedInput = trimmed.toLowerCase();
    const duplicate = currentList.find(
      (p, idx) =>
        idx !== targetIndex &&
        (p.full_name || '').trim().toLowerCase() === normalizedInput
    );
    if (duplicate) {
      throw new Error(`Another player with name "${trimmed}" already exists (${duplicate.player_id})`);
    }

    const currentPhoto = currentList[targetIndex].photo_url || null;
    const finalPhoto = photoUrl !== undefined ? photoUrl : currentPhoto;

    const updated = {
      ...currentList[targetIndex],
      full_name: trimmed,
      photo_url: finalPhoto,
      updated_at: new Date().toISOString()
    };
    currentList[targetIndex] = updated;
    savePlayersList(currentList);

    if (isSupabaseConfigured) {
      try {
        const updatePayload = {
          full_name: trimmed,
          name: trimmed,
          updated_at: new Date().toISOString()
        };
        if (photoUrl !== undefined) {
          updatePayload.photo_url = photoUrl;
        }

        const { error } = await supabase
          .from('players')
          .update(updatePayload)
          .eq('id', updated.id);

        if (error && error.code === '42703' && photoUrl !== undefined) {
          // Column not yet added, update without photo_url
          await supabase
            .from('players')
            .update({
              full_name: trimmed,
              name: trimmed,
              updated_at: new Date().toISOString()
            })
            .eq('id', updated.id);
        }
      } catch (err) {
        console.warn('Supabase player update skipped/failed:', err);
      }
    }

    return updated;
  },

  /**
   * Delete player with admin session authorization.
   */
  async deletePlayer(playerId, adminToken = null) {
    if (!playerId) {
      throw new Error('Player ID is required for deletion');
    }

    const currentList = await this.getPlayers();
    const filtered = currentList.filter((p) => p.id !== playerId && p.player_id !== playerId);
    savePlayersList(filtered);

    if (isSupabaseConfigured) {
      if (adminToken) {
        const { error: rpcErr } = await supabase.rpc('admin_delete_player', {
          p_token: adminToken,
          p_player_id: playerId,
        });

        if (rpcErr) {
          console.warn('admin_delete_player RPC note:', rpcErr);
          const { error: delErr } = await supabase
            .from('players')
            .delete()
            .or(`id.eq.${playerId},player_id.eq.${playerId}`);

          if (delErr && delErr.code === '42501') {
            throw new Error('Unauthorized: Admin authorization required to delete players.');
          } else if (delErr) {
            throw new Error(rpcErr.message || delErr.message || 'Failed to delete player from database');
          }
        }
      } else {
        throw new Error('Unauthorized: Admin authorization is required to delete players.');
      }
    }

    return true;
  },

  /**
   * Synchronously get currently cached players
   */
  getCachedPlayers() {
    if (inMemoryPlayersCache && inMemoryPlayersCache.length > 0) {
      return inMemoryPlayersCache;
    }
    const storage = getSafeStorage();
    if (storage) {
      try {
        const raw = storage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryPlayersCache = parsed;
            return parsed;
          }
        }
      } catch (err) {}
    }
    return INITIAL_REGISTERED_PLAYERS.map((p, idx) => ({
      id: `p_p${String(idx + 1).padStart(3, '0')}`,
      player_id: p.player_id,
      full_name: p.full_name,
      photo_url: null,
      is_active: true
    }));
  },

  /**
   * Find player by UUID, player_id, or full name from cache
   */
  findPlayer(query) {
    if (!query) return null;
    const list = this.getCachedPlayers();
    const q = String(query).trim().toLowerCase();
    return list.find((p) =>
      p.id?.toLowerCase() === q ||
      p.player_id?.toLowerCase() === q ||
      p.full_name?.trim().toLowerCase() === q ||
      p.name?.trim().toLowerCase() === q
    ) || null;
  }
};

