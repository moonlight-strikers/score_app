import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Trophy,
  Coins,
  Radio,
  BarChart3,
  Plus,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const navItems = [
  { key: 'home', path: '/', icon: Home },
  { key: 'matches', path: '/matches', icon: Trophy },
  { key: 'toss', path: '/toss', icon: Coins },
  { key: 'live', path: '/live', icon: Radio },
  { key: 'records', path: '/records', icon: BarChart3 },
];

export default function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <header className="hidden md:block bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-ms-border text-slate-900 dark:text-white">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-2.5 text-ms-cyan no-underline">
          <img src="/logo.png" alt="MoonLight Strikers" className="w-8 h-8 rounded-full object-cover border border-cyan-400/40 shadow-xs flex-shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-base tracking-tight text-ms-cyan">MoonLight Strikers</span>
            <span className="text-[10px] font-score tabular-nums text-slate-400 tracking-wider">v1.1.0</span>
          </div>
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
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Direct Action */}
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-ms-bg-card border border-ms-border text-ms-text-secondary hover:text-ms-text-primary transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-ms-text-primary">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                <span className="text-ms-text-primary">Dark</span>
              </>
            )}
          </button>

          <Link
            to="/matches/create"
            className="ms-btn ms-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-3.5 h-3.5 text-black dark:text-white" />
            <span>{t('nav.newMatch')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

