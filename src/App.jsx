import React, { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import SplashScreen from './components/SplashScreen';
import { useTheme } from './contexts/ThemeContext';

// Pages
import Home from './pages/Home';
import Matches from './pages/Matches';
import CreateMatch from './pages/CreateMatch';
import Live from './pages/Live';
import LiveMatch from './pages/LiveMatch';
import Records from './pages/Records';
import Toss from './pages/Toss';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('ms_splash_seen');
    } catch {
      return false;
    }
  });

  const handleSplashFinish = () => {
    try {
      sessionStorage.setItem('ms_splash_seen', 'true');
    } catch {
      // ignore
    }
    setShowSplash(false);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-ms-bg-primary text-ms-text-primary">
      {/* Animated Opening Splash Screen for App Launch */}
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}

      {/* Desktop Header */}
      <TopNav />

      {/* Mobile Sticky Top Header with Theme Switcher & Version */}
      <header className="md:hidden flex items-center justify-between px-4 py-1.5 min-h-[50px] bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-ms-border sticky top-0 z-40 safe-area-top shadow-xs">
        <Link to="/" className="flex items-center gap-2.5 text-ms-cyan no-underline">
          <img src="/logo.png" alt="MoonLight Strikers" className="w-8 h-8 rounded-full object-cover border border-cyan-400/40 shadow-xs flex-shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm tracking-tight text-ms-cyan">MoonLight Strikers</span>
            <span className="text-[10px] font-score tabular-nums text-slate-400 tracking-wider">v1.1.0</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] text-ms-text-primary">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-800 dark:text-slate-200" />
              <span className="text-[11px] text-ms-text-primary">Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 w-full pb-16 md:pb-6 overflow-x-hidden flex flex-col">
        <Routes>
          {/* Main cricket routes - open directly to everyone without login */}
          <Route path="/" element={<Home />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/create" element={<CreateMatch />} />
          <Route path="/matches/:matchId" element={<LiveMatch />} />
          <Route path="/live" element={<Live />} />
          <Route path="/live/:matchId" element={<LiveMatch />} />
          <Route path="/records" element={<Records />} />
          <Route path="/toss" element={<Toss />} />

          {/* Legacy redirects */}
          <Route path="/login" element={<Navigate to="/matches" replace />} />
          <Route path="/register" element={<Navigate to="/matches" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/matches" replace />} />
          <Route path="/players" element={<Navigate to="/matches" replace />} />
          <Route path="/club" element={<Navigate to="/matches" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

