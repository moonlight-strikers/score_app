import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Trophy,
  Coins,
  Radio,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Matches', path: '/matches', icon: Trophy },
  { label: 'Toss', path: '/toss', icon: Coins },
  { label: 'Live', path: '/live', icon: Radio },
  { label: 'Records', path: '/records', icon: BarChart3 },
];

export default function BottomNav() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  // When soft keyboard is open / typing, completely hide bottom nav so it never covers the screen or keyboard
  if (isKeyboardVisible) {
    return null;
  }

  return (
    <nav className="ms-bottom-nav md:hidden safe-area-bottom">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `ms-bottom-nav-item ${isActive ? 'ms-bottom-nav-item-active' : ''}`
          }
        >
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
