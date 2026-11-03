import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import en from '../locales/en';
import ta from '../locales/ta';

const translations = { en, ta };

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key, params) => key
});

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('ms_language');
      return saved === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ms_language', language);
      document.documentElement.setAttribute('lang', language);
      if (language === 'ta') {
        document.documentElement.classList.add('lang-ta');
      } else {
        document.documentElement.classList.remove('lang-ta');
      }
    } catch (err) {
      console.warn('Could not persist language preference:', err);
    }
  }, [language]);

  const setLanguage = useCallback((newLang) => {
    if (newLang === 'en' || newLang === 'ta') {
      setLanguageState(newLang);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'ta' : 'en'));
  }, []);

  // Safe nested translation lookup with parameter interpolation
  const t = useCallback(
    (key, params = {}) => {
      if (!key) return '';
      const dict = translations[language] || translations.en;
      const fallbackDict = translations.en;

      const keys = String(key).split('.');
      let val = dict;
      for (const k of keys) {
        val = val?.[k];
        if (val === undefined) break;
      }

      // Fallback to English if not found
      if (val === undefined) {
        let fallbackVal = fallbackDict;
        for (const k of keys) {
          fallbackVal = fallbackVal?.[k];
          if (fallbackVal === undefined) break;
        }
        val = fallbackVal;
      }

      if (typeof val !== 'string') {
        return key;
      }

      // Interpolate parameters like {team}, {margin}, etc.
      if (params && Object.keys(params).length > 0) {
        return val.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? params[paramKey] : match;
        });
      }

      return val;
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageContext;
