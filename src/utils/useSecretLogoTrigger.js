import { useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Secret 5-click header logo trigger.
 * Detects 5 clicks on the home page header logo within 3 seconds to open Admin PIN.
 * Resets click counter if 3 seconds pass without completing 5 clicks.
 * Preserves normal logo click behavior for single, double, or slow clicks.
 */
export function useSecretLogoTrigger(onTrigger, targetClicks = 5, windowMs = 3000) {
  const clicksRef = useRef([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const location = useLocation();

  const handleLogoClick = useCallback(
    (e) => {
      // Only count clicks when in the home page header
      const isHome = location.pathname === '/';
      if (!isHome) {
        // Allow standard navigation back to home page
        return;
      }

      const now = Date.now();
      // Drop any clicks older than the time window (3 seconds)
      clicksRef.current = clicksRef.current.filter((t) => now - t <= windowMs);
      clicksRef.current.push(now);

      // Trigger subtle tactile feedback animation on the logo
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 140);

      if (clicksRef.current.length >= targetClicks) {
        // Prevent default navigation link action on the 5th click
        if (e && e.preventDefault) {
          e.preventDefault();
        }
        if (e && e.stopPropagation) {
          e.stopPropagation();
        }
        clicksRef.current = [];
        if (typeof onTrigger === 'function') {
          onTrigger();
        }
      }
    },
    [location.pathname, onTrigger, targetClicks, windowMs]
  );

  return {
    handleLogoClick,
    isAnimating,
  };
}
