import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import { useTheme } from './contexts/ThemeContext';

// Pages
import Home from './pages/Home';
import Matches from './pages/Matches';
import CreateMatch from './pages/CreateMatch';
import Live from './pages/Live';
import LiveMatch from './pages/LiveMatch';
import Records from './pages/Records';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen w-full bg-ms-bg-primary text-ms-text-primary">
      {/* Desktop Header */}
      <TopNav />

      {/* Mobile Sticky Top Header with Theme Switcher */}
      <header className="md:hidden flex items-center justify-between px-4 h-12 bg-ms-bg-secondary border-b border-ms-border sticky top-0 z-40 safe-area-top shadow-xs">
        <Link to="/" className="flex items-center gap-2 text-ms-cyan font-bold text-sm tracking-tight no-underline">
          <img src="/logo.png" alt="MoonLight Strikers" className="w-7 h-7 rounded-full object-cover border border-cyan-400/40 shadow-xs" />
          <span>MoonLight Strikers</span>
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
              <span className="text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-ms-cyan" />
              <span className="text-[11px]">Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 w-full pb-16 md:pb-6 overflow-x-hidden">
        <Routes>
          {/* Main cricket routes - open directly to everyone without login */}
          <Route path="/" element={<Home />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/create" element={<CreateMatch />} />
          <Route path="/matches/:matchId" element={<LiveMatch />} />
          <Route path="/live" element={<Live />} />
          <Route path="/live/:matchId" element={<LiveMatch />} />
          <Route path="/records" element={<Records />} />

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

