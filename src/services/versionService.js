import { App } from '@capacitor/app';
import { supabase, isSupabaseConfigured, APP_VERSION } from './supabase.js';
import { compareSemver, isVersionSupported } from '../utils/semver.js';

export const DEFAULT_UPDATE_CONFIG = {
  latestVersion: '2.0.0',
  minSupportedVersion: '2.0.0',
  forceUpdate: true,
  updateUrl: 'https://github.com/moonlight-strikers/cricket-scoring-app/releases/latest'
};

/**
 * Retrieves the actual installed Android application version via Capacitor App plugin.
 * Falls back to bundled package version (2.0.0) when running in Web/development mode.
 */
export async function getInstalledAppVersion() {
  try {
    const info = await App.getInfo();
    if (info && info.version) {
      return info.version.trim();
    }
  } catch (err) {
    console.warn('Capacitor App.getInfo() not available or failed:', err);
  }
  return APP_VERSION || '2.0.0';
}

/**
 * Lightweight connectivity ping to verify if Supabase server is reachable.
 * Returns true if server responded (any HTTP status), false on network error/timeout.
 */
export async function pingSupabaseConnection() {
  if (!isSupabaseConfigured) return false;
  try {
    const { error, status } = await supabase
      .from('players')
      .select('id')
      .limit(1);

    // If HTTP status is returned (200, 401, 403, 404), the server was reached
    if (status && status >= 200 && status < 500) {
      return true;
    }
    return !error;
  } catch (err) {
    console.warn('Supabase connectivity check failed:', err);
    return false;
  }
}

/**
 * Fetches centralized version configuration from Supabase.
 * Priority order:
 * 1. RPC get_app_version_config()
 * 2. Public view app_version
 * 3. Baseline 2.0.0 configuration (if Supabase is reachable but migration 010 is not yet applied)
 * 4. Network error thrown if Supabase is completely unreachable
 */
export async function fetchRemoteVersionConfig() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }

  // 1. Attempt RPC get_app_version_config
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_app_version_config');
    if (!rpcError && rpcData) {
      return {
        latestVersion: rpcData.latest_version || DEFAULT_UPDATE_CONFIG.latestVersion,
        minSupportedVersion: rpcData.min_supported_version || DEFAULT_UPDATE_CONFIG.minSupportedVersion,
        forceUpdate: rpcData.force_update ?? DEFAULT_UPDATE_CONFIG.forceUpdate,
        updateUrl: rpcData.update_url || DEFAULT_UPDATE_CONFIG.updateUrl,
        source: 'rpc'
      };
    }
  } catch (rpcErr) {
    console.warn('get_app_version_config RPC note:', rpcErr);
  }

  // 2. Attempt querying public view app_version
  try {
    const { data: viewData, error: viewError } = await supabase
      .from('app_version')
      .select('latest_version, min_supported_version, force_update, update_url')
      .limit(1)
      .maybeSingle();

    if (!viewError && viewData) {
      return {
        latestVersion: viewData.latest_version || DEFAULT_UPDATE_CONFIG.latestVersion,
        minSupportedVersion: viewData.min_supported_version || DEFAULT_UPDATE_CONFIG.minSupportedVersion,
        forceUpdate: viewData.force_update ?? DEFAULT_UPDATE_CONFIG.forceUpdate,
        updateUrl: viewData.update_url || DEFAULT_UPDATE_CONFIG.updateUrl,
        source: 'view'
      };
    }
  } catch (viewErr) {
    console.warn('app_version view fallback note:', viewErr);
  }

  // 3. Verify server reachability
  const isConnected = await pingSupabaseConnection();
  if (isConnected) {
    // Supabase is reachable and operational.
    // The server has not yet executed migration 010 in SQL Editor.
    // Use the 2.0.0 release baseline configuration.
    return {
      ...DEFAULT_UPDATE_CONFIG,
      source: 'baseline'
    };
  }

  // 4. Truly disconnected or offline
  throw new Error('Unable to connect to MoonLight Strikers servers. Please check your internet connection and try again.');
}

/**
 * Validates installed version against remote configuration.
 * Returns: { isSupported, installedVersion, minSupportedVersion, latestVersion, forceUpdate, updateUrl }
 */
export async function checkAppVersion() {
  const installedVersion = await getInstalledAppVersion();
  const config = await fetchRemoteVersionConfig();

  const isSupported = config.forceUpdate
    ? isVersionSupported(installedVersion, config.minSupportedVersion)
    : true;

  return {
    isSupported,
    installedVersion,
    minSupportedVersion: config.minSupportedVersion,
    latestVersion: config.latestVersion,
    forceUpdate: config.forceUpdate,
    updateUrl: config.updateUrl
  };
}
