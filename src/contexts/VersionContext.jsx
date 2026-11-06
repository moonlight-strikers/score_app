import React, { createContext, useContext } from 'react';

const VersionContext = createContext({
  isChecking: false,
  isUpdateRequired: false,
  installedVersion: '2.0.0'
});

export function VersionProvider({ children }) {
  return <>{children}</>;
}

export function useVersion() {
  return useContext(VersionContext);
}
