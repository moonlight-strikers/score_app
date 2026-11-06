import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function syncStatusBarTheme(mode) {
  try {
    if (window.AndroidEdgeToEdge?.setStatusBarTheme) {
      window.AndroidEdgeToEdge.setStatusBarTheme(mode);
    }
  } catch {}

  try {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', mode === 'light' ? '#ffffff' : '#070d18');
    }
  } catch {}
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ms_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
      root.classList.remove('light');
    }
    try {
      localStorage.setItem('ms_theme', theme);
    } catch {}

    syncStatusBarTheme(theme);
    const t1 = setTimeout(() => syncStatusBarTheme(theme), 300);
    const t2 = setTimeout(() => syncStatusBarTheme(theme), 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
