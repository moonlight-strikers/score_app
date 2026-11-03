import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSwitcher({ className = '' }) {
  const { language, toggleLanguage, setLanguage } = useLanguage();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggleLanguage}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleLanguage();
        }
      }}
      className={`px-2 py-1 min-h-[30px] rounded-lg bg-ms-bg-card border border-ms-border hover:border-cyan-500/50 transition-all cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs select-none shadow-2xs active:scale-95 ${className}`}
      title={language === 'en' ? 'தமிழுக்கு மாறுக (Switch to Tamil)' : 'Switch to English (ஆங்கிலத்திற்கு மாறுக)'}
      aria-label="Toggle language: English / தமிழ்"
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          setLanguage('en');
        }}
        className={`transition-colors ${
          language === 'en'
            ? 'text-cyan-600 dark:text-cyan-400 font-black drop-shadow-2xs'
            : 'text-slate-400 dark:text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        EN
      </span>
      <span className="text-slate-300 dark:text-slate-600 text-[10px] font-light">|</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setLanguage('ta');
        }}
        className={`transition-colors ${
          language === 'ta'
            ? 'text-cyan-600 dark:text-cyan-400 font-black drop-shadow-2xs'
            : 'text-slate-400 dark:text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        தமிழ்
      </span>
    </div>
  );
}
