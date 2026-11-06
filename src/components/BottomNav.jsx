import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Trophy,
  Coins,
  Users,
  BarChart3,
} from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import { useAdmin } from '../contexts/AdminContext';

const navItems = [
  { key: 'home', path: '/', icon: Home },
  { key: 'matches', path: '/matches', icon: Trophy },
  { key: 'toss', path: '/toss', icon: Coins },
  { key: 'players', path: '/players', icon: Users },
  { key: 'records', path: '/records', icon: BarChart3 },
];

export default function BottomNav() {
  const { t } = useLanguage();
  const { isPinScreenOpen } = useAdmin();
  const location = useLocation();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Compute active navigation index based on current route
  const getActiveIndex = () => {
    const current = location.pathname;
    if (current === '/') return 0;
    if (current.startsWith('/matches')) return 1;
    if (current.startsWith('/toss')) return 2;
    if (current.startsWith('/players')) return 3;
    if (current.startsWith('/records')) return 4;
    return -1;
  };

  const activeIndex = getActiveIndex();

  useEffect(() => {
    const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];

    const handleFocusIn = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const type = (e.target?.type || '').toLowerCase();
      if (
        tag === 'textarea' ||
        (tag === 'input' && !nonTextTypes.includes(type)) ||
        e.target?.isContentEditable
      ) {
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const tag = active?.tagName?.toLowerCase();
        const type = (active?.type || '').toLowerCase();
        if (
          tag !== 'textarea' &&
          (tag !== 'input' || nonTextTypes.includes(type)) &&
          !active?.isContentEditable
        ) {
          setIsKeyboardVisible(false);
        }
      }, 80);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const heightDifference = window.innerHeight - window.visualViewport.height;
        if (heightDifference > 120) {
          setIsKeyboardVisible(true);
        } else {
          const active = document.activeElement;
          const tag = active?.tagName?.toLowerCase();
          if (tag !== 'input' && tag !== 'textarea') {
            setIsKeyboardVisible(false);
          }
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize, { passive: true });
    }

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);

  // When Admin PIN screen is open or soft keyboard is open, completely hide bottom nav
  if (isPinScreenOpen || isKeyboardVisible) {
    return null;
  }

  return (
    <div className="ms-bottom-nav-container md:hidden">
      <nav className="ms-bottom-nav-outer" aria-label="Bottom Navigation">
        <div className="ms-bottom-nav-inner">
          {/* Active Capsule Highlight Pill with smooth sliding transition */}
          <div
            className="ms-bottom-nav-pill"
            style={{
              left: '4px',
              width: 'calc((100% - 8px) / 5)',
              transform: `translateX(${activeIndex >= 0 ? activeIndex * 100 : 0}%)`,
              opacity: activeIndex >= 0 ? 1 : 0,
              visibility: activeIndex >= 0 ? 'visible' : 'hidden',
            }}
          />

          {navItems.map((item, idx) => {
            const isActive = activeIndex === idx;
            const IconComponent = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={`ms-bottom-nav-link group ${
                  isActive ? 'ms-bottom-nav-link-active' : ''
                }`}
              >
                <IconComponent className="w-5 h-5 transition-colors duration-200 shrink-0" />
                <span className="text-[10px] sm:text-[11px] leading-tight truncate tracking-tight transition-colors duration-200">
                  {t(`nav.${item.key}`)}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
