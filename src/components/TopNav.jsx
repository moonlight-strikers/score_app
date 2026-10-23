import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Trophy,
  Radio,
  BarChart3,
  Plus,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Matches', path: '/matches', icon: Trophy },
  { label: 'Live', path: '/live', icon: Radio },
  { label: 'Records', path: '/records', icon: BarChart3 },
];

export default function TopNav() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="hidden md:block bg-ms-bg-secondary border-b border-ms-border">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-2.5 text-ms-cyan font-bold text-lg no-underline">
          <img src="/logo.png" alt="MoonLight Strikers" className="w-8 h-8 rounded-full object-cover border border-cyan-400/40 shadow-xs" />
          <span>MoonLight Strikers</span>
        </NavLink>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium no-underline transition-colors
                ${isActive
                  ? 'text-ms-cyan bg-ms-cyan-subtle'
                  : 'text-ms-text-secondary hover:text-ms-text-primary hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Direct Action */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-ms-cyan" />
                <span>Dark</span>
              </>
            )}
          </button>

          <Link
            to="/matches/create"
            className="ms-btn ms-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Match</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

