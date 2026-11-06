import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { checkAppVersion, getInstalledAppVersion, DEFAULT_UPDATE_CONFIG } from '../services/versionService';
import MandatoryUpdateScreen from '../components/MandatoryUpdateScreen';

const VersionContext = createContext(null);

export function VersionProvider({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [installedVersion, setInstalledVersion] = useState('2.0.0');
  const [requiredVersion, setRequiredVersion] = useState(DEFAULT_UPDATE_CONFIG.minSupportedVersion);
  const [updateUrl, setUpdateUrl] = useState(DEFAULT_UPDATE_CONFIG.updateUrl);

  const verifyVersion = useCallback(async (isInitial = false) => {
    setIsChecking(true);
    setIsError(false);
    setErrorMessage('');

    try {
      // 1. Get installed version
      const currentInstalled = await getInstalledAppVersion();
      setInstalledVersion(currentInstalled);

      // 2. Fetch remote config & validate
      const result = await checkAppVersion();
      setRequiredVersion(result.minSupportedVersion);
      setUpdateUrl(result.updateUrl);

      if (!result.isSupported) {
        setIsUpdateRequired(true);
      } else {
        setIsUpdateRequired(false);
      }
    } catch (err) {
      console.error('Failed to validate app version:', err);
      setIsError(true);
      setErrorMessage(
        err?.message ||
        'Unable to connect to MoonLight Strikers servers to verify application version. Please check your network and retry.'
      );
      // Strict security: Do not silently bypass version validation on error
      setIsUpdateRequired(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial verification on app mount
    verifyVersion(true);

    // Re-verify when application returns to foreground (e.g. after downloading APK)
    let removeListener = null;
    try {
      const listenerPromise = CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          verifyVersion(false);
        }
      });
      listenerPromise.then((handle) => {
        removeListener = handle.remove;
      }).catch(() => {});
    } catch {
      // Ignore if CapApp is unavailable
    }

    return () => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    };
  }, [verifyVersion]);

  return (
    <VersionContext.Provider
      value={{
        isChecking,
        isUpdateRequired,
        installedVersion,
        requiredVersion,
        updateUrl,
        verifyVersion
      }}
    >
      {/* If update is required or connection error occurs, render blocking mandatory update screen */}
      {isUpdateRequired ? (
        <MandatoryUpdateScreen
          installedVersion={installedVersion}
          requiredVersion={requiredVersion}
          updateUrl={updateUrl}
          isError={isError}
          errorMessage={errorMessage}
          onRetry={() => verifyVersion(false)}
          onCheckAgain={() => verifyVersion(false)}
          isChecking={isChecking}
        />
      ) : isChecking ? (
        // Clean branded splash while initial verification occurs
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f1e] text-white select-none">
          <img
            src="/logo.png"
            alt="MoonLight Strikers"
            className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400/40 shadow-xl mb-4 animate-pulse"
          />
          <div className="flex items-center gap-2 text-sm text-cyan-400 font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Verifying application version...</span>
          </div>
        </div>
      ) : (
        children
      )}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const ctx = useContext(VersionContext);
  if (!ctx) {
    throw new Error('useVersion must be used within VersionProvider');
  }
  return ctx;
}

